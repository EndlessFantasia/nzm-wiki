#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_update;
mod config;
mod shortcuts;

use std::{
    borrow::Cow,
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

use app_update::{AppUpdateInfo, PendingUpdate};
use config::Preferences;
use serde::Serialize;
use shortcuts::{Action, ShortcutInfo, Shortcuts};
use tauri::{
    http::{header::CONTENT_TYPE, Request, Response},
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::{NewWindowResponse, PageLoadEvent},
    window::Color,
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;

const SITE_URL: &str = "https://nzm-wiki.com/";
const SITE_HOST: &str = "nzm-wiki.com";
const SETTINGS_PATH: &str = "/desktop/settings";
// 设置页带上该查询参数时进入页面即检查桌面端更新
const CHECK_UPDATE_QUERY: &str = "check-update";
const MAIN_WINDOW: &str = "main";
const SPLASH_WINDOW: &str = "splash";
// 独立计算器窗口：置顶浮在游戏上，与主窗口的显示/隐藏互不影响
const CALCULATOR_WINDOW: &str = "calculator";
const CALCULATOR_PATH: &str = "/desktop/calculator";
// 悬浮滚动条不占宽度，顶栏可铺满窗口；前半段是 wry 的默认参数，设置后会被覆盖，需保留。
// 同一数据目录下的 WebView2 参数必须一致，启动画面与主窗口共用
const BROWSER_ARGS: &str =
    "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --enable-features=OverlayScrollbar";
const SPLASH_HTML: &[u8] = include_bytes!("../splash/index.html");
const SPLASH_AVATAR: &[u8] = include_bytes!("../icons/128x128@2x.png");
// 站点很快加载完时也让启动画面完整淡入，避免一闪而过；站点迟迟加载不完则到时直接显示主窗口
const SPLASH_MIN: Duration = Duration::from_millis(500);
const SPLASH_TIMEOUT: Duration = Duration::from_secs(10);
const SPLASH_FADE: Duration = Duration::from_millis(220);

// 文档创建时标记桌面端，站点 CSS 据此调整滚动条等桌面专属样式，避免首屏闪烁
const DESKTOP_INIT_SCRIPT: &str = r#"(() => {
  const mark = () => document.documentElement?.setAttribute("data-desktop", "");
  if (document.documentElement) return mark();
  new MutationObserver((_, observer) => {
    if (document.documentElement) {
      mark();
      observer.disconnect();
    }
  }).observe(document, { childList: true });
})();"#;

struct TrayItems {
    toggle: MenuItem<Wry>,
    pin: CheckMenuItem<Wry>,
    calculator: MenuItem<Wry>,
    update: MenuItem<Wry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsState {
    version: String,
    pinned: bool,
    desktop_cache: bool,
    app_update: Option<AppUpdateInfo>,
    shortcuts: Vec<ShortcutInfo>,
}

struct Splash {
    shown_at: Instant,
    done: AtomicBool,
}

static SITE: OnceLock<Url> = OnceLock::new();

// tauri dev 默认加载 devUrl（本地站点）；调试构建可用 NZM_DESKTOP_URL 覆盖
fn resolve_site_url(app: &AppHandle) -> Url {
    #[cfg(debug_assertions)]
    if let Some(url) = std::env::var("NZM_DESKTOP_URL").ok().and_then(|url| url.parse().ok()) {
        return url;
    }
    if tauri::is_dev() {
        if let Some(url) = app.config().build.dev_url.clone() {
            return url;
        }
    }
    SITE_URL.parse().unwrap()
}

fn site_url() -> Url {
    SITE.get().cloned().unwrap_or_else(|| SITE_URL.parse().unwrap())
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW)
}

fn show_window(app: &AppHandle) {
    // 启动画面期间被托盘或热键唤出时直接收起启动画面
    app.state::<Splash>().done.store(true, Ordering::Relaxed);
    if let Some(splash) = app.get_webview_window(SPLASH_WINDOW) {
        let _ = splash.close();
    }
    if let Some(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        notify_visibility(&window, true);
    }
}

fn hide_window(app: &AppHandle) {
    if let Some(window) = main_window(app) {
        let _ = window.hide();
        notify_visibility(&window, false);
    }
}

// 站点据此决定发现新部署时是后台静默重载还是只提示（components/DesktopUpdateNotice.tsx）
fn notify_visibility(window: &WebviewWindow, visible: bool) {
    let _ = window.eval(format!(
        "window.dispatchEvent(new CustomEvent('nzm-desktop:visibility-changed', {{ detail: {visible} }}))"
    ));
}

fn toggle_window(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };
    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && !minimized && focused {
        hide_window(app);
    } else {
        show_window(app);
    }
}

fn apply_pinned(app: &AppHandle, pinned: bool) {
    if let Some(window) = main_window(app) {
        let _ = window.set_always_on_top(pinned);
    }
    let _ = app.state::<TrayItems>().pin.set_checked(pinned);
    // 用 DOM 事件通知站点，不给线上页面开放 Tauri 事件监听权限
    if let Some(window) = main_window(app) {
        let _ = window.eval(format!(
            "window.dispatchEvent(new CustomEvent('nzm-desktop:pinned-changed', {{ detail: {pinned} }}))"
        ));
    }
}

fn toggle_pinned(app: &AppHandle) {
    let pinned = app.state::<TrayItems>().pin.is_checked().unwrap_or(false);
    apply_pinned(app, !pinned);
}

fn update_tray_accelerators(app: &AppHandle) {
    let items = app.state::<TrayItems>();
    let shortcuts = app.state::<Shortcuts>();
    let toggle_keys = shortcuts.keys(Action::ToggleWindow);
    if items.toggle.set_accelerator(toggle_keys.as_deref()).is_err() {
        let _ = items.toggle.set_accelerator(None::<&str>);
    }
    let pin_keys = shortcuts.keys(Action::TogglePin);
    if items.pin.set_accelerator(pin_keys.as_deref()).is_err() {
        let _ = items.pin.set_accelerator(None::<&str>);
    }
    let calculator_keys = shortcuts.keys(Action::ToggleCalculator);
    if items.calculator.set_accelerator(calculator_keys.as_deref()).is_err() {
        let _ = items.calculator.set_accelerator(None::<&str>);
    }
}

fn calculator_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(CALCULATOR_WINDOW)
}

// 主窗口据此显示武器详情的「导入计算器」按钮（lib/calculator-bridge.ts）
fn notify_calculator(app: &AppHandle, visible: bool) {
    if let Some(window) = main_window(app) {
        let _ = window.eval(format!(
            "window.dispatchEvent(new CustomEvent('nzm-desktop:calculator-changed', {{ detail: {visible} }}))"
        ));
    }
}

fn show_calculator(app: &AppHandle) {
    if let Some(window) = calculator_window(app) {
        reveal_calculator(app, &window);
        return;
    }
    // 在主线程（IPC 回调、托盘菜单、热键）里同步创建 WebView2 窗口会卡住，新窗口只剩空白，统一放到后台线程
    let app = app.clone();
    thread::spawn(move || {
        if let Ok(window) = build_calculator_window(&app) {
            reveal_calculator(&app, &window);
        }
    });
}

fn reveal_calculator(app: &AppHandle, window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    notify_calculator(app, true);
}

fn hide_calculator(app: &AppHandle) {
    if let Some(window) = calculator_window(app) {
        let _ = window.hide();
        notify_calculator(app, false);
    }
}

fn calculator_visible(app: &AppHandle) -> bool {
    calculator_window(app)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

fn toggle_calculator(app: &AppHandle) {
    let focused = calculator_window(app)
        .and_then(|window| window.is_focused().ok())
        .unwrap_or(false);
    if calculator_visible(app) && focused {
        hide_calculator(app);
    } else {
        show_calculator(app);
    }
}

// 只清空 HTTP 磁盘缓存后重新加载，Cookie 与 localStorage 中的站点偏好保留
fn refresh_cache(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };
    let reload = window.clone();
    let _ = window.with_webview(move |webview| {
        let after_clear = reload.clone();
        let cleared = unsafe {
            clear_disk_cache(&webview, move || {
                let _ = after_clear.eval("location.reload()");
            })
        };
        if cleared.is_err() {
            let _ = reload.eval("location.reload()");
        }
    });
}

#[cfg(windows)]
unsafe fn clear_disk_cache(
    webview: &tauri::webview::PlatformWebview,
    on_cleared: impl FnOnce() + 'static,
) -> windows_core::Result<()> {
    use webview2_com::{
        ClearBrowsingDataCompletedHandler,
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
        },
    };
    use windows_core::Interface;

    let profile = webview
        .controller()
        .CoreWebView2()?
        .cast::<ICoreWebView2_13>()?
        .Profile()?
        .cast::<ICoreWebView2Profile2>()?;
    profile.ClearBrowsingData(
        COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
        &ClearBrowsingDataCompletedHandler::create(Box::new(move |_| {
            on_cleared();
            Ok(())
        })),
    )
}

fn show_settings(app: &AppHandle, query: Option<&str>) {
    if let (Some(window), Ok(mut url)) = (main_window(app), site_url().join(SETTINGS_PATH)) {
        url.set_query(query);
        let _ = window.navigate(url);
        show_window(app);
    }
}

fn on_update_found(app: &AppHandle, info: &AppUpdateInfo) {
    let _ = app.state::<TrayItems>().update.set_text(format!("安装更新 v{}…", info.version()));
}

#[tauri::command]
fn get_settings_state(app: AppHandle) -> SettingsState {
    SettingsState {
        version: app.package_info().version.to_string(),
        pinned: app.state::<TrayItems>().pin.is_checked().unwrap_or(false),
        desktop_cache: app.state::<Preferences>().desktop_cache(),
        app_update: app.state::<PendingUpdate>().info(),
        shortcuts: app.state::<Shortcuts>().infos(),
    }
}

#[tauri::command]
fn set_pinned(app: AppHandle, pinned: bool) {
    apply_pinned(&app, pinned);
}

#[tauri::command]
fn open_calculator(app: AppHandle) {
    show_calculator(&app);
}

#[tauri::command]
fn get_calculator_visible(app: AppHandle) -> bool {
    calculator_visible(&app)
}

#[tauri::command]
async fn check_app_update(app: AppHandle) -> Result<Option<AppUpdateInfo>, String> {
    app_update::check(&app, |info| on_update_found(&app, info)).await
}

#[tauri::command]
async fn install_app_update(app: AppHandle) -> Result<(), String> {
    app_update::install(&app).await
}

#[tauri::command]
fn refresh_site_cache(app: AppHandle) {
    refresh_cache(&app);
}

#[tauri::command]
fn set_desktop_cache(app: AppHandle, enabled: bool) {
    app.state::<Preferences>().set_desktop_cache(&app, enabled);
    if let Some(window) = main_window(&app) {
        let _ = window.eval(format!(
            "window.dispatchEvent(new CustomEvent('nzm-desktop:cache-changed', {{ detail: {enabled} }}))"
        ));
    }
}

// 快捷键命令保持同步执行（主线程），注册热键与热键回调不会交错
#[tauri::command]
fn set_shortcut(app: AppHandle, action: Action, keys: Option<String>) -> Result<Vec<ShortcutInfo>, String> {
    let shortcuts = app.state::<Shortcuts>();
    shortcuts.set(&app, action, keys)?;
    update_tray_accelerators(&app);
    Ok(shortcuts.infos())
}

#[tauri::command]
fn reset_shortcuts(app: AppHandle) -> Vec<ShortcutInfo> {
    let shortcuts = app.state::<Shortcuts>();
    shortcuts.reset(&app);
    update_tray_accelerators(&app);
    shortcuts.infos()
}

// 录制新组合键期间暂停全局热键，否则按下已绑定的组合会被系统拦截，页面收不到按键
#[tauri::command]
fn set_shortcuts_paused(app: AppHandle, paused: bool) -> Vec<ShortcutInfo> {
    let shortcuts = app.state::<Shortcuts>();
    if paused {
        shortcuts.unregister_all(&app);
    } else {
        shortcuts.register_all(&app);
    }
    shortcuts.infos()
}

fn is_site_url(url: &Url) -> bool {
    let Some(host) = url.host_str() else { return false };
    host == SITE_HOST
        || host.ends_with(&format!(".{SITE_HOST}"))
        || site_url().origin() == url.origin()
}

fn open_external(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

// 首次启动的窗口尺寸：1440×860，小屏上不超过主显示器可用区域的 90%；之后由 window-state 恢复
fn default_window_size(app: &AppHandle) -> (f64, f64) {
    let (mut width, mut height) = (1440.0_f64, 860.0_f64);
    if let Ok(Some(monitor)) = app.primary_monitor() {
        let area = monitor.work_area().size.to_logical::<f64>(monitor.scale_factor());
        width = width.min(area.width * 0.9);
        height = height.min(area.height * 0.9);
    }
    (width, height)
}

fn splash_protocol(request: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let (body, mime) = match request.uri().path() {
        "/avatar.png" => (SPLASH_AVATAR, "image/png"),
        _ => (SPLASH_HTML, "text/html; charset=utf-8"),
    };
    Response::builder()
        .header(CONTENT_TYPE, mime)
        .body(Cow::Borrowed(body))
        .unwrap()
}

// Windows 上的自定义协议通过 http://<scheme>.localhost 访问
fn splash_url() -> Url {
    let url = if cfg!(windows) { "http://splash.localhost/" } else { "splash://localhost/" };
    url.parse().unwrap()
}

fn build_splash_window(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, SPLASH_WINDOW, WebviewUrl::CustomProtocol(splash_url()))
        .title("逆战未来维基")
        .inner_size(380.0, 260.0)
        .center()
        .decorations(false)
        // 圆角卡片和阴影由页面绘制，窗口本身透明且不要系统阴影
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .additional_browser_args(BROWSER_ARGS)
        .build()?;
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(SPLASH_TIMEOUT);
        finish_splash(&app);
    });
    Ok(())
}

// 主窗口首次加载完成（或超时）后显示主窗口，启动画面淡出后关闭
fn finish_splash(app: &AppHandle) {
    let splash = app.state::<Splash>();
    if splash.done.swap(true, Ordering::Relaxed) {
        return;
    }
    let wait = SPLASH_MIN.saturating_sub(splash.shown_at.elapsed());
    let app = app.clone();
    thread::spawn(move || {
        thread::sleep(wait);
        if let Some(window) = main_window(&app) {
            let _ = window.show();
            let _ = window.set_focus();
        }
        if let Some(splash) = app.get_webview_window(SPLASH_WINDOW) {
            let _ = splash.eval("document.body.classList.add('leave')");
            thread::sleep(SPLASH_FADE);
            let _ = splash.close();
        }
    });
}

fn build_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    let (width, height) = default_window_size(app);
    let window = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(site_url()))
        .title("逆战未来维基")
        .inner_size(width, height)
        .min_inner_size(420.0, 480.0)
        .center()
        // 站点加载完成前由启动画面占位
        .visible(false)
        // 站点顶栏兼任标题栏（拖动区域与窗口按钮由站点在桌面端渲染）
        .decorations(false)
        .additional_browser_args(BROWSER_ARGS)
        .initialization_script(DESKTOP_INIT_SCRIPT)
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                finish_splash(window.app_handle());
            }
        })
        .on_navigation(move |url| match url.scheme() {
            "http" | "https" if !is_site_url(url) => {
                open_external(&nav_app, url);
                false
            }
            "http" | "https" | "about" | "data" | "blob" => {
                // 页面在录制快捷键途中刷新或跳走时恢复热键
                nav_app.state::<Shortcuts>().register_all(&nav_app);
                true
            }
            _ => {
                open_external(&nav_app, url);
                false
            }
        })
        .on_new_window(move |url, _features| {
            if is_site_url(&url) {
                if let Some(window) = main_window(&popup_app) {
                    tauri::async_runtime::spawn(async move {
                        let _ = window.navigate(url);
                    });
                }
            } else {
                open_external(&popup_app, &url);
            }
            NewWindowResponse::Deny
        })
        .build()?;

    let observed = window.clone();
    let maximized = AtomicBool::new(window.is_maximized().unwrap_or(false));
    window.on_window_event(move |event| match event {
        WindowEvent::Resized(_) => {
            let now = observed.is_maximized().unwrap_or(false);
            if maximized.swap(now, Ordering::Relaxed) != now {
                let _ = observed.eval(format!(
                    "window.dispatchEvent(new CustomEvent('nzm-desktop:maximized-changed', {{ detail: {now} }}))"
                ));
            }
        }
        // 开启桌面端缓存时关闭按钮只隐藏到托盘，进程常驻，下次呼出无需重新加载站点
        WindowEvent::CloseRequested { api, .. } => {
            let app = observed.app_handle();
            if app.state::<Preferences>().desktop_cache() {
                api.prevent_close();
                hide_window(app);
            } else if let Some(calculator) = calculator_window(app) {
                // 关闭即退出：隐藏着的计算器窗口不能让进程继续留着
                let _ = calculator.destroy();
            }
        }
        _ => {}
    });
    Ok(window)
}

// 首次打开时创建，之后关闭只隐藏，输入状态与窗口位置保留
fn build_calculator_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    let url = site_url().join(CALCULATOR_PATH).map_err(tauri::Error::InvalidUrl)?;
    let window = WebviewWindowBuilder::new(app, CALCULATOR_WINDOW, WebviewUrl::External(url))
        .title("计算器")
        .inner_size(380.0, 480.0)
        .min_inner_size(300.0, 320.0)
        .center()
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .maximizable(false)
        // 与页面底色一致，站点加载完成前不闪白
        .background_color(Color(24, 24, 27, 255))
        .additional_browser_args(BROWSER_ARGS)
        .initialization_script(DESKTOP_INIT_SCRIPT)
        .on_navigation(move |url| match url.scheme() {
            "http" | "https" if !is_site_url(url) => {
                open_external(&nav_app, url);
                false
            }
            "http" | "https" | "about" | "data" | "blob" => true,
            _ => {
                open_external(&nav_app, url);
                false
            }
        })
        .on_new_window(move |url, _features| {
            if !is_site_url(&url) {
                open_external(&popup_app, &url);
            }
            NewWindowResponse::Deny
        })
        .build()?;

    let observed = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            hide_calculator(observed.app_handle());
        }
    });
    Ok(window)
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>)?;
    let pin = CheckMenuItem::with_id(app, "pin", "窗口置顶", true, false, None::<&str>)?;
    let calculator = MenuItem::with_id(app, "calculator", "计算器", true, None::<&str>)?;
    let home = MenuItem::with_id(app, "home", "回到首页", true, None::<&str>)?;
    let reload = MenuItem::with_id(app, "reload", "刷新", true, None::<&str>)?;
    let clear_cache = MenuItem::with_id(app, "refresh-cache", "刷新缓存", true, None::<&str>)?;
    let update = MenuItem::with_id(app, "check-update", "检查更新…", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &pin,
            &calculator,
            &PredefinedMenuItem::separator(app)?,
            &home,
            &reload,
            &clear_cache,
            &PredefinedMenuItem::separator(app)?,
            &update,
            &settings,
            &quit,
        ],
    )?;
    app.manage(TrayItems { toggle, pin, calculator, update });
    update_tray_accelerators(app);

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("逆战未来维基")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_window(app),
            // 勾选状态在事件触发前已由菜单自行切换
            "pin" => {
                let pinned = app.state::<TrayItems>().pin.is_checked().unwrap_or(false);
                apply_pinned(app, pinned);
            }
            "calculator" => toggle_calculator(app),
            "home" => {
                if let Some(window) = main_window(app) {
                    let _ = window.navigate(site_url());
                    show_window(app);
                }
            }
            "reload" => {
                if let Some(window) = main_window(app) {
                    let _ = window.eval("location.reload()");
                }
            }
            "refresh-cache" => refresh_cache(app),
            "check-update" => show_settings(app, Some(CHECK_UPDATE_QUERY)),
            "settings" => show_settings(app, None),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app)
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_denylist(&[SPLASH_WINDOW])
                // 不恢复可见性和边框：避免启动即隐藏，或旧状态把系统标题栏带回来
                .with_state_flags(
                    StateFlags::all().difference(StateFlags::VISIBLE | StateFlags::DECORATIONS),
                )
                .build(),
        )
        // 外链由 on_navigation/on_new_window 在 Rust 侧交给系统浏览器；
        // 关闭插件注入的点击拦截脚本，否则它会从站点调用未授权的 open_url
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match app.state::<Shortcuts>().action_for(shortcut) {
                        Some(Action::ToggleWindow) => toggle_window(app),
                        Some(Action::TogglePin) => toggle_pinned(app),
                        Some(Action::ToggleCalculator) => toggle_calculator(app),
                        None => {}
                    }
                })
                .build(),
        )
        .register_uri_scheme_protocol("splash", |_ctx, request| splash_protocol(request))
        .invoke_handler(tauri::generate_handler![
            get_settings_state,
            set_pinned,
            set_desktop_cache,
            refresh_site_cache,
            open_calculator,
            get_calculator_visible,
            check_app_update,
            install_app_update,
            set_shortcut,
            reset_shortcuts,
            set_shortcuts_paused
        ])
        .setup(|app| {
            let handle = app.handle();
            let _ = SITE.set(resolve_site_url(handle));
            app.manage(Splash {
                shown_at: Instant::now(),
                done: AtomicBool::new(false),
            });
            build_splash_window(handle)?;
            app.manage(Shortcuts::load(handle));
            app.manage(Preferences::load(handle));
            app.manage(PendingUpdate::default());
            build_tray(handle)?;
            build_main_window(handle)?;
            app.state::<Shortcuts>().register_all(handle);
            app_update::spawn_background_checks(handle.clone(), on_update_found);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动逆战未来维基桌面端失败");
}

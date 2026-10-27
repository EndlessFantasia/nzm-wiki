#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod shortcuts;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    OnceLock,
};

use serde::Serialize;
use shortcuts::{Action, ShortcutInfo, Shortcuts};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::NewWindowResponse,
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;

const SITE_URL: &str = "https://nzm-wiki.com/";
const SITE_HOST: &str = "nzm-wiki.com";
const SETTINGS_PATH: &str = "/desktop/settings";
const MAIN_WINDOW: &str = "main";

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
}

#[derive(Serialize)]
struct SettingsState {
    version: String,
    pinned: bool,
    shortcuts: Vec<ShortcutInfo>,
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
    if let Some(window) = main_window(app) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn toggle_window(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };
    let visible = window.is_visible().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && !minimized && focused {
        let _ = window.hide();
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
}

fn show_settings(app: &AppHandle) {
    if let (Some(window), Ok(url)) = (main_window(app), site_url().join(SETTINGS_PATH)) {
        let _ = window.navigate(url);
        show_window(app);
    }
}

#[tauri::command]
fn get_settings_state(app: AppHandle) -> SettingsState {
    SettingsState {
        version: app.package_info().version.to_string(),
        pinned: app.state::<TrayItems>().pin.is_checked().unwrap_or(false),
        shortcuts: app.state::<Shortcuts>().infos(),
    }
}

#[tauri::command]
fn set_pinned(app: AppHandle, pinned: bool) {
    apply_pinned(&app, pinned);
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

fn build_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    let (width, height) = default_window_size(app);
    let window = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(site_url()))
        .title("逆战未来维基")
        .inner_size(width, height)
        .min_inner_size(420.0, 480.0)
        .center()
        // 站点顶栏兼任标题栏（拖动区域与窗口按钮由站点在桌面端渲染）
        .decorations(false)
        // 悬浮滚动条不占宽度，顶栏可铺满窗口；前半段是 wry 的默认参数，设置后会被覆盖，需保留
        .additional_browser_args(
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --enable-features=OverlayScrollbar",
        )
        .initialization_script(DESKTOP_INIT_SCRIPT)
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
    window.on_window_event(move |event| {
        if let WindowEvent::Resized(_) = event {
            let now = observed.is_maximized().unwrap_or(false);
            if maximized.swap(now, Ordering::Relaxed) != now {
                let _ = observed.eval(format!(
                    "window.dispatchEvent(new CustomEvent('nzm-desktop:maximized-changed', {{ detail: {now} }}))"
                ));
            }
        }
    });
    Ok(window)
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏", true, None::<&str>)?;
    let pin = CheckMenuItem::with_id(app, "pin", "窗口置顶", true, false, None::<&str>)?;
    let home = MenuItem::with_id(app, "home", "回到首页", true, None::<&str>)?;
    let reload = MenuItem::with_id(app, "reload", "刷新", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &toggle,
            &pin,
            &PredefinedMenuItem::separator(app)?,
            &home,
            &reload,
            &PredefinedMenuItem::separator(app)?,
            &settings,
            &quit,
        ],
    )?;
    app.manage(TrayItems { toggle, pin });
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
            "settings" => show_settings(app),
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    match app.state::<Shortcuts>().action_for(shortcut) {
                        Some(Action::ToggleWindow) => toggle_window(app),
                        Some(Action::TogglePin) => toggle_pinned(app),
                        None => {}
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_settings_state,
            set_pinned,
            set_shortcut,
            reset_shortcuts,
            set_shortcuts_paused
        ])
        .setup(|app| {
            let handle = app.handle();
            let _ = SITE.set(resolve_site_url(handle));
            app.manage(Shortcuts::load(handle));
            build_tray(handle)?;
            build_main_window(handle)?;
            app.state::<Shortcuts>().register_all(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动逆战未来维基桌面端失败");
}

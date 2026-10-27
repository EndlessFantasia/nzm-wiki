#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    webview::NewWindowResponse,
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Wry,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::StateFlags;

const SITE_URL: &str = "https://nzm-wiki.com/";
const SITE_HOST: &str = "nzm-wiki.com";
const MAIN_WINDOW: &str = "main";

struct PinItem(CheckMenuItem<Wry>);

fn toggle_window_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN)
}

fn toggle_pin_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyT)
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

fn set_pinned(app: &AppHandle, pinned: bool) {
    if let Some(window) = main_window(app) {
        let _ = window.set_always_on_top(pinned);
    }
    let _ = app.state::<PinItem>().0.set_checked(pinned);
}

fn toggle_pinned(app: &AppHandle) {
    let pinned = app.state::<PinItem>().0.is_checked().unwrap_or(false);
    set_pinned(app, !pinned);
}

fn is_site_url(url: &Url) -> bool {
    url.host_str()
        .is_some_and(|host| host == SITE_HOST || host.ends_with(&format!(".{SITE_HOST}")))
}

fn open_external(app: &AppHandle, url: &Url) {
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
}

fn build_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let nav_app = app.clone();
    let popup_app = app.clone();
    WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::External(SITE_URL.parse().unwrap()))
        .title("逆战：未来 Wiki")
        .inner_size(1280.0, 800.0)
        .min_inner_size(420.0, 480.0)
        .center()
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
        .build()
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏", true, Some("Ctrl+Alt+N"))?;
    let pin = CheckMenuItem::with_id(app, "pin", "窗口置顶", true, false, Some("Ctrl+Alt+T"))?;
    let home = MenuItem::with_id(app, "home", "回到首页", true, None::<&str>)?;
    let reload = MenuItem::with_id(app, "reload", "刷新", true, None::<&str>)?;
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
            &quit,
        ],
    )?;
    app.manage(PinItem(pin));

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("逆战：未来 Wiki")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_window(app),
            // 勾选状态在事件触发前已由菜单自行切换
            "pin" => {
                let pinned = app.state::<PinItem>().0.is_checked().unwrap_or(false);
                set_pinned(app, pinned);
            }
            "home" => {
                if let Some(window) = main_window(app) {
                    let _ = window.navigate(SITE_URL.parse().unwrap());
                    show_window(app);
                }
            }
            "reload" => {
                if let Some(window) = main_window(app) {
                    let _ = window.eval("location.reload()");
                }
            }
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
                .with_state_flags(StateFlags::all().difference(StateFlags::VISIBLE))
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if *shortcut == toggle_window_shortcut() {
                        toggle_window(app);
                    } else if *shortcut == toggle_pin_shortcut() {
                        toggle_pinned(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle();
            build_tray(handle)?;
            build_main_window(handle)?;
            for (shortcut, label) in [
                (toggle_window_shortcut(), "Ctrl+Alt+N"),
                (toggle_pin_shortcut(), "Ctrl+Alt+T"),
            ] {
                if let Err(err) = app.global_shortcut().register(shortcut) {
                    eprintln!("快捷键 {label} 注册失败：{err}");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 NZM Wiki 桌面端失败");
}

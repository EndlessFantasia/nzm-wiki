use std::{sync::Mutex, thread, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_updater::{Update, UpdaterExt};

// 启动后稍等再查，避免和站点首屏抢网络；常驻期间每 6 小时再查一次
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(20);
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    version: String,
    notes: Option<String>,
}

impl AppUpdateInfo {
    fn of(update: &Update) -> Self {
        Self { version: update.version.clone(), notes: update.body.clone().filter(|body| !body.trim().is_empty()) }
    }

    pub fn version(&self) -> &str {
        &self.version
    }
}

#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

impl PendingUpdate {
    pub fn info(&self) -> Option<AppUpdateInfo> {
        self.0.lock().unwrap().as_ref().map(AppUpdateInfo::of)
    }
}

fn dispatch(window: Option<WebviewWindow>, event: &str, detail: impl Serialize) {
    let (Some(window), Ok(detail)) = (window, serde_json::to_string(&detail)) else { return };
    let _ = window.eval(format!("window.dispatchEvent(new CustomEvent('{event}', {{ detail: {detail} }}))"));
}

pub async fn check(app: &AppHandle, on_found: impl FnOnce(&AppUpdateInfo)) -> Result<Option<AppUpdateInfo>, String> {
    let update = app.updater().map_err(|err| err.to_string())?.check().await.map_err(|err| err.to_string())?;
    let info = update.as_ref().map(AppUpdateInfo::of);
    *app.state::<PendingUpdate>().0.lock().unwrap() = update;
    if let Some(info) = &info {
        on_found(info);
        dispatch(app.get_webview_window(crate::MAIN_WINDOW), "nzm-desktop:app-update-available", info);
    }
    Ok(info)
}

#[derive(Serialize)]
struct Progress {
    downloaded: usize,
    total: Option<u64>,
}

// Windows 上安装包启动后进程会退出，安装完成由安装包重新启动应用
pub async fn install(app: &AppHandle) -> Result<(), String> {
    let update = app.state::<PendingUpdate>().0.lock().unwrap().clone().ok_or("没有可安装的更新")?;
    let window = app.get_webview_window(crate::MAIN_WINDOW);
    let mut downloaded = 0;
    let mut reported_percent = None;
    update
        .download_and_install(
            |chunk, total| {
                downloaded += chunk;
                // 按整数百分比节流，避免逐块向页面派发事件
                let percent = total.map(|total| downloaded as u64 * 100 / total.max(1));
                if percent != reported_percent || total.is_none() {
                    reported_percent = percent;
                    dispatch(window.clone(), "nzm-desktop:app-update-progress", Progress { downloaded, total });
                }
            },
            || {},
        )
        .await
        .map_err(|err| err.to_string())
}

pub fn spawn_background_checks(app: AppHandle, on_found: fn(&AppHandle, &AppUpdateInfo)) {
    thread::spawn(move || {
        thread::sleep(FIRST_CHECK_DELAY);
        loop {
            let handle = app.clone();
            let _ = tauri::async_runtime::block_on(check(&app, |info| on_found(&handle, info)));
            thread::sleep(CHECK_INTERVAL);
        }
    });
}

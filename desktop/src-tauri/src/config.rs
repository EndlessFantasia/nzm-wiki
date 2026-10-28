use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
};

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("settings.json"))
}

pub fn read(app: &AppHandle) -> Map<String, Value> {
    config_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

// 只改写一个字段，保留文件中由其他模块维护的字段
pub fn write(app: &AppHandle, key: &str, value: Value) {
    let Some(path) = config_path(app) else { return };
    let mut config = read(app);
    config.insert(key.into(), value);
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(text) = serde_json::to_string_pretty(&config) {
        let _ = fs::write(path, text);
    }
}

const CLOSE_TO_TRAY: &str = "closeToTray";

pub struct Preferences {
    close_to_tray: AtomicBool,
}

impl Preferences {
    pub fn load(app: &AppHandle) -> Self {
        let close_to_tray = read(app).get(CLOSE_TO_TRAY).and_then(Value::as_bool).unwrap_or(true);
        Self { close_to_tray: AtomicBool::new(close_to_tray) }
    }

    pub fn close_to_tray(&self) -> bool {
        self.close_to_tray.load(Ordering::Relaxed)
    }

    pub fn set_close_to_tray(&self, app: &AppHandle, enabled: bool) {
        self.close_to_tray.store(enabled, Ordering::Relaxed);
        write(app, CLOSE_TO_TRAY, Value::Bool(enabled));
    }
}

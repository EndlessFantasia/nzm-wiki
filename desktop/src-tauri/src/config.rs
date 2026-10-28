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

// 桌面端缓存：关闭窗口时常驻托盘，站点在后台检测新部署并刷新；关闭后行为与 Edge 打开站点一致
const DESKTOP_CACHE: &str = "desktopCache";

pub struct Preferences {
    desktop_cache: AtomicBool,
}

impl Preferences {
    pub fn load(app: &AppHandle) -> Self {
        let desktop_cache = read(app).get(DESKTOP_CACHE).and_then(Value::as_bool).unwrap_or(true);
        Self { desktop_cache: AtomicBool::new(desktop_cache) }
    }

    pub fn desktop_cache(&self) -> bool {
        self.desktop_cache.load(Ordering::Relaxed)
    }

    pub fn set_desktop_cache(&self, app: &AppHandle, enabled: bool) {
        self.desktop_cache.store(enabled, Ordering::Relaxed);
        write(app, DESKTOP_CACHE, Value::Bool(enabled));
    }
}

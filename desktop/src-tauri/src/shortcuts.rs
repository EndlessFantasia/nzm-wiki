use std::{collections::HashMap, fs, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Modifiers, Shortcut};

#[derive(Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    ToggleWindow,
    TogglePin,
}

impl Action {
    const ALL: [Action; 2] = [Action::ToggleWindow, Action::TogglePin];

    fn label(self) -> &'static str {
        match self {
            Action::ToggleWindow => "显示/隐藏窗口",
            Action::TogglePin => "切换窗口置顶",
        }
    }

    pub fn default_keys(self) -> Option<&'static str> {
        match self {
            Action::ToggleWindow => Some("Ctrl+Alt+N"),
            Action::TogglePin => None,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutInfo {
    action: Action,
    label: &'static str,
    keys: Option<String>,
    default_keys: Option<&'static str>,
    registered: bool,
}

struct Bound {
    keys: String,
    shortcut: Shortcut,
}

struct Binding {
    action: Action,
    bound: Option<Bound>,
    registered: bool,
}

impl Binding {
    fn shortcut(&self) -> Option<Shortcut> {
        self.bound.as_ref().map(|bound| bound.shortcut)
    }
}

// 配置中缺省的动作使用默认键，值为 null 表示用户取消了绑定
#[derive(Default, Serialize, Deserialize)]
struct Config {
    #[serde(default)]
    shortcuts: HashMap<Action, Option<String>>,
}

// 只接受带 Ctrl/Alt 的组合或单独的功能键，避免站点把普通打字按键注册成全局热键
fn parse_keys(keys: &str) -> Result<Shortcut, String> {
    let shortcut: Shortcut = keys.parse().map_err(|_| format!("无法识别的组合键：{keys}"))?;
    if shortcut.mods.contains(Modifiers::SUPER) {
        return Err("不支持 Win 键组合".into());
    }
    let key = format!("{:?}", shortcut.key);
    let is_function_key = key.len() > 1 && key.starts_with('F') && key[1..].bytes().all(|b| b.is_ascii_digit());
    if !is_function_key && !shortcut.mods.intersects(Modifiers::CONTROL | Modifiers::ALT) {
        return Err("组合键需要包含 Ctrl 或 Alt，功能键 F1–F24 除外".into());
    }
    Ok(shortcut)
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("settings.json"))
}

fn default_bindings() -> Vec<Binding> {
    Action::ALL
        .into_iter()
        .map(|action| Binding {
            action,
            bound: action.default_keys().map(|keys| Bound {
                keys: keys.into(),
                shortcut: parse_keys(keys).unwrap(),
            }),
            registered: false,
        })
        .collect()
}

pub struct Shortcuts(Mutex<Vec<Binding>>);

impl Shortcuts {
    pub fn load(app: &AppHandle) -> Self {
        let config: Config = config_path(app)
            .and_then(|path| fs::read_to_string(path).ok())
            .and_then(|text| serde_json::from_str(&text).ok())
            .unwrap_or_default();
        let mut bindings: Vec<Binding> = Vec::new();
        for action in Action::ALL {
            let keys = match config.shortcuts.get(&action) {
                Some(saved) => saved.clone(),
                None => action.default_keys().map(String::from),
            };
            let bound = keys.and_then(|keys| {
                let shortcut = parse_keys(&keys).ok()?;
                let taken = bindings.iter().any(|binding| binding.shortcut() == Some(shortcut));
                (!taken).then_some(Bound { keys, shortcut })
            });
            bindings.push(Binding { action, bound, registered: false });
        }
        Self(Mutex::new(bindings))
    }

    pub fn keys(&self, action: Action) -> Option<String> {
        let bindings = self.0.lock().unwrap();
        let binding = bindings.iter().find(|binding| binding.action == action).unwrap();
        binding.bound.as_ref().map(|bound| bound.keys.clone())
    }

    pub fn action_for(&self, shortcut: &Shortcut) -> Option<Action> {
        let bindings = self.0.lock().unwrap();
        bindings
            .iter()
            .find(|binding| binding.shortcut() == Some(*shortcut))
            .map(|binding| binding.action)
    }

    pub fn infos(&self) -> Vec<ShortcutInfo> {
        let bindings = self.0.lock().unwrap();
        bindings
            .iter()
            .map(|binding| ShortcutInfo {
                action: binding.action,
                label: binding.action.label(),
                keys: binding.bound.as_ref().map(|bound| bound.keys.clone()),
                default_keys: binding.action.default_keys(),
                registered: binding.registered,
            })
            .collect()
    }

    pub fn register_all(&self, app: &AppHandle) {
        let mut bindings = self.0.lock().unwrap();
        for binding in bindings.iter_mut().filter(|binding| !binding.registered) {
            if let Some(shortcut) = binding.shortcut() {
                binding.registered = app.global_shortcut().register(shortcut).is_ok();
            }
        }
    }

    pub fn unregister_all(&self, app: &AppHandle) {
        let mut bindings = self.0.lock().unwrap();
        for binding in bindings.iter_mut().filter(|binding| binding.registered) {
            if let Some(shortcut) = binding.shortcut() {
                let _ = app.global_shortcut().unregister(shortcut);
            }
            binding.registered = false;
        }
    }

    // keys 为 None 时取消绑定；新组合注册失败时保留原绑定
    pub fn set(&self, app: &AppHandle, action: Action, keys: Option<String>) -> Result<(), String> {
        let shortcut = keys.as_deref().map(parse_keys).transpose()?;
        {
            let mut bindings = self.0.lock().unwrap();
            if let Some(other) = bindings
                .iter()
                .find(|binding| binding.action != action && shortcut.is_some() && binding.shortcut() == shortcut)
            {
                return Err(format!("与「{}」的快捷键相同", other.action.label()));
            }
            let binding = bindings.iter_mut().find(|binding| binding.action == action).unwrap();
            if binding.shortcut() != shortcut {
                let global = app.global_shortcut();
                let previous = binding.shortcut();
                let was_registered = binding.registered;
                if let (true, Some(previous)) = (was_registered, previous) {
                    let _ = global.unregister(previous);
                }
                binding.registered = false;
                if let Some(shortcut) = shortcut {
                    if global.register(shortcut).is_err() {
                        if let (true, Some(previous)) = (was_registered, previous) {
                            binding.registered = global.register(previous).is_ok();
                        }
                        return Err("该组合键已被其他程序占用".into());
                    }
                    binding.registered = true;
                }
            }
            binding.bound = keys.zip(shortcut).map(|(keys, shortcut)| Bound { keys, shortcut });
        }
        self.save(app);
        Ok(())
    }

    pub fn reset(&self, app: &AppHandle) {
        self.unregister_all(app);
        *self.0.lock().unwrap() = default_bindings();
        self.register_all(app);
        self.save(app);
    }

    fn save(&self, app: &AppHandle) {
        let Some(path) = config_path(app) else { return };
        let config = Config {
            shortcuts: self
                .0
                .lock()
                .unwrap()
                .iter()
                .map(|binding| (binding.action, binding.bound.as_ref().map(|bound| bound.keys.clone())))
                .collect(),
        };
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(&config) {
            let _ = fs::write(path, text);
        }
    }
}

fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_settings_state",
            "set_pinned",
            "set_shortcut",
            "reset_shortcuts",
            "set_shortcuts_paused",
        ]),
    ))
    .expect("failed to run tauri-build");
}

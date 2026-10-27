fn main() {
    // tauri-build 不监听图标文件，换图标后需要重新嵌入 exe 资源
    println!("cargo:rerun-if-changed=icons");
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

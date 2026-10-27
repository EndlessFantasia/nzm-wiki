fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["get_settings_state", "set_pinned"]),
    ))
    .expect("failed to run tauri-build");
}

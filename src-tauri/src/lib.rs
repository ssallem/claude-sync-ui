mod commands;
mod github;
mod parse;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::init,
            commands::status,
            commands::push,
            commands::pull,
            commands::doctor,
            commands::set_remote,
            commands::create_default_stowignore,
            commands::read_stowignore,
            commands::github_device_start,
            commands::github_device_poll,
            commands::github_is_logged_in,
            commands::github_logout,
            commands::github_create_repo
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

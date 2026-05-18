mod commands;
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
            commands::set_remote
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

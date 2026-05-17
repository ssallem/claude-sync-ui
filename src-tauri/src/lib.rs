mod commands;
mod parse;

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

// Sidecar smoke test: spawn `claude-sync --version` and collect stdout.
// Kept around as a debug probe even though Day 2 ships the real commands.
#[tauri::command]
async fn sidecar_version(app: AppHandle) -> Result<String, String> {
    let sidecar = app
        .shell()
        .sidecar("claude-sync")
        .map_err(|e| e.to_string())?
        .args(["--version"]);

    let (mut rx, _child) = sidecar.spawn().map_err(|e| e.to_string())?;

    let mut stdout = String::new();
    let mut stderr = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => stdout.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Stderr(bytes) => stderr.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Terminated(payload) => {
                if payload.code.unwrap_or(-1) != 0 {
                    return Err(format!("sidecar exited {:?}: {}", payload.code, stderr.trim()));
                }
                break;
            }
            _ => {}
        }
    }
    Ok(stdout.trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            sidecar_version,
            commands::init,
            commands::status,
            commands::push,
            commands::pull,
            commands::doctor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

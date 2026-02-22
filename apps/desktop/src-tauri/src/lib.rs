use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State};

struct ApiState {
    port: u16,
    child: Mutex<Option<std::process::Child>>,
}

#[derive(Serialize)]
struct ApiInfo {
    port: u16,
    url: String,
}

#[tauri::command]
fn get_api_info(state: State<ApiState>) -> ApiInfo {
    ApiInfo {
        port: state.port,
        url: format!("http://localhost:{}", state.port),
    }
}

#[tauri::command]
async fn start_api_server(state: State<'_, ApiState>) -> Result<String, String> {
    {
        let child_lock = state.child.lock().map_err(|e| e.to_string())?;
        if child_lock.is_some() {
            return Ok(format!("API server already running on port {}", state.port));
        }
    }

    let port = state.port;
    let child = std::process::Command::new("bun")
        .args([
            "run",
            "apps/tui/src/index.tsx",
            "api",
            "--port",
            &port.to_string(),
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start API server: {}", e))?;

    {
        let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
        *child_lock = Some(child);
    }

    let url = format!("http://localhost:{}/health", port);
    let client = reqwest::Client::new();
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return Ok(format!("API server started on port {}", port));
            }
        }
    }

    Err("API server failed to start within 15 seconds".to_string())
}

#[tauri::command]
async fn stop_api_server(state: State<'_, ApiState>) -> Result<String, String> {
    let mut child_lock = state.child.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = child_lock.take() {
        child.kill().map_err(|e| format!("Failed to kill: {}", e))?;
        Ok("API server stopped".to_string())
    } else {
        Ok("No API server running".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ApiState {
            port: 3838,
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            get_api_info,
            start_api_server,
            stop_api_server,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ApiState>() {
                    if let Ok(mut child_lock) = state.child.lock() {
                        if let Some(mut child) = child_lock.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn show_notification(app_handle: &AppHandle, title: &str, body: &str) -> Result<(), String> {
    app_handle
        .notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("Notification error: {}", e))?;
    Ok(())
}

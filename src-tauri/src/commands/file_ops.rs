use std::path::Path;
use tauri::{AppHandle, Manager};

use crate::utils::process::hidden_command;

#[tauri::command]
pub fn convert_file_src(_app_handle: AppHandle, file_path: String) -> Result<String, String> {
    let url =
        tauri::Url::from_file_path(&file_path).map_err(|_| "Invalid file path".to_string())?;
    Ok(url.to_string())
}

#[tauri::command]
pub async fn allow_video_asset_path(
    app_handle: AppHandle,
    file_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = Path::new(&file_path);

        if !path.exists() {
            return Err(format!("File does not exist: {}", file_path));
        }

        app_handle
            .asset_protocol_scope()
            .allow_file(path)
            .map_err(|e| format!("Failed to allow asset protocol access: {}", e))
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        hidden_command("explorer")
            .arg(format!("/select,{}", file_path))
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let parent = std::path::Path::new(&file_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| file_path.clone());
        hidden_command("open")
            .args([&parent])
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&file_path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| file_path.clone());
        hidden_command("xdg-open")
            .args([&parent])
            .spawn()
            .map_err(|e| format!("Failed to open file location: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_file_externally(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        hidden_command("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        hidden_command("open")
            .args([&file_path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        hidden_command("xdg-open")
            .args([&file_path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn check_file_exists(file_path: String) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(std::path::Path::new(&file_path).exists()))
        .await
        .map_err(|error| error.to_string())?
}

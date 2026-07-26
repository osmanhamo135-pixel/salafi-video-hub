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

/// Reveals a file in the OS file manager.
///
/// On Windows `explorer /select,<path>` is spawned directly rather than through
/// a shell, so `&` in a filename is never treated as a command separator.
/// Explorer parses its own command line and wants the path quoted as one token,
/// which Rust's default quoting would not produce for `/select,<path>` — hence
/// `raw_arg` with explicit quotes.
#[tauri::command]
pub fn open_file_location(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // A Windows path can never contain a quote, so rejecting one costs
        // nothing and removes any way to close the quoted argument early.
        if file_path.contains('"') {
            return Err("File path contains an unsupported character".to_string());
        }
        if !Path::new(&file_path).exists() {
            return Err(format!("File does not exist: {}", file_path));
        }

        hidden_command("explorer")
            .raw_arg(format!("/select,\"{}\"", file_path))
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

/// Opens a file with the OS default handler.
///
/// This deliberately does not shell out through `cmd /C start`. Rust only
/// quotes an argument containing spaces or tabs, so a path such as
/// `C:\videos\lesson&calc.mp4` reached `cmd` unquoted and `&` was parsed as a
/// command separator. Downloaded filenames come from remote video titles, so
/// that was arbitrary command execution from an attacker-chosen name, not just
/// a failed open. Spawning the handler directly passes the path as a single
/// argv entry, with no command line for it to escape from.
#[tauri::command]
pub fn open_file_externally(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        hidden_command("explorer")
            .arg(&file_path)
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

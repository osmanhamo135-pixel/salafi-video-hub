use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn get_app_data_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}

pub fn ensure_app_data_dirs(app_handle: &AppHandle) -> Result<(), String> {
    let app_data = get_app_data_dir(app_handle)?;

    let dirs = [
        app_data.clone(),
        app_data.join("media-cache"),
        app_data.join("media-cache").join("thumbnails"),
        app_data.join("backups"),
    ];

    for dir in &dirs {
        std::fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create directory {:?}: {}", dir, e))?;
    }

    Ok(())
}

pub fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    get_app_data_dir(app_handle)
        .unwrap_or_else(|_| {
            dirs::data_dir()
                .unwrap_or_default()
                .join("com.salafivideohub.app")
        })
        .join("salafi_video_hub.db")
}

pub fn get_thumbnail_cache_dir(app_handle: &AppHandle) -> PathBuf {
    get_app_data_dir(app_handle)
        .unwrap_or_else(|_| {
            dirs::data_dir()
                .unwrap_or_default()
                .join("com.salafivideohub.app")
        })
        .join("media-cache")
        .join("thumbnails")
}

pub fn get_backup_dir(app_handle: &AppHandle) -> PathBuf {
    get_app_data_dir(app_handle)
        .unwrap_or_else(|_| {
            dirs::data_dir()
                .unwrap_or_default()
                .join("com.salafivideohub.app")
        })
        .join("backups")
}

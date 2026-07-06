use crate::db::DbState;
use crate::models::playlist::Playlist;
use crate::models::reminder::Reminder;
use crate::models::settings::Settings;
use crate::models::video::Video;
use crate::utils::ffmpeg_finder;
use tauri::Emitter;
use tauri::Manager;
use tauri::State;

#[derive(serde::Deserialize)]
struct BackupPayload {
    #[serde(default)]
    videos: Vec<Video>,
    #[serde(default)]
    playlists: Vec<Playlist>,
    #[serde(default)]
    reminders: Vec<Reminder>,
    settings: Option<Settings>,
}

#[tauri::command]
pub async fn get_settings(db: State<'_, DbState>) -> Result<Settings, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::settings::get_settings(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_settings(
    db: State<'_, DbState>,
    settings: Settings,
) -> Result<Settings, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::settings::update_settings(&db, &settings).map_err(|e| e.to_string())?;
        Ok(settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn add_imported_folder(db: State<'_, DbState>, path: String) -> Result<Settings, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::settings::add_imported_folder(&db, &path).map_err(|e| e.to_string())?;
        crate::db::settings::get_settings(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_imported_folder(
    db: State<'_, DbState>,
    path: String,
) -> Result<Settings, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::settings::remove_imported_folder(&db, &path).map_err(|e| e.to_string())?;
        crate::db::settings::get_settings(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_ffmpeg_status(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (ffmpeg_path, ffprobe_path, status, version) =
            ffmpeg_finder::detect_ffmpeg_for_app(&app_handle);
        Ok(serde_json::json!({
            "ffmpegPath": ffmpeg_path,
            "ffprobePath": ffprobe_path,
            "status": status,
            "version": version,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn set_ffmpeg_path(db: State<'_, DbState>, path: String) -> Result<Settings, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut settings = crate::db::settings::get_settings(&db).map_err(|e| e.to_string())?;
        settings.ffmpeg_path = Some(path.clone());
        settings.ffprobe_path = Some(
            path.replace("ffmpeg", "ffprobe")
                .replace("FFmpeg", "FFprobe"),
        );
        settings.ffmpeg_status = "system".to_string();
        crate::db::settings::update_settings(&db, &settings).map_err(|e| e.to_string())?;
        Ok(settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn get_app_data_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    app_handle
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_backup(db: State<'_, DbState>) -> Result<String, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("No data dir")?
        .join("com.salafivideohub.app");

    let backup_dir = app_data_dir.join("backups");
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_path = backup_dir.join(format!("backup_{}.json", timestamp));

    let videos = crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())?;
    let playlists = crate::db::playlist::get_all_playlists(&db).map_err(|e| e.to_string())?;
    let reminders = crate::db::reminder::get_all_reminders(&db).map_err(|e| e.to_string())?;
    let settings = crate::db::settings::get_settings(&db).map_err(|e| e.to_string())?;

    let backup = serde_json::json!({
        "version": "1.0.0",
        "exported_at": chrono::Utc::now().timestamp_millis(),
        "videos": videos,
        "playlists": playlists,
        "reminders": reminders,
        "settings": settings,
    });

    std::fs::write(
        &backup_path,
        serde_json::to_string_pretty(&backup).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(backup_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_backup(db: State<'_, DbState>, path: String) -> Result<(), String> {
    let backup_json =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read backup file: {}", e))?;
    let backup: BackupPayload =
        serde_json::from_str(&backup_json).map_err(|e| format!("Invalid backup JSON: {}", e))?;

    for video in backup.videos {
        if crate::db::video::get_video_by_id(&db, &video.id)
            .map_err(|e| e.to_string())?
            .is_some()
        {
            crate::db::video::update_video(&db, &video).map_err(|e| e.to_string())?;
        } else {
            crate::db::video::insert_video(&db, &video).map_err(|e| e.to_string())?;
        }
    }

    for playlist in backup.playlists {
        crate::db::playlist::insert_playlist(&db, &playlist).map_err(|e| e.to_string())?;
    }

    for reminder in backup.reminders {
        crate::db::reminder::insert_reminder(&db, &reminder).map_err(|e| e.to_string())?;
    }

    if let Some(mut settings) = backup.settings {
        if settings.id.trim().is_empty() {
            settings.id = "default".to_string();
        }
        crate::db::settings::update_settings(&db, &settings).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn rescan_all(
    app_handle: tauri::AppHandle,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let settings = crate::db::settings::get_settings(&db).map_err(|e| e.to_string())?;
    let automatic_thumbnails_mode = settings.automatic_thumbnails_mode.clone();
    let mut imported_count = 0usize;
    let mut skipped_count = 0usize;
    let mut failed_count = 0usize;
    let mut errors = Vec::new();
    let mut thumbnail_ids = Vec::new();

    for folder in settings.imported_folders {
        match crate::services::scanner::import_folder(&db, &folder, true) {
            Ok(outcome) => {
                imported_count += outcome.result.imported_count;
                skipped_count += outcome.result.skipped_count;
                failed_count += outcome.result.failed_count;
                errors.extend(outcome.result.errors);
                thumbnail_ids.extend(outcome.video_ids_for_background);
            }
            Err(error) => {
                failed_count += 1;
                errors.push(format!("{}: {}", folder, error));
            }
        }
    }

    if automatic_thumbnails_mode != "disabled" {
        crate::services::thumbnail_gen::spawn_thumbnail_generation(
            app_handle.clone(),
            db.inner().clone(),
            thumbnail_ids,
        );
    }

    let result = serde_json::json!({
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "errors": errors,
    });

    let _ = app_handle.emit("import_finished", result.clone());
    Ok(result)
}

#[tauri::command]
pub fn repair_database(db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.lock().map_err(|_| "Database lock failed".to_string())?;
    let result: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    if result == "ok" {
        Ok(result)
    } else {
        Err(format!("SQLite integrity check failed: {}", result))
    }
}

#[tauri::command]
pub fn remove_orphaned_entries(db: State<'_, DbState>) -> Result<usize, String> {
    let videos = crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())?;
    let mut removed_ids = Vec::new();

    for video in videos {
        if !std::path::Path::new(&video.file_path).exists() {
            crate::db::video::delete_video(&db, &video.id).map_err(|e| e.to_string())?;
            removed_ids.push(video.id);
        }
    }

    if !removed_ids.is_empty() {
        let playlists = crate::db::playlist::get_all_playlists(&db).map_err(|e| e.to_string())?;
        for mut playlist in playlists {
            let original_len = playlist.video_ids.len();
            playlist
                .video_ids
                .retain(|id| !removed_ids.iter().any(|removed| removed == id));
            if playlist.video_ids.len() == original_len {
                continue;
            }

            let mut playlist_videos = Vec::new();
            for id in &playlist.video_ids {
                if let Some(video) =
                    crate::db::video::get_video_by_id(&db, id).map_err(|e| e.to_string())?
                {
                    playlist_videos.push(video);
                }
            }

            playlist.video_count = playlist_videos.len() as i64;
            playlist.total_duration_seconds = playlist_videos
                .iter()
                .map(|video| video.duration_seconds)
                .sum();
            playlist.progress_seconds = playlist_videos
                .iter()
                .map(|video| video.progress_seconds)
                .sum();
            playlist.thumbnail_path = playlist_videos
                .iter()
                .find_map(|video| video.thumbnail_path.clone());
            playlist.updated_at = chrono::Utc::now().timestamp_millis();
            crate::db::playlist::update_playlist(&db, &playlist).map_err(|e| e.to_string())?;
        }
    }

    Ok(removed_ids.len())
}

#[tauri::command]
pub fn play_sound(path: String, _volume: f64) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("No sound file selected".to_string());
    }
    if !std::path::Path::new(&path).exists() {
        return Err(format!("Sound file does not exist: {}", path));
    }

    crate::commands::file_ops::open_file_externally(path)
}

#[tauri::command]
pub fn open_app_data_folder(app_handle: tauri::AppHandle) -> Result<(), String> {
    let path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    crate::commands::file_ops::open_file_location(path.to_string_lossy().to_string())
}

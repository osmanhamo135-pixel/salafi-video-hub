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
        settings.ffprobe_path = Some(derive_ffprobe_path(&path));
        settings.ffmpeg_status = "system".to_string();
        crate::db::settings::update_settings(&db, &settings).map_err(|e| e.to_string())?;
        Ok(settings)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Derives the ffprobe path from a chosen ffmpeg path by swapping only the file
/// name, so a folder such as `C:\ffmpeg\bin\ffmpeg.exe` correctly maps to
/// `C:\ffmpeg\bin\ffprobe.exe` instead of rewriting the `ffmpeg` folder too.
fn derive_ffprobe_path(ffmpeg_path: &str) -> String {
    let path = std::path::Path::new(ffmpeg_path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("ffprobe.exe");
    let ffprobe_name = file_name
        .replace("ffmpeg", "ffprobe")
        .replace("FFmpeg", "FFprobe");

    match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => {
            parent.join(ffprobe_name).to_string_lossy().to_string()
        }
        _ => ffprobe_name,
    }
}

/// Whether this install can replace itself in place.
///
/// tauri-plugin-updater only implements self-update on Linux for AppImages —
/// it looks for the `APPIMAGE` env var the AppRun exports. A deb (or an rpm,
/// or a distro package) is owned by the system package manager, so the
/// updater's install step always throws there and the UI offered a Retry
/// button that could never succeed. Windows installs always self-update.
#[tauri::command]
pub fn updater_can_self_install() -> bool {
    #[cfg(windows)]
    {
        true
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("APPIMAGE").is_some()
    }
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
pub async fn export_backup(db: State<'_, DbState>) -> Result<String, String> {
    let db = db.inner().clone();
    // Serialising and writing a whole library is file I/O; off the main thread
    // like every other heavy command, or the window freezes for its duration.
    tauri::async_runtime::spawn_blocking(move || export_backup_blocking(&db))
        .await
        .map_err(|e| e.to_string())?
}

fn export_backup_blocking(db: &DbState) -> Result<String, String> {
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
pub async fn import_backup(db: State<'_, DbState>, path: String) -> Result<(), String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let backup_json = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read backup file: {}", e))?;
        let backup: BackupPayload =
            serde_json::from_str(&backup_json).map_err(|e| format!("Invalid backup JSON: {}", e))?;

        let mut conn = crate::db::lock_conn(&db);
        /* One transaction for the whole restore: a backup that fails half-way
           through must leave the library exactly as it was, never half-restored.
           rusqlite rolls the transaction back on drop, so every early return —
           and even a panic unwinding through here — lands back on the
           pre-import state. That drop-rollback is also what keeps lock_conn's
           poison recovery sound; see the note on lock_conn. */
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        apply_backup(&tx, backup)?;
        tx.commit().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn apply_backup(conn: &rusqlite::Connection, backup: BackupPayload) -> Result<(), String> {
    for video in backup.videos {
        /* Serde-level defaults are what let an older build's backup in at all;
           they also mean a malformed row can default its way to no identity.
           A video without an id or a path is not restorable data — skip the
           row rather than store it. */
        if video.id.trim().is_empty() || video.file_path.trim().is_empty() {
            continue;
        }
        if crate::db::video::get_video_by_id_with_conn(conn, &video.id)
            .map_err(|e| e.to_string())?
            .is_some()
        {
            crate::db::video::update_video_with_conn(conn, &video).map_err(|e| e.to_string())?;
        } else {
            crate::db::video::insert_video_with_conn(conn, &video).map_err(|e| e.to_string())?;
        }
    }

    for playlist in backup.playlists {
        if playlist.id.trim().is_empty() {
            continue;
        }
        crate::db::playlist::insert_playlist_with_conn(conn, &playlist)
            .map_err(|e| e.to_string())?;
    }

    for reminder in backup.reminders {
        if reminder.id.trim().is_empty() {
            continue;
        }
        crate::db::reminder::insert_reminder_with_conn(conn, &reminder)
            .map_err(|e| e.to_string())?;
    }

    if let Some(mut settings) = backup.settings {
        if settings.id.trim().is_empty() {
            settings.id = "default".to_string();
        }
        crate::db::settings::update_settings_with_conn(conn, &settings)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn rescan_all(
    app_handle: tauri::AppHandle,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let db = db.inner().clone();
    // Walking every imported folder is filesystem I/O proportional to the
    // library; on the main thread it froze the UI for the whole rescan.
    tauri::async_runtime::spawn_blocking(move || rescan_all_blocking(app_handle, &db))
        .await
        .map_err(|e| e.to_string())?
}

fn rescan_all_blocking(
    app_handle: tauri::AppHandle,
    db: &DbState,
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
            db.clone(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    fn test_db() -> DbState {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        let db: DbState = Arc::new(Mutex::new(conn));
        crate::db::schema::create_tables(&db).unwrap();
        db
    }

    /// A backup written before `playable_status` / `codec_info` / `watch_later`
    /// existed must still restore. Rejecting the whole file over fields the old
    /// build could not have written threw away the user's restorable library.
    #[test]
    fn old_backup_missing_new_fields_still_imports() {
        let db = test_db();
        let json = r#"{
            "videos": [{
                "id": "v1", "title": "lesson", "filePath": "/x/a.mp4",
                "folderPath": "/x", "fileName": "a.mp4", "extension": "mp4",
                "durationSeconds": 60, "thumbnailPath": null,
                "thumbnailStatus": "missing", "category": null, "speaker": null,
                "description": null, "progressSeconds": 0, "completed": false,
                "favorite": false, "fileSize": 1, "modifiedAt": 0,
                "createdAt": 0, "updatedAt": 0, "lastPlayedAt": null
            }, {
                "title": "a row with no identity is skipped, not stored"
            }],
            "playlists": [], "reminders": [], "settings": null
        }"#;
        let backup: BackupPayload = serde_json::from_str(json).expect("old backup parses");

        let mut conn = crate::db::lock_conn(&db);
        let tx = conn.transaction().unwrap();
        apply_backup(&tx, backup).unwrap();
        tx.commit().unwrap();
        drop(conn);

        let videos = crate::db::video::get_all_videos(&db).unwrap();
        assert_eq!(videos.len(), 1, "the identity-less row must be skipped");
        assert_eq!(videos[0].id, "v1");
        // The fields the old build never wrote arrive as their defaults.
        assert_eq!(videos[0].playable_status, "unknown");
        assert!(!videos[0].watch_later);
    }

    /// The restore is one transaction. Dropping it uncommitted — an early
    /// return, an error, a panic unwinding through the import — must leave the
    /// library exactly as it was.
    #[test]
    fn uncommitted_restore_leaves_no_trace() {
        let db = test_db();
        let backup: BackupPayload = serde_json::from_str(
            r#"{"videos":[{"id":"v1","filePath":"/x/a.mp4"}]}"#,
        )
        .unwrap();
        {
            let mut conn = crate::db::lock_conn(&db);
            let tx = conn.transaction().unwrap();
            apply_backup(&tx, backup).unwrap();
            // No commit: the drop IS the rollback import_backup relies on.
        }
        assert!(crate::db::video::get_all_videos(&db).unwrap().is_empty());
    }
}

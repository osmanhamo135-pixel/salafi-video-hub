use crate::db::DbState;
use crate::models::playlist::Playlist;
use tauri::State;

#[tauri::command]
pub async fn get_all_playlists(db: State<'_, DbState>) -> Result<Vec<Playlist>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::playlist::get_all_playlists(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_playlist(db: State<'_, DbState>, id: String) -> Result<Option<Playlist>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::playlist::get_playlist_by_id(&db, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn update_playlist_name(
    db: State<'_, DbState>,
    id: String,
    name: String,
) -> Result<Playlist, String> {
    let mut playlist = crate::db::playlist::get_playlist_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Playlist not found")?;
    playlist.name = name;
    playlist.updated_at = chrono::Utc::now().timestamp_millis();
    crate::db::playlist::update_playlist(&db, &playlist).map_err(|e| e.to_string())?;
    Ok(playlist)
}

#[tauri::command]
pub fn update_playlist_category(
    db: State<'_, DbState>,
    id: String,
    category: String,
) -> Result<Playlist, String> {
    let mut playlist = crate::db::playlist::get_playlist_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Playlist not found")?;
    playlist.category = Some(category);
    playlist.updated_at = chrono::Utc::now().timestamp_millis();
    crate::db::playlist::update_playlist(&db, &playlist).map_err(|e| e.to_string())?;
    Ok(playlist)
}

#[tauri::command]
pub fn remove_playlist_from_library(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let playlist = crate::db::playlist::get_playlist_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Playlist not found")?;

    // Remove all videos in this playlist
    for video_id in &playlist.video_ids {
        let _ = crate::db::video::delete_video(&db, video_id);
    }
    let _ = crate::db::video::delete_videos_by_folder(&db, &playlist.folder_path);

    crate::db::playlist::delete_playlist(&db, &id).map_err(|e| e.to_string())?;

    // Remove from imported folders
    let _ = crate::db::settings::remove_imported_folder(&db, &playlist.folder_path);

    Ok(())
}

#[tauri::command]
pub fn delete_playlist_and_files(_db: State<'_, DbState>, _id: String) -> Result<(), String> {
    Err("Deleting video files from disk is disabled. Use Remove from library to keep files safe.".to_string())
}

#[tauri::command]
pub fn rescan_playlist(db: State<'_, DbState>, id: String) -> Result<Playlist, String> {
    let playlist = crate::db::playlist::get_playlist_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Playlist not found")?;

    crate::services::scanner::rescan_folder(&db, &playlist.folder_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlist_stats(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (total_playlists, total_videos, total_duration, completed_videos) =
            crate::db::playlist::get_playlist_stats(&db).map_err(|e| e.to_string())?;

        Ok(serde_json::json!({
            "totalPlaylists": total_playlists,
            "totalVideos": total_videos,
            "totalDuration": total_duration,
            "completedVideos": completed_videos,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

use crate::db::DbState;
use crate::models::video::Video;
use tauri::Emitter;
use tauri::State;

#[tauri::command]
pub async fn save_progress(
    app_handle: tauri::AppHandle,
    db: State<'_, DbState>,
    video_id: String,
    progress_seconds: i64,
    completed: bool,
) -> Result<(), String> {
    let db = db.inner().clone();
    let event_video_id = video_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::update_video_progress(&db, &video_id, progress_seconds, completed)
            .map_err(|e| e.to_string())?;
        crate::db::playlist::refresh_progress_for_video(&db, &video_id)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())??;

    let _ = app_handle.emit(
        "progress_updated",
        serde_json::json!({
            "videoId": event_video_id,
            "progressSeconds": progress_seconds,
            "completed": completed,
        }),
    );

    Ok(())
}

#[tauri::command]
pub async fn get_progress(
    db: State<'_, DbState>,
    video_id: String,
) -> Result<serde_json::Value, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let video = crate::db::video::get_video_by_id(&db, &video_id)
            .map_err(|e| e.to_string())?
            .ok_or("Video not found")?;

        Ok(serde_json::json!({
            "progressSeconds": video.progress_seconds,
            "completed": video.completed,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_continue_watching(
    db: State<'_, DbState>,
    limit: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let videos =
            crate::db::video::get_continue_watching(&db, limit).map_err(|e| e.to_string())?;
        let playlists = crate::db::playlist::get_all_playlists(&db).map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for video in videos {
            let playlist = playlists.iter().find(|p| p.video_ids.contains(&video.id));

            result.push(serde_json::json!({
                "video": video,
                "playlist": playlist.cloned(),
            }));
        }

        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_recently_added(
    db: State<'_, DbState>,
    limit: i64,
) -> Result<Vec<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::get_recently_added(&db, limit).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

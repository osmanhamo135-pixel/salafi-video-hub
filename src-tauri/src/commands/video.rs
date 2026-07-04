use crate::db::DbState;
use crate::models::video::Video;
use crate::services::scanner;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::State;

#[tauri::command]
pub fn import_folder(
    app_handle: AppHandle,
    db: State<'_, DbState>,
    path: String,
    include_subfolders: bool,
) -> Result<scanner::ImportResult, String> {
    let outcome = scanner::import_folder(&db, &path, include_subfolders)?;
    let result = outcome.result.clone();
    if automatic_thumbnails_enabled(&db) {
        crate::services::thumbnail_gen::spawn_thumbnail_generation(
            app_handle.clone(),
            db.inner().clone(),
            outcome.video_ids_for_background,
        );
    }
    let _ = app_handle.emit("import_finished", result.clone());
    Ok(result)
}

#[tauri::command]
pub fn import_single_video(
    app_handle: AppHandle,
    db: State<'_, DbState>,
    path: String,
) -> Result<scanner::ImportResult, String> {
    let outcome = scanner::import_single_video(&db, &path)?;
    let result = outcome.result.clone();
    if automatic_thumbnails_enabled(&db) {
        crate::services::thumbnail_gen::spawn_thumbnail_generation(
            app_handle.clone(),
            db.inner().clone(),
            outcome.video_ids_for_background,
        );
    }
    let _ = app_handle.emit("import_finished", result.clone());
    Ok(result)
}

fn automatic_thumbnails_enabled(db: &DbState) -> bool {
    crate::db::settings::get_settings(db)
        .map(|settings| settings.automatic_thumbnails_mode != "disabled")
        .unwrap_or(true)
}

#[tauri::command]
pub async fn get_video(db: State<'_, DbState>, id: String) -> Result<Option<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::get_video_by_id(&db, &id).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_all_videos(db: State<'_, DbState>) -> Result<Vec<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_videos_by_ids(
    db: State<'_, DbState>,
    ids: Vec<String>,
) -> Result<Vec<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::get_videos_by_ids(&db, &ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_videos_by_playlist(
    db: State<'_, DbState>,
    playlist_id: String,
) -> Result<Vec<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let playlist = crate::db::playlist::get_playlist_by_id(&db, &playlist_id)
            .map_err(|e| e.to_string())?
            .ok_or("Playlist not found")?;

        crate::db::video::get_videos_by_ids(&db, &playlist.video_ids).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn update_video_progress(
    db: State<'_, DbState>,
    id: String,
    progress_seconds: i64,
    completed: bool,
) -> Result<(), String> {
    crate::db::video::update_video_progress(&db, &id, progress_seconds, completed)
        .map_err(|e| e.to_string())?;
    crate::db::playlist::refresh_progress_for_video(&db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_video_favorite(
    db: State<'_, DbState>,
    id: String,
    favorite: bool,
) -> Result<(), String> {
    crate::db::video::update_video_favorite(&db, &id, favorite).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_video_watch_later(
    db: State<'_, DbState>,
    id: String,
    watch_later: bool,
) -> Result<(), String> {
    crate::db::video::update_video_watch_later(&db, &id, watch_later).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_video_metadata(
    db: State<'_, DbState>,
    id: String,
    title: Option<String>,
    category: Option<String>,
    speaker: Option<String>,
) -> Result<Video, String> {
    let mut video = crate::db::video::get_video_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Video not found")?;

    if let Some(t) = title {
        video.title = t;
    }
    if let Some(c) = category {
        video.category = Some(c);
    }
    if let Some(s) = speaker {
        video.speaker = Some(s);
    }
    video.updated_at = chrono::Utc::now().timestamp_millis();

    crate::db::video::update_video(&db, &video).map_err(|e| e.to_string())?;
    Ok(video)
}

#[tauri::command]
pub async fn search_videos(db: State<'_, DbState>, query: String) -> Result<Vec<Video>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::video::search_videos(&db, &query).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn delete_video_from_library(db: State<'_, DbState>, id: String) -> Result<(), String> {
    crate::db::video::delete_video(&db, &id).map_err(|e| e.to_string())
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use hex;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::db::{self, DbState};
use crate::models::video::Video;
use crate::utils::ffmpeg_finder;
use crate::utils::paths::get_thumbnail_cache_dir;
use crate::utils::process::hidden_command;

static THUMBNAIL_JOB_LOCK: Mutex<()> = Mutex::new(());
static THUMBNAIL_PAUSED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
pub struct ThumbnailBatchResult {
    pub generated_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct ThumbnailBatchStarted {
    total: usize,
}

#[derive(Debug, Clone, Serialize)]
struct ThumbnailGenerated {
    #[serde(rename = "videoId")]
    video_id: String,
    #[serde(rename = "thumbnailPath")]
    thumbnail_path: Option<String>,
    #[serde(rename = "thumbnailStatus")]
    thumbnail_status: String,
    error: Option<String>,
}

pub fn set_thumbnail_generation_paused(paused: bool) {
    THUMBNAIL_PAUSED.store(paused, Ordering::Relaxed);
}

pub fn generate_thumbnail_for_video(
    app_handle: &AppHandle,
    video_path: &str,
) -> Result<Option<String>, String> {
    let (ffmpeg_path, _, status, _) = ffmpeg_finder::detect_ffmpeg();

    if status == "missing" {
        return Ok(None);
    }

    let ffmpeg = ffmpeg_path.ok_or("FFmpeg path not available")?;
    let cache_dir = get_thumbnail_cache_dir(app_handle);
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let modified = std::fs::metadata(video_path)
        .map(|metadata| {
            metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let hash_input = format!("{}_{}", video_path, modified);
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let hash = hex::encode(&hasher.finalize()[..8]);
    let thumb_path = cache_dir.join(format!("{}.jpg", hash));

    if thumb_path.exists() {
        let meta = std::fs::metadata(&thumb_path).map_err(|e| e.to_string())?;
        if meta.len() > 100 {
            return Ok(Some(thumb_path.to_string_lossy().to_string()));
        }
    }

    let output_path = thumb_path.to_string_lossy().to_string();
    for timestamp in ["0.1", "0.2", "1.0", "3.0"] {
        let result = hidden_command(&ffmpeg)
            .args([
                "-y",
                "-hide_banner",
                "-ss",
                timestamp,
                "-i",
                video_path,
                "-frames:v",
                "1",
                "-q:v",
                "2",
                "-vf",
                "blackframe=amount=90:threshold=32,scale=480:-1",
                &output_path,
            ])
            .output()
            .map_err(|e| format!("FFmpeg error: {}", e))?;

        if result.status.success() {
            let meta = std::fs::metadata(&thumb_path).map_err(|e| e.to_string())?;
            if meta.len() > 100 && !ffmpeg_reported_black_frame(&result.stderr) {
                return Ok(Some(output_path));
            }
        }

        let _ = std::fs::remove_file(&thumb_path);
    }

    Ok(None)
}

pub fn get_thumbnail_path(
    app_handle: &AppHandle,
    video_path: &str,
) -> Result<Option<String>, String> {
    let modified = std::fs::metadata(video_path)
        .map(|metadata| {
            metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as i64)
                .unwrap_or(0)
        })
        .unwrap_or(0);

    let hash_input = format!("{}_{}", video_path, modified);
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let hash = hex::encode(&hasher.finalize()[..8]);
    let thumb_path = get_thumbnail_cache_dir(app_handle).join(format!("{}.jpg", hash));

    if thumb_path.exists() {
        let meta = std::fs::metadata(&thumb_path).map_err(|e| e.to_string())?;
        if meta.len() > 100 {
            return Ok(Some(thumb_path.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}

pub fn spawn_thumbnail_generation(app_handle: AppHandle, db: DbState, video_ids: Vec<String>) {
    if video_ids.is_empty() {
        return;
    }

    thread::spawn(move || {
        let _ = generate_thumbnails_for_ids(app_handle, db, video_ids);
    });
}

pub fn generate_thumbnails_for_ids(
    app_handle: AppHandle,
    db: DbState,
    video_ids: Vec<String>,
) -> ThumbnailBatchResult {
    let _guard = match THUMBNAIL_JOB_LOCK.lock() {
        Ok(guard) => guard,
        Err(_) => {
            return ThumbnailBatchResult {
                generated_count: 0,
                skipped_count: 0,
                failed_count: video_ids.len(),
                errors: vec!["Thumbnail worker lock failed".to_string()],
            }
        }
    };

    let mut result = ThumbnailBatchResult {
        generated_count: 0,
        skipped_count: 0,
        failed_count: 0,
        errors: Vec::new(),
    };

    let mut seen = std::collections::HashSet::new();
    let unique_video_ids = video_ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .collect::<Vec<_>>();

    let _ = app_handle.emit(
        "thumbnail_batch_started",
        ThumbnailBatchStarted {
            total: unique_video_ids.len(),
        },
    );

    for video_id in unique_video_ids {

        while THUMBNAIL_PAUSED.load(Ordering::Relaxed) {
            thread::sleep(Duration::from_millis(1000));
        }

        match process_thumbnail_video(&app_handle, &db, &video_id) {
            Ok(ProcessOutcome::Generated) => result.generated_count += 1,
            Ok(ProcessOutcome::Skipped) => result.skipped_count += 1,
            Err(error) => {
                result.failed_count += 1;
                result.errors.push(error);
            }
        }

        if let Ok(Some(video)) = db::video::get_video_by_id(&db, &video_id) {
            let _ = app_handle.emit(
                "thumbnail_generated",
                ThumbnailGenerated {
                    video_id: video.id,
                    thumbnail_path: video.thumbnail_path,
                    thumbnail_status: video.thumbnail_status,
                    error: video.last_playback_error,
                },
            );
        }

        thread::sleep(Duration::from_millis(250));
    }

    let _ = app_handle.emit("thumbnail_batch_finished", result.clone());
    result
}

enum ProcessOutcome {
    Generated,
    Skipped,
}

fn process_thumbnail_video(
    app_handle: &AppHandle,
    db: &DbState,
    video_id: &str,
) -> Result<ProcessOutcome, String> {
    let Some(mut video) = db::video::get_video_by_id(db, video_id).map_err(|e| e.to_string())?
    else {
        return Ok(ProcessOutcome::Skipped);
    };

    if video.thumbnail_status == "ready" && thumbnail_file_exists(&video) {
        return Ok(ProcessOutcome::Skipped);
    }

    video.thumbnail_status = "generating".to_string();
    video.updated_at = chrono::Utc::now().timestamp_millis();
    db::video::update_video(db, &video).map_err(|e| e.to_string())?;

    apply_metadata(&mut video);

    match generate_thumbnail_for_video(app_handle, &video.file_path) {
        Ok(Some(thumbnail_path)) => {
            video.thumbnail_path = Some(thumbnail_path);
            video.thumbnail_status = "ready".to_string();
            video.last_playback_error = None;
        }
        Ok(None) => {
            video.thumbnail_path = None;
            video.thumbnail_status = "failed".to_string();
            video.last_playback_error =
                Some("FFmpeg could not extract a usable thumbnail frame".to_string());
        }
        Err(error) => {
            video.thumbnail_path = None;
            video.thumbnail_status = "failed".to_string();
            video.last_playback_error = Some(error.clone());
        }
    }

    video.updated_at = chrono::Utc::now().timestamp_millis();
    db::video::update_video(db, &video).map_err(|e| e.to_string())?;
    refresh_playlists_containing_video(db, &video.id)?;

    if video.thumbnail_status == "ready" {
        Ok(ProcessOutcome::Generated)
    } else {
        Err(format!(
            "{}: {}",
            video.file_name,
            video
                .last_playback_error
                .unwrap_or_else(|| "thumbnail generation failed".to_string())
        ))
    }
}

fn thumbnail_file_exists(video: &Video) -> bool {
    video
        .thumbnail_path
        .as_ref()
        .map(|path| {
            std::fs::metadata(path)
                .map(|metadata| metadata.len() > 100)
                .unwrap_or(false)
        })
        .unwrap_or(false)
}

fn ffmpeg_reported_black_frame(stderr: &[u8]) -> bool {
    let text = String::from_utf8_lossy(stderr);
    let Some(index) = text.find("pblack:") else {
        return false;
    };

    let value = text[index + "pblack:".len()..]
        .chars()
        .take_while(|ch| ch.is_ascii_digit() || *ch == '.')
        .collect::<String>();

    value
        .parse::<f64>()
        .map(|pblack| pblack >= 98.0)
        .unwrap_or(false)
}

fn apply_metadata(video: &mut Video) {
    let Ok(metadata) = crate::services::metadata::extract_metadata(&video.file_path) else {
        return;
    };

    if let Some(duration) = metadata.get("duration").and_then(|value| value.as_f64()) {
        if duration.is_finite() && duration > 0.0 {
            video.duration_seconds = duration.round() as i64;
        }
    }

    if let Some(file_size) = metadata.get("fileSize").and_then(|value| value.as_i64()) {
        if file_size > 0 {
            video.file_size = file_size;
        }
    }

    let codec_info = serde_json::json!({
        "width": metadata.get("width").and_then(|value| value.as_i64()).unwrap_or(0),
        "height": metadata.get("height").and_then(|value| value.as_i64()).unwrap_or(0),
        "container": metadata.get("container").and_then(|value| value.as_str()).unwrap_or(""),
        "videoCodec": metadata.get("videoCodec").and_then(|value| value.as_str()).unwrap_or(""),
        "audioCodec": metadata.get("audioCodec").and_then(|value| value.as_str()).unwrap_or(""),
    });
    video.codec_info = Some(codec_info.to_string());
    video.playable_status = "playable".to_string();
}

fn refresh_playlists_containing_video(db: &DbState, video_id: &str) -> Result<(), String> {
    let playlists = db::playlist::get_all_playlists(db).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();

    for mut playlist in playlists {
        if !playlist.video_ids.iter().any(|id| id == video_id) {
            continue;
        }

        let mut videos = Vec::with_capacity(playlist.video_ids.len());
        for id in &playlist.video_ids {
            if let Some(video) = db::video::get_video_by_id(db, id).map_err(|e| e.to_string())? {
                videos.push(video);
            }
        }

        playlist.video_count = videos.len() as i64;
        playlist.total_duration_seconds = videos.iter().map(|video| video.duration_seconds).sum();
        playlist.progress_seconds = videos.iter().map(|video| video.progress_seconds).sum();
        playlist.thumbnail_path = videos.iter().find_map(|video| video.thumbnail_path.clone());
        playlist.updated_at = now;
        db::playlist::update_playlist(db, &playlist).map_err(|e| e.to_string())?;
    }

    Ok(())
}

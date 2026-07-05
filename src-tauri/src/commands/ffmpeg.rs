use crate::db::DbState;
use crate::utils::ffmpeg_finder;
use crate::utils::paths::get_thumbnail_cache_dir;
use crate::utils::process::hidden_command;
use hex;
use sha2::{Digest, Sha256};
use tauri::State;

#[tauri::command]
pub fn detect_ffmpeg() -> Result<serde_json::Value, String> {
    let (ffmpeg_path, ffprobe_path, status, version) = ffmpeg_finder::detect_ffmpeg();
    Ok(serde_json::json!({
        "ffmpegPath": ffmpeg_path,
        "ffprobePath": ffprobe_path,
        "status": status,
        "version": version,
    }))
}

#[tauri::command]
pub fn generate_thumbnail(
    app_handle: tauri::AppHandle,
    video_path: String,
    _output_path: Option<String>,
    timestamp: f64,
) -> Result<String, String> {
    let (ffmpeg_path, _, status, _) = ffmpeg_finder::detect_ffmpeg();

    if status == "missing" {
        return Err("FFmpeg not found".to_string());
    }

    let ffmpeg = ffmpeg_path.ok_or("FFmpeg path not available")?;
    let cache_dir = get_thumbnail_cache_dir(&app_handle);
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    // Generate stable filename
    let metadata = std::fs::metadata(&video_path).map_err(|e| e.to_string())?;
    let modified = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64
        })
        .unwrap_or(0);

    let hash_input = format!("{}_{}", video_path, modified);
    let mut hasher = Sha256::new();
    hasher.update(hash_input.as_bytes());
    let hash = hex::encode(&hasher.finalize()[..8]);
    let thumb_name = format!("{}.jpg", hash);
    let thumb_path = cache_dir.join(&thumb_name);

    if thumb_path.exists() {
        let meta = std::fs::metadata(&thumb_path).map_err(|e| e.to_string())?;
        if meta.len() > 100 {
            return Ok(thumb_path.to_string_lossy().to_string());
        }
    }

    // Try the requested timestamp, then broader fallbacks for intros, black frames, and title cards.
    let timestamps = [timestamp, 0.1, 0.5, 1.0, 3.0, 8.0, 15.0];

    for &ts in &timestamps {
        let result = hidden_command(&ffmpeg)
            .args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                &format!("{:.1}", ts),
                "-i",
                &video_path,
                "-frames:v",
                "1",
                "-q:v",
                "2",
                "-vf",
                "scale=320:-1",
                thumb_path.to_str().unwrap(),
            ])
            .output()
            .map_err(|e| format!("FFmpeg error: {}", e))?;

        if result.status.success() && thumbnail_output_is_usable(&thumb_path) {
            return Ok(thumb_path.to_string_lossy().to_string());
        }

        let _ = std::fs::remove_file(&thumb_path);
    }

    Err("No usable thumbnail frame was extracted".to_string())
}

fn thumbnail_output_is_usable(path: &std::path::Path) -> bool {
    std::fs::metadata(path)
        .map(|metadata| metadata.len() > 100)
        .unwrap_or(false)
}

#[tauri::command]
pub async fn get_video_metadata(video_path: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || get_video_metadata_blocking(video_path))
        .await
        .map_err(|e| e.to_string())?
}

fn get_video_metadata_blocking(video_path: String) -> Result<serde_json::Value, String> {
    let (_, ffprobe_path, status, _) = ffmpeg_finder::detect_ffmpeg();

    if status == "missing" {
        return Err("FFprobe not found".to_string());
    }

    let ffprobe = ffprobe_path.ok_or("FFprobe path not available")?;

    let output = hidden_command(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &video_path,
        ])
        .output()
        .map_err(|e| format!("FFprobe error: {}", e))?;

    if !output.status.success() {
        return Err("FFprobe failed".to_string());
    }

    let json_str = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

    let format = json.get("format").ok_or("No format info")?;
    let container = format
        .get("format_name")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let duration = format
        .get("duration")
        .and_then(|d| d.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let mut width = 0;
    let mut height = 0;
    let mut video_codec = String::new();
    let mut audio_codec = String::new();

    if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
        for stream in streams {
            if let Some(codec_type) = stream.get("codec_type").and_then(|c| c.as_str()) {
                if codec_type == "video" {
                    width = stream.get("width").and_then(|w| w.as_i64()).unwrap_or(0) as i32;
                    height = stream.get("height").and_then(|h| h.as_i64()).unwrap_or(0) as i32;
                    video_codec = stream
                        .get("codec_name")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string();
                } else if codec_type == "audio" {
                    audio_codec = stream
                        .get("codec_name")
                        .and_then(|c| c.as_str())
                        .unwrap_or("")
                        .to_string();
                }
            }
        }
    }

    let file_size = std::fs::metadata(&video_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    Ok(serde_json::json!({
        "duration": duration,
        "container": container,
        "width": width,
        "height": height,
        "videoCodec": video_codec,
        "audioCodec": audio_codec,
        "fileSize": file_size,
    }))
}

#[tauri::command]
pub fn clear_thumbnail_cache(
    app_handle: tauri::AppHandle,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let cache_dir = get_thumbnail_cache_dir(&app_handle);
    if cache_dir.exists() {
        for entry in std::fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
            if let Ok(entry) = entry {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    let mut videos = crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())?;
    for video in &mut videos {
        video.thumbnail_path = None;
        video.thumbnail_status = "queued".to_string();
        video.updated_at = chrono::Utc::now().timestamp_millis();
        crate::db::video::update_video(&db, video).map_err(|e| e.to_string())?;
    }

    let mut playlists = crate::db::playlist::get_all_playlists(&db).map_err(|e| e.to_string())?;
    for playlist in &mut playlists {
        playlist.thumbnail_path = None;
        playlist.updated_at = chrono::Utc::now().timestamp_millis();
        crate::db::playlist::update_playlist(&db, playlist).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn regenerate_missing_thumbnails(
    app_handle: tauri::AppHandle,
    db: State<'_, DbState>,
) -> Result<crate::services::thumbnail_gen::ThumbnailBatchResult, String> {
    let videos = crate::db::video::get_all_videos(&db).map_err(|e| e.to_string())?;
    let video_ids = videos
        .into_iter()
        .filter(|video| {
            video.thumbnail_status != "ready"
                || video
                    .thumbnail_path
                    .as_ref()
                    .map(|path| !std::path::Path::new(path).exists())
                    .unwrap_or(true)
        })
        .map(|video| video.id)
        .collect::<Vec<_>>();

    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::services::thumbnail_gen::generate_thumbnails_for_ids(app_handle, db, video_ids)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_thumbnail_generation_paused(paused: bool) -> Result<(), String> {
    crate::services::thumbnail_gen::set_thumbnail_generation_paused(paused);
    Ok(())
}

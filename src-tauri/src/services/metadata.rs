use crate::utils::ffmpeg_finder;
use crate::utils::process::hidden_command;
use tauri::AppHandle;

pub fn extract_metadata(video_path: &str) -> Result<serde_json::Value, String> {
    let (_, ffprobe_path, status, _) = ffmpeg_finder::detect_ffmpeg();

    if status == "missing" {
        return Err("FFprobe not found".to_string());
    }

    let ffprobe = ffprobe_path.ok_or("FFprobe path not available")?;

    extract_metadata_with_ffprobe(&ffprobe, video_path)
}

pub fn extract_metadata_with_app(
    app_handle: &AppHandle,
    video_path: &str,
) -> Result<serde_json::Value, String> {
    let (_, ffprobe, _, _) = ffmpeg_finder::ensure_ffmpeg_for_app(app_handle)?;

    extract_metadata_with_ffprobe(&ffprobe, video_path)
}

fn extract_metadata_with_ffprobe(
    ffprobe: &str,
    video_path: &str,
) -> Result<serde_json::Value, String> {
    let output = hidden_command(&ffprobe)
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            video_path,
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
        .and_then(|d| d.as_str())
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

    let file_size = std::fs::metadata(video_path)
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

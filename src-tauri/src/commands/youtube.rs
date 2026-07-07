use serde::Serialize;
use tauri::AppHandle;

use crate::commands::downloader::ensure_ytdlp;
use crate::utils::process::hidden_command;

const SEARCH_RESULT_COUNT: usize = 12;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeSearchItem {
    pub id: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail: String,
    pub url: String,
    pub view_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeStream {
    pub video_id: String,
    pub video_url: String,
    pub title: String,
    pub channel: String,
    pub duration_seconds: f64,
    pub thumbnail: String,
    pub source_url: String,
    pub height: i64,
}

/// Searches YouTube (no API key, no ads, no tracking pixels) via yt-dlp.
/// Accepts either a free-text query or a direct video URL.
#[tauri::command]
pub async fn youtube_search(
    app_handle: AppHandle,
    query: String,
) -> Result<Vec<YoutubeSearchItem>, String> {
    tauri::async_runtime::spawn_blocking(move || youtube_search_blocking(&app_handle, &query))
        .await
        .map_err(|error| error.to_string())?
}

fn youtube_search_blocking(
    app_handle: &AppHandle,
    query: &str,
) -> Result<Vec<YoutubeSearchItem>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let ytdlp = ensure_ytdlp(app_handle, None)?;

    let target = if query.starts_with("http://") || query.starts_with("https://") {
        query.to_string()
    } else {
        format!("ytsearch{}:{}", SEARCH_RESULT_COUNT, query)
    };

    let output = hidden_command(&ytdlp)
        .args([
            "--no-warnings",
            "--flat-playlist",
            "--dump-single-json",
            "--socket-timeout",
            "20",
            &target,
        ])
        .output()
        .map_err(|error| format!("Could not start the search helper: {}", error))?;

    if !output.status.success() {
        return Err(compact_yt_error(&output.stderr, "Search failed."));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Could not read the search results: {}", error))?;

    // Search / playlist responses have an `entries` list; a direct video URL
    // returns a single video object instead.
    let items = match json.get("entries").and_then(|value| value.as_array()) {
        Some(entries) => entries
            .iter()
            .filter_map(entry_to_search_item)
            .collect::<Vec<_>>(),
        None => entry_to_search_item(&json).into_iter().collect(),
    };

    Ok(items)
}

fn entry_to_search_item(entry: &serde_json::Value) -> Option<YoutubeSearchItem> {
    let id = entry.get("id")?.as_str()?.to_string();
    let title = entry
        .get("title")
        .and_then(|value| value.as_str())
        .unwrap_or("Untitled")
        .to_string();
    let channel = entry
        .get("channel")
        .or_else(|| entry.get("uploader"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let duration_seconds = entry
        .get("duration")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0);
    let thumbnail = best_thumbnail(entry)
        .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id));
    let url = entry
        .get("url")
        .or_else(|| entry.get("webpage_url"))
        .and_then(|value| value.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", id));
    let view_count = entry.get("view_count").and_then(|value| value.as_i64());

    Some(YoutubeSearchItem {
        id,
        title,
        channel,
        duration_seconds,
        thumbnail,
        url,
        view_count,
    })
}

fn best_thumbnail(entry: &serde_json::Value) -> Option<String> {
    let thumbnails = entry.get("thumbnails")?.as_array()?;
    thumbnails
        .iter()
        .filter_map(|thumb| {
            let url = thumb.get("url")?.as_str()?;
            let width = thumb.get("width").and_then(|value| value.as_i64()).unwrap_or(0);
            Some((width, url.to_string()))
        })
        // Prefer a medium-size thumbnail: big enough to be sharp, small enough to load fast.
        .min_by_key(|(width, _)| (width - 480).abs())
        .map(|(_, url)| url)
}

/// Resolves an ad-free direct video stream for a YouTube video. The returned URL
/// is the raw media stream, so playback in the app's own player has no ads,
/// overlays, or trackers at all.
#[tauri::command]
pub async fn youtube_resolve(app_handle: AppHandle, url: String) -> Result<YoutubeStream, String> {
    tauri::async_runtime::spawn_blocking(move || youtube_resolve_blocking(&app_handle, &url))
        .await
        .map_err(|error| error.to_string())?
}

fn youtube_resolve_blocking(app_handle: &AppHandle, url: &str) -> Result<YoutubeStream, String> {
    let url = url.trim();
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Enter a valid video URL.".to_string());
    }

    let ytdlp = ensure_ytdlp(app_handle, None)?;

    let output = hidden_command(&ytdlp)
        .args([
            "--no-warnings",
            "--no-playlist",
            "--socket-timeout",
            "20",
            "-J",
            url,
        ])
        .output()
        .map_err(|error| format!("Could not start the stream helper: {}", error))?;

    if !output.status.success() {
        return Err(compact_yt_error(
            &output.stderr,
            "Could not load this video.",
        ));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Could not read the video details: {}", error))?;

    let (video_url, height) = pick_muxed_stream(&json)
        .ok_or_else(|| "No directly playable stream was found for this video.".to_string())?;

    let video_id = json
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();

    Ok(YoutubeStream {
        video_url,
        title: json
            .get("title")
            .and_then(|value| value.as_str())
            .unwrap_or("Untitled")
            .to_string(),
        channel: json
            .get("channel")
            .or_else(|| json.get("uploader"))
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string(),
        duration_seconds: json
            .get("duration")
            .and_then(|value| value.as_f64())
            .unwrap_or(0.0),
        thumbnail: best_thumbnail(&json).unwrap_or_else(|| {
            format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", video_id)
        }),
        source_url: json
            .get("webpage_url")
            .and_then(|value| value.as_str())
            .unwrap_or(url)
            .to_string(),
        video_id,
        height,
    })
}

/// Picks the best progressive (already video+audio) HTTPS stream, which the
/// WebView `<video>` element can play directly without merging.
fn pick_muxed_stream(json: &serde_json::Value) -> Option<(String, i64)> {
    let formats = json.get("formats")?.as_array()?;

    formats
        .iter()
        .filter_map(|format| {
            let vcodec = format.get("vcodec").and_then(|value| value.as_str())?;
            let acodec = format.get("acodec").and_then(|value| value.as_str())?;
            let protocol = format
                .get("protocol")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            let url = format.get("url").and_then(|value| value.as_str())?;

            if vcodec == "none" || acodec == "none" || !protocol.starts_with("http") {
                return None;
            }
            // HLS/DASH manifests are not directly playable in the WebView element.
            if protocol.contains("m3u8") || protocol.contains("dash") {
                return None;
            }

            let height = format.get("height").and_then(|value| value.as_i64()).unwrap_or(0);
            let ext = format
                .get("ext")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            // Prefer mp4 (universally supported by WebView2), then higher quality.
            let score = height * 10 + if ext == "mp4" { 5 } else { 0 };
            Some((score, height, url.to_string()))
        })
        .max_by_key(|(score, _, _)| *score)
        .map(|(_, height, url)| (url, height))
}

fn compact_yt_error(stderr: &[u8], fallback: &str) -> String {
    let details = String::from_utf8_lossy(stderr)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.contains("https://github.com/yt-dlp"))
        .take(2)
        .collect::<Vec<_>>()
        .join(" ");

    if details.is_empty() {
        fallback.to_string()
    } else {
        details.chars().take(300).collect()
    }
}

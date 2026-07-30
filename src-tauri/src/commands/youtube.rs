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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelCatalog {
    pub channel: String,
    pub channel_url: String,
    /// The channel's profile picture, from yt3.ggpht.com / yt3.googleusercontent.com
    /// (both must stay in the CSP img-src for it to render).
    pub channel_avatar: Option<String>,
    /// The @handle, e.g. "@sheikhalbadr".
    pub channel_handle: Option<String>,
    pub subscriber_count: Option<i64>,
    pub videos: Vec<YoutubeSearchItem>,
}

/// Fetches a channel's uploads for the Shuyukh profiles — newest first, the
/// order the /videos tab serves them in, which is what makes "everything
/// before the last-seen id is new" a correct client-side computation.
///
/// `limit` caps the fetch (`None` → 90, quick enough for the six-hour
/// auto-refresh); `Some(0)` means the whole channel — a flat enumeration
/// that walks every uploads page, so a ten-thousand-video channel takes a
/// minute or more. The store only asks for that on an explicit user click.
#[tauri::command]
pub async fn youtube_channel_catalog(
    app_handle: AppHandle,
    channel_url: String,
    limit: Option<u32>,
) -> Result<ChannelCatalog, String> {
    tauri::async_runtime::spawn_blocking(move || {
        channel_catalog_blocking(&app_handle, &channel_url, limit.unwrap_or(90))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn channel_catalog_blocking(
    app_handle: &AppHandle,
    channel_url: &str,
    limit: u32,
) -> Result<ChannelCatalog, String> {
    let raw = channel_url.trim();
    if raw.is_empty() {
        return Err("Channel link is empty.".to_string());
    }
    if !raw.starts_with("http://") && !raw.starts_with("https://") {
        return Err("Enter the channel's full link.".to_string());
    }

    /* A bare channel URL makes yt-dlp enumerate every TAB (videos, shorts,
       live, playlists) as nested playlists — slow, and the entries are tabs,
       not videos. Pinning /videos gets the uploads, newest first. URLs that
       already point at a tab or a playlist pass through untouched. */
    let target = normalize_channel_url(raw);

    let ytdlp = ensure_ytdlp(app_handle, None)?;
    let mut command = hidden_command(&ytdlp);
    command.args(["--no-warnings", "--flat-playlist", "--dump-single-json"]);
    // limit 0 = the whole channel; anything else caps the enumeration.
    let limit_arg;
    if limit > 0 {
        limit_arg = limit.to_string();
        command.args(["--playlist-end", &limit_arg]);
    }
    let output = command
        .args(["--socket-timeout", "20", &target])
        .output()
        .map_err(|error| format!("Could not start the channel helper: {}", error))?;

    if !output.status.success() {
        return Err(compact_yt_error(
            &output.stderr,
            "Could not load this channel.",
        ));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Could not read the channel: {}", error))?;

    let channel = json
        .get("channel")
        .or_else(|| json.get("uploader"))
        .or_else(|| json.get("title"))
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();

    let channel_avatar = channel_avatar(&json);
    let channel_handle = json
        .get("uploader_id")
        .and_then(|value| value.as_str())
        .filter(|value| value.starts_with('@'))
        .map(str::to_string);
    let subscriber_count = json
        .get("channel_follower_count")
        .and_then(|value| value.as_i64());

    let videos = json
        .get("entries")
        .and_then(|value| value.as_array())
        .map(|entries| {
            entries
                .iter()
                .filter_map(entry_to_search_item)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if videos.is_empty() {
        return Err("No videos found on this channel.".to_string());
    }

    Ok(ChannelCatalog {
        channel,
        channel_url: raw.to_string(),
        channel_avatar,
        channel_handle,
        subscriber_count,
        videos,
    })
}

/// The channel's profile picture, from the tab dump's top-level `thumbnails`.
/// That array mixes the avatar (square, id `avatar_uncropped` for the
/// original) with the page banner; the banner is a design surface, not the
/// shaykh's picture, so it is never an acceptable fallback. In real dumps the
/// sized banner entries carry NO id (yt-dlp backfills numeric ones) — what
/// marks them is `preference: -10`, so the fallback filters on preference and
/// squareness, not on id alone.
fn channel_avatar(json: &serde_json::Value) -> Option<String> {
    let thumbnails = json.get("thumbnails")?.as_array()?;

    let id_of = |thumb: &serde_json::Value| {
        thumb
            .get("id")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string()
    };

    if let Some(url) = thumbnails
        .iter()
        .find(|thumb| id_of(thumb) == "avatar_uncropped")
        .and_then(|thumb| thumb.get("url"))
        .and_then(|value| value.as_str())
    {
        return Some(url.to_string());
    }

    thumbnails
        .iter()
        .filter(|thumb| {
            let preference = thumb
                .get("preference")
                .and_then(|value| value.as_i64())
                .unwrap_or(0);
            let width = thumb.get("width").and_then(|value| value.as_i64());
            let height = thumb.get("height").and_then(|value| value.as_i64());
            let square = match (width, height) {
                (Some(w), Some(h)) => w == h,
                _ => true, // unsized entries are the metadata avatars
            };
            preference >= 0 && square && !id_of(thumb).contains("banner")
        })
        .filter_map(|thumb| {
            let url = thumb.get("url")?.as_str()?;
            let width = thumb.get("width").and_then(|value| value.as_i64()).unwrap_or(0);
            Some((width, url.to_string()))
        })
        .max_by_key(|(width, _)| *width)
        .map(|(_, url)| url)
}

/// The Shuyukh full-catalog cache: one JSON file per profile under app data.
/// A whole channel is a minute-plus of yt-dlp enumeration but only a few MB
/// of text, so it is cached on the reader's own disk — never a remote
/// service; which shuyukh someone studies is nobody's data but theirs.
fn catalog_cache_path(
    app_handle: &AppHandle,
    profile_id: &str,
) -> Result<std::path::PathBuf, String> {
    if !valid_profile_id(profile_id) {
        return Err("Invalid profile id.".to_string());
    }
    let dir = crate::utils::paths::get_app_data_dir(app_handle)?.join("shuyukh-catalogs");
    Ok(dir.join(format!("{profile_id}.json")))
}

/// Profile ids are app-minted (`sh-<base36>-<base36>`); anything else is
/// refused outright rather than sanitized, so an id can never path-traverse.
fn valid_profile_id(profile_id: &str) -> bool {
    !profile_id.is_empty()
        && profile_id.len() <= 64
        && profile_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[tauri::command]
pub async fn shuyukh_catalog_cache_read(
    app_handle: AppHandle,
    profile_id: String,
) -> Result<Option<serde_json::Value>, String> {
    let path = catalog_cache_path(&app_handle, &profile_id)?;
    match std::fs::read(&path) {
        // A corrupt or unreadable file is a cache miss, not an error the UI
        // should surface — the catalog refetches from the channel.
        Ok(bytes) => Ok(serde_json::from_slice(&bytes).ok()),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn shuyukh_catalog_cache_write(
    app_handle: AppHandle,
    profile_id: String,
    envelope: serde_json::Value,
) -> Result<(), String> {
    let path = catalog_cache_path(&app_handle, &profile_id)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create the catalog cache: {}", error))?;
    }
    let bytes = serde_json::to_vec(&envelope)
        .map_err(|error| format!("Could not encode the catalog: {}", error))?;
    // Write-then-rename, so a crash mid-write never leaves a torn file that
    // would read as permanently corrupt cache.
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, bytes)
        .map_err(|error| format!("Could not write the catalog cache: {}", error))?;
    std::fs::rename(&tmp, &path)
        .map_err(|error| format!("Could not store the catalog cache: {}", error))
}

#[tauri::command]
pub async fn shuyukh_catalog_cache_remove(
    app_handle: AppHandle,
    profile_id: String,
) -> Result<(), String> {
    let path = catalog_cache_path(&app_handle, &profile_id)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not remove the catalog cache: {}", error)),
    }
}

fn normalize_channel_url(url: &str) -> String {
    let trimmed = url.trim_end_matches('/');
    let is_channel_root = (trimmed.contains("youtube.com/@")
        || trimmed.contains("youtube.com/channel/")
        || trimmed.contains("youtube.com/c/")
        || trimmed.contains("youtube.com/user/"))
        && !trimmed.ends_with("/videos")
        && !trimmed.ends_with("/streams")
        && !trimmed.ends_with("/shorts")
        && !trimmed.contains("/playlist");
    if is_channel_root {
        format!("{}/videos", trimmed)
    } else {
        trimmed.to_string()
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn channel_avatar_prefers_uncropped_and_never_the_banner() {
        // Shaped like a real channel-tab dump: sized banners carry numeric
        // backfilled ids and preference -10; avatars carry no preference.
        let dump = json!({
            "thumbnails": [
                { "id": "0", "url": "https://yt3.googleusercontent.com/banner-sized", "width": 2560, "height": 424, "preference": -10 },
                { "id": "banner_uncropped", "url": "https://yt3.googleusercontent.com/banner", "preference": -5 },
                { "id": "1", "url": "https://yt3.ggpht.com/small", "width": 88, "height": 88 },
                { "id": "avatar_uncropped", "url": "https://yt3.googleusercontent.com/avatar" },
                { "id": "2", "url": "https://yt3.ggpht.com/large", "width": 800, "height": 800 },
            ]
        });
        assert_eq!(
            channel_avatar(&dump).as_deref(),
            Some("https://yt3.googleusercontent.com/avatar")
        );
    }

    #[test]
    fn channel_avatar_falls_back_to_widest_square_never_a_banner() {
        // No avatar_uncropped (header-layout churn): the widest square,
        // non-negative-preference entry wins; the 2560px banner never does.
        let dump = json!({
            "thumbnails": [
                { "id": "0", "url": "https://yt3.googleusercontent.com/banner-sized", "width": 2560, "height": 424, "preference": -10 },
                { "id": "banner_uncropped", "url": "https://yt3.googleusercontent.com/banner", "preference": -5 },
                { "id": "1", "url": "https://yt3.ggpht.com/small", "width": 88, "height": 88 },
                { "id": "2", "url": "https://yt3.ggpht.com/large", "width": 800, "height": 800 },
            ]
        });
        assert_eq!(
            channel_avatar(&dump).as_deref(),
            Some("https://yt3.ggpht.com/large")
        );
        // Only banners in the dump: no avatar is better than the banner.
        let banners_only = json!({
            "thumbnails": [
                { "id": "0", "url": "https://yt3.googleusercontent.com/banner-sized", "width": 2560, "height": 424, "preference": -10 },
            ]
        });
        assert_eq!(channel_avatar(&banners_only), None);
        assert_eq!(channel_avatar(&json!({ "thumbnails": [] })), None);
        assert_eq!(channel_avatar(&json!({})), None);
    }

    #[test]
    fn profile_ids_reject_anything_that_could_traverse() {
        assert!(valid_profile_id("sh-m1abc2-x9y8z7"));
        assert!(!valid_profile_id(""));
        assert!(!valid_profile_id("../../../etc/passwd"));
        assert!(!valid_profile_id("sh-abc/def"));
        assert!(!valid_profile_id("sh-abc\\def"));
        assert!(!valid_profile_id("sh..def"));
        assert!(!valid_profile_id(&"a".repeat(65)));
    }

    #[test]
    fn normalize_channel_url_pins_the_videos_tab_only_at_the_root() {
        assert_eq!(
            normalize_channel_url("https://www.youtube.com/@sheikhalbadr"),
            "https://www.youtube.com/@sheikhalbadr/videos"
        );
        assert_eq!(
            normalize_channel_url("https://www.youtube.com/@sheikhalbadr/"),
            "https://www.youtube.com/@sheikhalbadr/videos"
        );
        assert_eq!(
            normalize_channel_url("https://www.youtube.com/@sheikhalbadr/videos"),
            "https://www.youtube.com/@sheikhalbadr/videos"
        );
        assert_eq!(
            normalize_channel_url("https://www.youtube.com/playlist?list=PL123"),
            "https://www.youtube.com/playlist?list=PL123"
        );
    }
}

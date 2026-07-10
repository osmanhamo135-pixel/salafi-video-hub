use tauri::{AppHandle, State};

use crate::db::DbState;
use crate::utils::ffmpeg_finder;
use crate::utils::paths::get_app_data_dir;
use crate::utils::process::hidden_command;

const UPDATE_ENDPOINT: &str =
    "https://github.com/osmanhamo135-pixel/salafi-video-hub/releases/latest/download/latest.json";

/// One-shot health report for Settings → Diagnostics: versions, tool status,
/// database size, and connectivity — so problems are visible in one place.
#[tauri::command]
pub async fn get_diagnostics(
    app_handle: AppHandle,
    db: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let app_version = app_handle.package_info().version.to_string();
        let app_data_path = get_app_data_dir(&app_handle)
            .map(|path| path.to_string_lossy().to_string())
            .unwrap_or_default();

        let db_size_bytes = dirs::data_dir()
            .map(|dir| dir.join("com.salafivideohub.app").join("salafi_video_hub.db"))
            .and_then(|path| std::fs::metadata(path).ok())
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        let (video_count, playlist_count) = counts(&db);

        let (ffmpeg_path, _, ffmpeg_status, ffmpeg_version) =
            ffmpeg_finder::detect_ffmpeg_for_app(&app_handle);

        let ytdlp_version = ytdlp_version(&app_handle);

        let internet_ok = url_reachable("https://github.com");
        let update_endpoint_ok = url_reachable(UPDATE_ENDPOINT);

        Ok(serde_json::json!({
            "appVersion": app_version,
            "appDataPath": app_data_path,
            "dbSizeBytes": db_size_bytes,
            "videoCount": video_count,
            "playlistCount": playlist_count,
            "ffmpegStatus": ffmpeg_status,
            "ffmpegVersion": ffmpeg_version,
            "ffmpegPath": ffmpeg_path,
            "ytdlpVersion": ytdlp_version,
            "internetOk": internet_ok,
            "updateEndpointOk": update_endpoint_ok,
        }))
    })
    .await
    .map_err(|e| e.to_string())?
}

fn counts(db: &DbState) -> (i64, i64) {
    let Ok(conn) = db.lock() else { return (0, 0) };
    let videos = conn
        .query_row("SELECT COUNT(*) FROM videos", [], |row| row.get(0))
        .unwrap_or(0);
    let playlists = conn
        .query_row("SELECT COUNT(*) FROM playlists", [], |row| row.get(0))
        .unwrap_or(0);
    (videos, playlists)
}

fn ytdlp_version(app_handle: &AppHandle) -> Option<String> {
    let path = get_app_data_dir(app_handle).ok()?.join("tools").join("yt-dlp.exe");
    if !path.exists() {
        return None;
    }
    let output = hidden_command(&path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8(output.stdout)
        .ok()
        .map(|version| version.trim().to_string())
        .filter(|version| !version.is_empty())
}

fn url_reachable(url: &str) -> bool {
    for program in ["curl.exe", "curl"] {
        if let Ok(output) = hidden_command(program)
            .args([
                "-L",
                "--head",
                "--fail",
                "--silent",
                "--connect-timeout",
                "8",
                "--max-time",
                "15",
                "-o",
                if cfg!(windows) { "NUL" } else { "/dev/null" },
                url,
            ])
            .output()
        {
            if output.status.success() {
                return true;
            }
        }
    }
    false
}

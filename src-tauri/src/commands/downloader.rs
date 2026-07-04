use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use walkdir::WalkDir;

use crate::db::DbState;
use crate::services::scanner;
use crate::utils::ffmpeg_finder;
use crate::utils::paths::get_app_data_dir;
use crate::utils::process::hidden_command;

const YT_DLP_URL: &str = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const YT_DLP_RESOURCE_NAME: &str = "yt-dlp.exe";
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "opus", "ogg", "webm", "wav", "aac", "flac"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeDownloadRequest {
    pub job_id: String,
    pub url: String,
    pub output_dir: Option<String>,
    pub cookies_path: Option<String>,
    pub quality: String,
    pub audio_only: bool,
    pub download_playlist: bool,
    pub import_after_download: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeDownloadProgress {
    pub job_id: String,
    pub stage: String,
    pub message: String,
    pub percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeDownloadResult {
    pub output_dir: String,
    pub downloaded_files: Vec<String>,
    pub import_result: Option<scanner::ImportResult>,
}

#[tauri::command]
pub async fn download_youtube_video(
    app_handle: AppHandle,
    db: State<'_, DbState>,
    request: YoutubeDownloadRequest,
) -> Result<YoutubeDownloadResult, String> {
    let db = db.inner().clone();

    tauri::async_runtime::spawn_blocking(move || {
        download_youtube_video_blocking(app_handle, db, request)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn download_youtube_video_blocking(
    app_handle: AppHandle,
    db: DbState,
    request: YoutubeDownloadRequest,
) -> Result<YoutubeDownloadResult, String> {
    let url = request.url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Enter a valid YouTube URL.".to_string());
    }

    let output_dir = resolve_output_dir(&app_handle, request.output_dir.as_deref())?;
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    emit_progress(
        &app_handle,
        &request.job_id,
        "preparing",
        "Preparing downloader...",
        None,
    );

    let ytdlp = ensure_ytdlp(&app_handle, &request.job_id)?;
    let downloaded_files = run_ytdlp(&app_handle, &request, &ytdlp, &output_dir)?;

    emit_progress(
        &app_handle,
        &request.job_id,
        "importing",
        "Adding downloaded media to the local library...",
        Some(100.0),
    );

    let import_result = if request.import_after_download && !request.audio_only {
        import_downloads(&app_handle, &db, &output_dir, &downloaded_files)?
    } else {
        None
    };

    emit_progress(
        &app_handle,
        &request.job_id,
        "finished",
        "Download finished.",
        Some(100.0),
    );

    Ok(YoutubeDownloadResult {
        output_dir: output_dir.to_string_lossy().to_string(),
        downloaded_files,
        import_result,
    })
}

fn resolve_output_dir(app_handle: &AppHandle, requested: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = requested.map(str::trim).filter(|path| !path.is_empty()) {
        return Ok(PathBuf::from(path));
    }

    Ok(get_app_data_dir(app_handle)?.join("downloads"))
}

fn ensure_ytdlp(app_handle: &AppHandle, job_id: &str) -> Result<PathBuf, String> {
    let tools_dir = get_app_data_dir(app_handle)?.join("tools");
    fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;
    let ytdlp_path = tools_dir.join(YT_DLP_RESOURCE_NAME);

    if ytdlp_path.exists() && validate_ytdlp(&ytdlp_path) {
        return Ok(ytdlp_path);
    }

    if let Some(bundled_path) = bundled_ytdlp_path(app_handle) {
        if validate_ytdlp(&bundled_path) {
            if copy_helper(&bundled_path, &ytdlp_path).is_ok() && validate_ytdlp(&ytdlp_path) {
                return Ok(ytdlp_path);
            }
            return Ok(bundled_path);
        }
    }

    emit_progress(
        app_handle,
        job_id,
        "installing",
        "Installing download helper...",
        None,
    );

    if let Err(error) = download_ytdlp(&ytdlp_path) {
        let _ = fs::remove_file(&ytdlp_path);
        return Err(format!(
            "Could not install the YouTube download helper. The bundled helper was not available and the online install failed: {}",
            error
        ));
    }

    if !validate_ytdlp(&ytdlp_path) {
        let _ = fs::remove_file(&ytdlp_path);
        return Err("The YouTube download helper was installed but could not start.".to_string());
    }

    Ok(ytdlp_path)
}

fn bundled_ytdlp_path(app_handle: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join(YT_DLP_RESOURCE_NAME));
        candidates.push(resource_dir.join("resources").join(YT_DLP_RESOURCE_NAME));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(YT_DLP_RESOURCE_NAME));
            candidates.push(exe_dir.join("resources").join(YT_DLP_RESOURCE_NAME));
        }
    }

    candidates.into_iter().find(|path| path.exists() && path.is_file())
}

fn copy_helper(source: &Path, target: &Path) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| "Could not resolve helper install folder.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let temp_path = target.with_extension("exe.tmp");
    let _ = fs::remove_file(&temp_path);
    fs::copy(source, &temp_path).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(target);
    fs::rename(&temp_path, target).map_err(|e| e.to_string())?;
    Ok(())
}

fn download_ytdlp(target: &Path) -> Result<(), String> {
    let temp_path = target.with_extension("exe.download");
    let _ = fs::remove_file(&temp_path);

    let mut errors = Vec::new();
    match download_ytdlp_with_curl(&temp_path) {
        Ok(()) => return finalize_downloaded_helper(&temp_path, target),
        Err(error) => errors.push(error),
    }

    match download_ytdlp_with_powershell(&temp_path) {
        Ok(()) => return finalize_downloaded_helper(&temp_path, target),
        Err(error) => errors.push(error),
    }

    Err(errors.join(" | "))
}

fn finalize_downloaded_helper(temp_path: &Path, target: &Path) -> Result<(), String> {
    if !validate_ytdlp(temp_path) {
        let _ = fs::remove_file(temp_path);
        return Err("Downloaded helper could not be validated.".to_string());
    }

    let _ = fs::remove_file(target);
    fs::rename(temp_path, target).map_err(|e| e.to_string())
}

fn download_ytdlp_with_curl(temp_path: &Path) -> Result<(), String> {
    let temp_string = temp_path.to_string_lossy().to_string();
    let output = hidden_command("curl.exe")
        .args([
            "-L",
            "--fail",
            "--retry",
            "3",
            "--retry-delay",
            "2",
            "--connect-timeout",
            "20",
            "-o",
            &temp_string,
            YT_DLP_URL,
        ])
        .output()
        .map_err(|e| format!("curl unavailable: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_process_error("curl download failed", &output.stderr))
    }
}

fn download_ytdlp_with_powershell(temp_path: &Path) -> Result<(), String> {
    let temp_string = temp_path.to_string_lossy().to_string();
    let output = hidden_command("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri $args[0] -OutFile $args[1]",
            YT_DLP_URL,
            &temp_string,
        ])
        .output()
        .map_err(|e| format!("PowerShell unavailable: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_process_error("PowerShell download failed", &output.stderr))
    }
}

fn format_process_error(prefix: &str, stderr: &[u8]) -> String {
    let details = String::from_utf8_lossy(stderr)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join(" ");

    if details.is_empty() {
        prefix.to_string()
    } else {
        format!("{}: {}", prefix, details)
    }
}

fn validate_ytdlp(path: &Path) -> bool {
    hidden_command(path)
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn run_ytdlp(
    app_handle: &AppHandle,
    request: &YoutubeDownloadRequest,
    ytdlp: &Path,
    output_dir: &Path,
) -> Result<Vec<String>, String> {
    let strategies = [DownloadStrategy::Turbo, DownloadStrategy::StableChunkRetry];
    let mut errors = Vec::new();

    for (index, strategy) in strategies.iter().copied().enumerate() {
        emit_progress(
            app_handle,
            &request.job_id,
            "downloading",
            strategy.start_message(),
            Some(0.0),
        );

        match run_ytdlp_once(app_handle, request, ytdlp, output_dir, strategy) {
            Ok(files) => return Ok(files),
            Err(error) => {
                let retryable = is_retryable_download_error(&error);
                errors.push(format!(
                    "{}: {}",
                    strategy.name(),
                    sanitize_download_error(&error, request.cookies_path.as_deref().is_some())
                ));

                if index + 1 >= strategies.len() || !retryable {
                    break;
                }

                emit_progress(
                    app_handle,
                    &request.job_id,
                    "downloading",
                    "YouTube broke a download chunk. Retrying with stable small chunks...",
                    Some(0.0),
                );
            }
        }
    }

    Err(format_download_errors(errors))
}

#[derive(Debug, Clone, Copy)]
enum DownloadStrategy {
    Turbo,
    StableChunkRetry,
}

impl DownloadStrategy {
    fn name(self) -> &'static str {
        match self {
            Self::Turbo => "Turbo mode",
            Self::StableChunkRetry => "Stable retry mode",
        }
    }

    fn start_message(self) -> &'static str {
        match self {
            Self::Turbo => "Turbo download mode: 16 parallel fragments with fast chunking...",
            Self::StableChunkRetry => "Stable retry mode: smaller chunks for broken YouTube responses...",
        }
    }

    fn concurrent_fragments(self) -> &'static str {
        match self {
            Self::Turbo => "16",
            Self::StableChunkRetry => "8",
        }
    }

    fn http_chunk_size(self) -> &'static str {
        match self {
            Self::Turbo => "8M",
            Self::StableChunkRetry => "1M",
        }
    }

    fn retries(self) -> &'static str {
        match self {
            Self::Turbo => "6",
            Self::StableChunkRetry => "30",
        }
    }

    fn fragment_retries(self) -> &'static str {
        match self {
            Self::Turbo => "8",
            Self::StableChunkRetry => "40",
        }
    }

    fn retry_sleep(self) -> [&'static str; 3] {
        match self {
            Self::Turbo => [
                "fragment:linear=1::3",
                "http:linear=1::3",
                "file_access:linear=1::2",
            ],
            Self::StableChunkRetry => [
                "fragment:linear=1::5",
                "http:linear=1::5",
                "file_access:linear=1::3",
            ],
        }
    }
}

fn run_ytdlp_once(
    app_handle: &AppHandle,
    request: &YoutubeDownloadRequest,
    ytdlp: &Path,
    output_dir: &Path,
    strategy: DownloadStrategy,
) -> Result<Vec<String>, String> {
    let mut command = hidden_command(ytdlp);
    let output_dir_string = output_dir.to_string_lossy().to_string();
    let should_download_playlist = request.download_playlist || looks_like_playlist_url(&request.url);
    let output_template = if should_download_playlist {
        "%(playlist_title).180B/%(playlist_index)03d - %(title).180B [%(id)s].%(ext)s"
    } else {
        "%(title).200B [%(id)s].%(ext)s"
    };
    let retry_sleep = strategy.retry_sleep();

    command
        .current_dir(output_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .args([
            "--newline",
            "--no-warnings",
            "--windows-filenames",
            "--continue",
            "--no-mtime",
            "--retries",
            strategy.retries(),
            "--fragment-retries",
            strategy.fragment_retries(),
            "--extractor-retries",
            "12",
            "--file-access-retries",
            "20",
            "--retry-sleep",
            retry_sleep[0],
            "--retry-sleep",
            retry_sleep[1],
            "--retry-sleep",
            retry_sleep[2],
            "--socket-timeout",
            "30",
            "--throttled-rate",
            "100K",
            "--concurrent-fragments",
            strategy.concurrent_fragments(),
            "--http-chunk-size",
            strategy.http_chunk_size(),
            "--trim-filenames",
            "220",
            "--paths",
            &output_dir_string,
            "--output",
            output_template,
            "--print",
            "after_move:filepath",
        ]);

    if let Some(cookies_path) = request
        .cookies_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
    {
        let path = Path::new(cookies_path);
        if !path.exists() || !path.is_file() {
            return Err(format!("Cookies file was not found: {}", cookies_path));
        }
        command.args(["--cookies", cookies_path]);
    }

    let (ffmpeg_path, _, ffmpeg_status, _) = ffmpeg_finder::detect_ffmpeg();
    if let Some(path) = ffmpeg_path {
        command.args(["--ffmpeg-location", &path]);
    }

    if should_download_playlist {
        command.args(["--yes-playlist", "--ignore-errors", "--no-abort-on-error"]);
    } else {
        command.arg("--no-playlist");
    }

    if request.audio_only {
        if ffmpeg_status == "missing" {
            command.args(["-f", "ba[ext=m4a]/ba/bestaudio/b"]);
        } else {
            command.args(["-x", "--audio-format", "mp3", "-f", "ba/bestaudio/b"]);
        }
    } else {
        if request.quality == "fast" || ffmpeg_status == "missing" {
            match request.quality.as_str() {
                "1080" => {
                    command.args(["-f", "b[height<=1080][ext=mp4]/b[height<=1080]/b[ext=mp4]/b"]);
                }
                "720" => {
                    command.args(["-f", "b[height<=720][ext=mp4]/b[height<=720]/b[ext=mp4]/b"]);
                }
                "480" => {
                    command.args(["-f", "b[height<=480][ext=mp4]/b[height<=480]/b[ext=mp4]/b"]);
                }
                _ => {
                    command.args(["-f", "b[ext=mp4]/b"]);
                }
            }
        } else {
            command.args(["--merge-output-format", "mp4"]);
            match request.quality.as_str() {
                "1080" => {
                    command.args(["-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080][ext=mp4]/b[height<=1080]/b"]);
                }
                "720" => {
                    command.args(["-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720][ext=mp4]/b[height<=720]/b"]);
                }
                "480" => {
                    command.args(["-f", "bv*[height<=480][ext=mp4]+ba[ext=m4a]/bv*[height<=480]+ba/b[height<=480][ext=mp4]/b[height<=480]/b"]);
                }
                _ => {
                    command.args(["-f", "bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b"]);
                }
            }
        }
    }

    command.arg(request.url.trim());

    emit_progress(
        app_handle,
        &request.job_id,
        "downloading",
        "Starting download...",
        Some(0.0),
    );

    let mut child = command
        .spawn()
        .map_err(|e| format!("Could not start the downloader: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (sender, receiver) = mpsc::channel::<String>();
    let mut handles = Vec::new();

    if let Some(stdout) = stdout {
        handles.push(spawn_line_reader(stdout, sender.clone()));
    }
    if let Some(stderr) = stderr {
        handles.push(spawn_line_reader(stderr, sender.clone()));
    }
    drop(sender);

    let percent_regex = Regex::new(r"(?i)(\d+(?:\.\d+)?)%").unwrap();
    let mut downloaded_files = Vec::new();
    let mut recent_lines = Vec::new();
    let mut progress_emitter = ProgressEmitter::new(app_handle, &request.job_id);

    loop {
        while let Ok(line) = receiver.try_recv() {
            handle_ytdlp_line(
                &mut progress_emitter,
                output_dir,
                &percent_regex,
                &line,
                &mut downloaded_files,
                &mut recent_lines,
            );
        }

        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            while let Ok(line) = receiver.recv_timeout(Duration::from_millis(120)) {
                handle_ytdlp_line(
                    &mut progress_emitter,
                    output_dir,
                    &percent_regex,
                    &line,
                    &mut downloaded_files,
                    &mut recent_lines,
                );
            }
            for handle in handles {
                let _ = handle.join();
            }

            if !status.success() {
                let details = recent_lines
                    .iter()
                    .rev()
                    .take(6)
                    .cloned()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect::<Vec<_>>()
                    .join("\n");
                return Err(if details.trim().is_empty() {
                    "Download failed.".to_string()
                } else {
                    format!("Download failed:\n{}", details)
                });
            }
            progress_emitter.flush();
            break;
        }

        thread::sleep(Duration::from_millis(100));
    }

    if downloaded_files.is_empty() {
        downloaded_files = discover_downloaded_files(output_dir, request.audio_only)?;
    }

    downloaded_files.sort();
    downloaded_files.dedup();

    if downloaded_files.is_empty() {
        return Err(sanitize_download_error(
            "No files were downloaded. The video or playlist may be private, removed, blocked by YouTube, or require sign-in.",
            request.cookies_path.as_deref().is_some(),
        ));
    }

    Ok(downloaded_files)
}

fn sanitize_download_error(error: &str, used_cookies: bool) -> String {
    let lower = error.to_lowercase();

    if lower.contains("private video")
        || lower.contains("sign in")
        || lower.contains("sign-in")
        || lower.contains("login required")
        || lower.contains("account")
        || lower.contains("cookies")
        || lower.contains("authentication")
        || lower.contains("members-only")
        || lower.contains("age-restricted")
    {
        if used_cookies {
            return "This video needs account access, and the selected cookies do not have access or are expired.".to_string();
        }
        return "This video needs account access. Select a cookies.txt file from an account that can open it, then retry.".to_string();
    }

    if lower.contains("requested entity was not found") || lower.contains("404: not found") {
        return "YouTube says this video or playlist was not found.".to_string();
    }

    if lower.contains("copyright") {
        return "YouTube blocked this item because of a copyright restriction.".to_string();
    }

    let compact_lines = error
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| !line.contains(":\\"))
        .filter(|line| !line.contains("https://github.com/yt-dlp"))
        .filter(|line| !line.starts_with("[download] Destination:"))
        .filter(|line| !line.starts_with("[Merger] Merging formats into"))
        .take(3)
        .collect::<Vec<_>>();

    if compact_lines.is_empty() {
        "Download failed.".to_string()
    } else {
        let compact = compact_lines.join("\n");
        if compact.chars().count() > 700 {
            format!("{}...", compact.chars().take(700).collect::<String>())
        } else {
            compact
        }
    }
}

fn is_retryable_download_error(error: &str) -> bool {
    let lower = error.to_lowercase();
    let permanent_markers = [
        "private video",
        "sign in",
        "requested entity was not found",
        "404: not found",
        "copyright",
        "not available",
        "unavailable",
        "members-only",
        "age-restricted",
    ];

    if permanent_markers.iter().any(|marker| lower.contains(marker)) {
        return false;
    }

    let retryable_markers = [
        "bytes read",
        "more expected",
        "timed out",
        "timeout",
        "connection reset",
        "connection aborted",
        "incomplete",
        "fragment",
        "http error",
        "temporarily unavailable",
        "429",
        "500",
        "502",
        "503",
        "504",
    ];

    retryable_markers
        .iter()
        .any(|marker| lower.contains(marker))
}

fn format_download_errors(errors: Vec<String>) -> String {
    if errors.is_empty() {
        return "Download failed.".to_string();
    }

    let mut compact_errors = Vec::new();
    for error in errors {
        if !compact_errors.iter().any(|existing| existing == &error) {
            compact_errors.push(error);
        }
    }

    if let Some(account_error) = compact_errors
        .iter()
        .find(|error| error.to_lowercase().contains("account access"))
    {
        return account_error
            .split_once(": ")
            .map(|(_, message)| message.to_string())
            .unwrap_or_else(|| account_error.clone());
    }

    if compact_errors.len() == 1 {
        return compact_errors[0].clone();
    }

    format!(
        "Download failed after turbo and stable retry attempts:\n{}",
        compact_errors.join("\n\n")
    )
}

fn looks_like_playlist_url(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains("youtube.com/playlist")
        || lower.contains("music.youtube.com/playlist")
        || lower.contains("?list=")
        || lower.contains("&list=")
}

fn spawn_line_reader<R: std::io::Read + Send + 'static>(
    reader: R,
    sender: mpsc::Sender<String>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let reader = BufReader::new(reader);
        for line in reader.lines().flatten() {
            let _ = sender.send(line);
        }
    })
}

fn handle_ytdlp_line(
    progress_emitter: &mut ProgressEmitter<'_>,
    output_dir: &Path,
    percent_regex: &Regex,
    line: &str,
    downloaded_files: &mut Vec<String>,
    recent_lines: &mut Vec<String>,
) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return;
    }

    recent_lines.push(trimmed.to_string());
    if recent_lines.len() > 12 {
        recent_lines.remove(0);
    }

    let is_file_line = if let Some(path) = extract_existing_path(trimmed, output_dir) {
        downloaded_files.push(path);
        true
    } else {
        false
    };

    let percent = percent_regex
        .captures(trimmed)
        .and_then(|captures| captures.get(1))
        .and_then(|match_| match_.as_str().parse::<f64>().ok())
        .map(|value| value.clamp(0.0, 100.0));

    progress_emitter.emit("downloading", trimmed, percent, is_file_line);
}

struct ProgressEmitter<'a> {
    app_handle: &'a AppHandle,
    job_id: String,
    last_emit: Instant,
    last_percent: Option<f64>,
    pending_stage: String,
    pending_message: String,
    pending_percent: Option<f64>,
}

impl<'a> ProgressEmitter<'a> {
    fn new(app_handle: &'a AppHandle, job_id: &str) -> Self {
        Self {
            app_handle,
            job_id: job_id.to_string(),
            last_emit: Instant::now() - Duration::from_secs(2),
            last_percent: None,
            pending_stage: "downloading".to_string(),
            pending_message: "Starting download...".to_string(),
            pending_percent: Some(0.0),
        }
    }

    fn emit(&mut self, stage: &str, message: &str, percent: Option<f64>, force: bool) {
        self.pending_stage = stage.to_string();
        self.pending_message = compact_progress_message(message);
        self.pending_percent = percent.or(self.pending_percent);

        let percent_changed = match (self.last_percent, self.pending_percent) {
            (Some(previous), Some(next)) => (next - previous).abs() >= 1.0,
            (None, Some(_)) => true,
            _ => false,
        };
        let elapsed = self.last_emit.elapsed() >= Duration::from_millis(550);

        if force || percent_changed || elapsed {
            self.flush();
        }
    }

    fn flush(&mut self) {
        self.last_emit = Instant::now();
        self.last_percent = self.pending_percent;
        emit_progress(
            self.app_handle,
            &self.job_id,
            &self.pending_stage,
            &self.pending_message,
            self.pending_percent,
        );
    }
}

fn compact_progress_message(message: &str) -> String {
    let trimmed = message.trim();
    if trimmed.len() <= 180 {
        return trimmed.to_string();
    }
    format!("{}...", trimmed.chars().take(180).collect::<String>())
}

fn extract_existing_path(line: &str, output_dir: &Path) -> Option<String> {
    let candidates = [
        line.trim_matches('"').to_string(),
        line.split('"').nth(1).unwrap_or_default().to_string(),
        line.strip_prefix("[download] Destination:")
            .unwrap_or_default()
            .trim()
            .trim_matches('"')
            .to_string(),
    ];

    candidates
        .into_iter()
        .filter(|candidate| !candidate.trim().is_empty())
        .map(|candidate| {
            let path = PathBuf::from(candidate.trim());
            if path.is_absolute() {
                path
            } else {
                output_dir.join(path)
            }
        })
        .find(|path| path.exists() && path.is_file())
        .map(|path| path.to_string_lossy().to_string())
}

fn discover_downloaded_files(output_dir: &Path, include_audio: bool) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let entries = WalkDir::new(output_dir).into_iter();

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() && is_supported_download_file(path, include_audio) {
            files.push(path.to_string_lossy().to_string());
        }
    }

    Ok(files)
}

fn is_supported_download_file(path: &Path, include_audio: bool) -> bool {
    if scanner::is_video_file(path) {
        return true;
    }

    include_audio
        && path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
            .unwrap_or(false)
}

fn import_downloads(
    app_handle: &AppHandle,
    db: &DbState,
    output_dir: &Path,
    downloaded_files: &[String],
) -> Result<Option<scanner::ImportResult>, String> {
    let downloaded_videos = downloaded_files
        .iter()
        .filter(|path| scanner::is_video_file(Path::new(path)))
        .cloned()
        .collect::<Vec<_>>();

    let outcome = if downloaded_videos.len() == 1 {
        scanner::import_single_video(db, &downloaded_videos[0])?
    } else {
        let import_root = choose_import_root(output_dir, &downloaded_videos);
        scanner::import_folder(db, &import_root.to_string_lossy(), true)?
    };

    if automatic_thumbnails_enabled(db) {
        crate::services::thumbnail_gen::spawn_thumbnail_generation(
            app_handle.clone(),
            db.clone(),
            outcome.video_ids_for_background,
        );
    }

    let result = outcome.result;
    let _ = app_handle.emit("import_finished", result.clone());
    Ok(Some(result))
}

fn choose_import_root(output_dir: &Path, downloaded_videos: &[String]) -> PathBuf {
    let parents = downloaded_videos
        .iter()
        .filter_map(|path| Path::new(path).parent().map(Path::to_path_buf))
        .collect::<Vec<_>>();

    if parents.is_empty() {
        return output_dir.to_path_buf();
    }

    let first = &parents[0];
    if parents.iter().all(|parent| parent == first) {
        first.clone()
    } else {
        output_dir.to_path_buf()
    }
}

fn automatic_thumbnails_enabled(db: &DbState) -> bool {
    crate::db::settings::get_settings(db)
        .map(|settings| settings.automatic_thumbnails_mode != "disabled")
        .unwrap_or(true)
}

fn emit_progress(
    app_handle: &AppHandle,
    job_id: &str,
    stage: &str,
    message: &str,
    percent: Option<f64>,
) {
    let _ = app_handle.emit(
        "youtube_download_progress",
        YoutubeDownloadProgress {
            job_id: job_id.to_string(),
            stage: stage.to_string(),
            message: message.to_string(),
            percent,
        },
    );
}

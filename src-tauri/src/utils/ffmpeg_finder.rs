use crate::utils::paths::get_app_data_dir;
use crate::utils::process::hidden_command;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const FFMPEG_ZIP_URL: &str =
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";

static FFMPEG_INSTALL_LOCK: Mutex<()> = Mutex::new(());

pub fn detect_ffmpeg() -> (Option<String>, Option<String>, String, Option<String>) {
    detect_without_app_paths()
}

pub fn detect_ffmpeg_for_app(
    app_handle: &AppHandle,
) -> (Option<String>, Option<String>, String, Option<String>) {
    if let Some(found) = detect_app_owned_ffmpeg(app_handle) {
        return found;
    }

    if let Some(found) = detect_resource_ffmpeg(app_handle) {
        return found;
    }

    detect_without_app_paths()
}

pub fn ensure_ffmpeg_for_app(
    app_handle: &AppHandle,
) -> Result<(String, String, String, Option<String>), String> {
    let detected = detect_ffmpeg_for_app(app_handle);
    if detected.2 != "missing" {
        return detected_to_result(detected);
    }

    let _guard = FFMPEG_INSTALL_LOCK
        .lock()
        .map_err(|_| "FFmpeg installer lock failed".to_string())?;

    let detected = detect_ffmpeg_for_app(app_handle);
    if detected.2 != "missing" {
        return detected_to_result(detected);
    }

    install_app_ffmpeg(app_handle)?;

    let detected = detect_ffmpeg_for_app(app_handle);
    if detected.2 == "missing" {
        return Err("FFmpeg helper was installed but could not be detected.".to_string());
    }

    detected_to_result(detected)
}

pub fn app_ffmpeg_dir(app_handle: &AppHandle) -> Result<PathBuf, String> {
    Ok(get_app_data_dir(app_handle)?.join("tools").join("ffmpeg"))
}

fn detect_app_owned_ffmpeg(
    app_handle: &AppHandle,
) -> Option<(Option<String>, Option<String>, String, Option<String>)> {
    let dir = app_ffmpeg_dir(app_handle).ok()?;
    detect_pair(
        dir.join("ffmpeg.exe"),
        dir.join("ffprobe.exe"),
        "app".to_string(),
        true,
    )
}

fn detect_resource_ffmpeg(
    app_handle: &AppHandle,
) -> Option<(Option<String>, Option<String>, String, Option<String>)> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join("ffmpeg.exe"));
        candidates.push(resource_dir.join("resources").join("ffmpeg.exe"));
        candidates.push(resource_dir.join("ffmpeg").join("ffmpeg.exe"));
    }

    for ffmpeg_path in candidates {
        let ffprobe_path = ffmpeg_path.with_file_name("ffprobe.exe");
        if let Some(found) = detect_pair(ffmpeg_path, ffprobe_path, "bundled".to_string(), true) {
            return Some(found);
        }
    }

    None
}

fn detect_without_app_paths() -> (Option<String>, Option<String>, String, Option<String>) {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates = [
                exe_dir.join("ffmpeg.exe"),
                exe_dir.join("resources").join("ffmpeg.exe"),
                exe_dir.join("ffmpeg").join("ffmpeg.exe"),
            ];

            for ffmpeg_path in candidates {
                let ffprobe_path = ffmpeg_path.with_file_name("ffprobe.exe");
                if let Some(found) =
                    detect_pair(ffmpeg_path, ffprobe_path, "bundled".to_string(), true)
                {
                    return found;
                }
            }
        }
    }

    if let Ok(path_var) = std::env::var("PATH") {
        for path_dir in path_var.split(';') {
            let ffmpeg_path = PathBuf::from(path_dir).join("ffmpeg.exe");
            let ffprobe_path = PathBuf::from(path_dir).join("ffprobe.exe");

            if let Some(found) = detect_pair(ffmpeg_path, ffprobe_path, "system".to_string(), false)
            {
                return found;
            }
        }
    }

    let common_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe",
    ];

    for path_str in &common_paths {
        let ffmpeg_path = PathBuf::from(path_str);
        let ffprobe_path = PathBuf::from(path_str.replace("ffmpeg.exe", "ffprobe.exe"));

        if let Some(found) = detect_pair(ffmpeg_path, ffprobe_path, "system".to_string(), false) {
            return found;
        }
    }

    (None, None, "missing".to_string(), None)
}

fn detect_pair(
    ffmpeg_path: PathBuf,
    ffprobe_path: PathBuf,
    status: String,
    require_validation: bool,
) -> Option<(Option<String>, Option<String>, String, Option<String>)> {
    if !ffmpeg_path.exists() || !ffprobe_path.exists() {
        return None;
    }

    if require_validation && !validate_ffmpeg_pair(&ffmpeg_path, &ffprobe_path) {
        return None;
    }

    let ffmpeg_string = ffmpeg_path.to_string_lossy().to_string();
    let ffprobe_string = ffprobe_path.to_string_lossy().to_string();
    let version = get_ffmpeg_version(&ffmpeg_string);

    Some((Some(ffmpeg_string), Some(ffprobe_string), status, version))
}

fn detected_to_result(
    detected: (Option<String>, Option<String>, String, Option<String>),
) -> Result<(String, String, String, Option<String>), String> {
    let ffmpeg = detected
        .0
        .ok_or_else(|| "FFmpeg path not available".to_string())?;
    let ffprobe = detected
        .1
        .ok_or_else(|| "FFprobe path not available".to_string())?;
    Ok((ffmpeg, ffprobe, detected.2, detected.3))
}

fn install_app_ffmpeg(app_handle: &AppHandle) -> Result<(), String> {
    let target_dir = app_ffmpeg_dir(app_handle)?;
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let script = r#"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$url = $args[0]
$target = $args[1]
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('salafi-ffmpeg-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp 'ffmpeg.zip'
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  $ffmpeg = Get-ChildItem -LiteralPath $tmp -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
  $ffprobe = Get-ChildItem -LiteralPath $tmp -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
  if ($null -eq $ffmpeg -or $null -eq $ffprobe) {
    throw 'The downloaded FFmpeg archive did not contain ffmpeg.exe and ffprobe.exe.'
  }
  Copy-Item -LiteralPath $ffmpeg.FullName -Destination (Join-Path $target 'ffmpeg.exe') -Force
  Copy-Item -LiteralPath $ffprobe.FullName -Destination (Join-Path $target 'ffprobe.exe') -Force
} finally {
  if (Test-Path -LiteralPath $tmp) {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
"#;

    let target_string = target_dir.to_string_lossy().to_string();
    let output = hidden_command("powershell.exe")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
            FFMPEG_ZIP_URL,
            &target_string,
        ])
        .output()
        .map_err(|e| format!("PowerShell unavailable: {}", e))?;

    if !output.status.success() {
        return Err(format_process_error(
            "Could not install FFmpeg helper",
            &output.stderr,
            &output.stdout,
        ));
    }

    let ffmpeg_path = target_dir.join("ffmpeg.exe");
    let ffprobe_path = target_dir.join("ffprobe.exe");
    if validate_ffmpeg_pair(&ffmpeg_path, &ffprobe_path) {
        Ok(())
    } else {
        let _ = fs::remove_file(ffmpeg_path);
        let _ = fs::remove_file(ffprobe_path);
        Err("Downloaded FFmpeg helper could not be validated.".to_string())
    }
}

fn validate_ffmpeg_pair(ffmpeg_path: &Path, ffprobe_path: &Path) -> bool {
    command_version_works(ffmpeg_path) && command_version_works(ffprobe_path)
}

fn command_version_works(path: &Path) -> bool {
    hidden_command(path)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn get_ffmpeg_version(ffmpeg_path: &str) -> Option<String> {
    hidden_command(ffmpeg_path)
        .args(["-version"])
        .output()
        .ok()
        .and_then(|output| {
            String::from_utf8(output.stdout)
                .ok()
                .and_then(|s| s.lines().next().map(|l| l.to_string()))
        })
}

fn format_process_error(prefix: &str, stderr: &[u8], stdout: &[u8]) -> String {
    let details = [stderr, stdout]
        .into_iter()
        .flat_map(|bytes| {
            String::from_utf8_lossy(bytes)
                .lines()
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .take(4)
        .collect::<Vec<_>>()
        .join(" ");

    if details.is_empty() {
        prefix.to_string()
    } else {
        format!("{}: {}", prefix, details)
    }
}

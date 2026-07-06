use crate::utils::paths::get_app_data_dir;
use crate::utils::process::{hidden_command, ps_single_quote};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

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

    let temp_root = std::env::temp_dir().join(format!("salafi-ffmpeg-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_root).map_err(|e| e.to_string())?;

    // Do the work inside a closure so the temp folder is always cleaned up afterwards.
    let outcome = (|| {
        let zip_path = temp_root.join("ffmpeg.zip");
        download_ffmpeg_zip(&zip_path)?;
        extract_zip(&zip_path, &temp_root)?;

        let (ffmpeg_src, ffprobe_src) = locate_ffmpeg_binaries(&temp_root)?;
        let ffmpeg_dest = target_dir.join("ffmpeg.exe");
        let ffprobe_dest = target_dir.join("ffprobe.exe");
        copy_file(&ffmpeg_src, &ffmpeg_dest)?;
        copy_file(&ffprobe_src, &ffprobe_dest)?;

        if validate_ffmpeg_pair(&ffmpeg_dest, &ffprobe_dest) {
            Ok(())
        } else {
            let _ = fs::remove_file(&ffmpeg_dest);
            let _ = fs::remove_file(&ffprobe_dest);
            Err("The downloaded FFmpeg helper could not be validated.".to_string())
        }
    })();

    let _ = fs::remove_dir_all(&temp_root);
    outcome
}

fn copy_file(src: &Path, dest: &Path) -> Result<(), String> {
    fs::copy(src, dest)
        .map(|_| ())
        .map_err(|e| format!("Could not copy {}: {}", src.display(), e))
}

fn download_ffmpeg_zip(zip_path: &Path) -> Result<(), String> {
    let mut errors = Vec::new();

    match download_url_with_curl(FFMPEG_ZIP_URL, zip_path) {
        Ok(()) if zip_looks_complete(zip_path) => return Ok(()),
        Ok(()) => errors.push("curl produced an incomplete archive".to_string()),
        Err(error) => errors.push(error),
    }
    let _ = fs::remove_file(zip_path);

    match download_url_with_powershell(FFMPEG_ZIP_URL, zip_path) {
        Ok(()) if zip_looks_complete(zip_path) => return Ok(()),
        Ok(()) => errors.push("PowerShell produced an incomplete archive".to_string()),
        Err(error) => errors.push(error),
    }
    let _ = fs::remove_file(zip_path);

    Err(format!(
        "Could not download FFmpeg. Check your internet connection and try again. Details: {}",
        errors.join(" | ")
    ))
}

fn zip_looks_complete(zip_path: &Path) -> bool {
    fs::metadata(zip_path)
        .map(|metadata| metadata.len() > 1_000_000)
        .unwrap_or(false)
}

fn download_url_with_curl(url: &str, dest: &Path) -> Result<(), String> {
    let dest_string = dest.to_string_lossy().to_string();
    let output = hidden_command("curl.exe")
        .args([
            "-L",
            "--fail",
            "--retry",
            "3",
            "--retry-delay",
            "2",
            "--connect-timeout",
            "30",
            "-o",
            &dest_string,
            url,
        ])
        .output()
        .map_err(|e| format!("curl unavailable: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_process_error(
            "curl download failed",
            &output.stderr,
            &[],
        ))
    }
}

fn download_url_with_powershell(url: &str, dest: &Path) -> Result<(), String> {
    let script = format!(
        "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri {} -OutFile {}",
        ps_single_quote(url),
        ps_single_quote(&dest.to_string_lossy()),
    );
    run_powershell_script(&script).map_err(|error| format!("PowerShell download failed: {}", error))
}

fn extract_zip(zip_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let script = format!(
        "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath {} -DestinationPath {} -Force",
        ps_single_quote(&zip_path.to_string_lossy()),
        ps_single_quote(&dest_dir.to_string_lossy()),
    );
    run_powershell_script(&script)
        .map_err(|error| format!("Could not extract the FFmpeg archive: {}", error))
}

fn locate_ffmpeg_binaries(root: &Path) -> Result<(PathBuf, PathBuf), String> {
    let mut ffmpeg = None;
    let mut ffprobe = None;

    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        match entry
            .file_name()
            .to_str()
            .map(|name| name.to_lowercase())
            .as_deref()
        {
            Some("ffmpeg.exe") if ffmpeg.is_none() => ffmpeg = Some(entry.path().to_path_buf()),
            Some("ffprobe.exe") if ffprobe.is_none() => ffprobe = Some(entry.path().to_path_buf()),
            _ => {}
        }
        if ffmpeg.is_some() && ffprobe.is_some() {
            break;
        }
    }

    match (ffmpeg, ffprobe) {
        (Some(ffmpeg), Some(ffprobe)) => Ok((ffmpeg, ffprobe)),
        _ => Err(
            "The downloaded FFmpeg archive did not contain ffmpeg.exe and ffprobe.exe.".to_string(),
        ),
    }
}

fn run_powershell_script(script: &str) -> Result<(), String> {
    let output = hidden_command("powershell.exe")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .map_err(|e| format!("PowerShell unavailable: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(format_process_error(
            "PowerShell failed",
            &output.stderr,
            &output.stdout,
        ))
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

use crate::utils::process::hidden_command;
use std::path::PathBuf;

pub fn detect_ffmpeg() -> (Option<String>, Option<String>, String, Option<String>) {
    // 1. Check bundled binaries
    let bundled_ffmpeg = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("ffmpeg.exe")))
        .filter(|p| p.exists());

    let bundled_ffprobe = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.join("ffprobe.exe")))
        .filter(|p| p.exists());

    if let (Some(ff), Some(fp)) = (bundled_ffmpeg, bundled_ffprobe) {
        let version = get_ffmpeg_version(ff.to_str().unwrap());
        return (
            ff.to_str().map(|s| s.to_string()),
            fp.to_str().map(|s| s.to_string()),
            "bundled".to_string(),
            version,
        );
    }

    // 2. Check PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for path_dir in path_var.split(';') {
            let ffmpeg_path = PathBuf::from(path_dir).join("ffmpeg.exe");
            let ffprobe_path = PathBuf::from(path_dir).join("ffprobe.exe");

            if ffmpeg_path.exists() && ffprobe_path.exists() {
                let version = get_ffmpeg_version(ffmpeg_path.to_str().unwrap());
                return (
                    ffmpeg_path.to_str().map(|s| s.to_string()),
                    ffprobe_path.to_str().map(|s| s.to_string()),
                    "system".to_string(),
                    version,
                );
            }
        }
    }

    // 3. Check common locations on Windows
    let common_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe",
    ];

    for path_str in &common_paths {
        let ffmpeg_path = PathBuf::from(path_str);
        let ffprobe_path = PathBuf::from(path_str.replace("ffmpeg.exe", "ffprobe.exe"));

        if ffmpeg_path.exists() && ffprobe_path.exists() {
            let version = get_ffmpeg_version(path_str);
            return (
                Some(path_str.to_string()),
                Some(path_str.replace("ffmpeg.exe", "ffprobe.exe")),
                "system".to_string(),
                version,
            );
        }
    }

    (None, None, "missing".to_string(), None)
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

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::Serialize;
use uuid::Uuid;
use walkdir::WalkDir;

use crate::db;
use crate::db::DbState;
use crate::models::playlist::Playlist;
use crate::models::video::Video;

const VIDEO_EXTENSIONS: &[&str] = &["mp4", "mkv", "webm", "mov", "avi", "m4v"];

#[derive(Debug, Clone, Serialize)]
pub struct ImportResult {
    pub imported_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
    pub playlist_id: Option<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ImportOutcome {
    pub result: ImportResult,
    pub video_ids_for_background: Vec<String>,
}

#[derive(Debug, Clone)]
struct ScannedFile {
    path: PathBuf,
    file_name: String,
    size: i64,
    modified_at: i64,
}

#[derive(Debug, Default)]
struct ScanResult {
    files: Vec<ScannedFile>,
    skipped_count: usize,
    failed_count: usize,
    errors: Vec<String>,
}

pub fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn clean_filename(filename: &str) -> String {
    let name = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let re = Regex::new(r"[_\-.]+").unwrap();
    let name = re.replace_all(name, " ");

    let re = Regex::new(r"\s+").unwrap();
    let name = re.replace_all(&name, " ");

    name.trim().to_string()
}

pub fn guess_category(folder_name: &str) -> Option<String> {
    let lower = folder_name.to_lowercase();
    let categories = [
        ("quran", "Quran"),
        ("hadith", "Hadith"),
        ("tafsir", "Tafsir"),
        ("aqeedah", "Aqeedah"),
        ("aqidah", "Aqeedah"),
        ("tawheed", "Tawheed"),
        ("manhaj", "Manhaj"),
        ("fiqh", "Fiqh"),
        ("seerah", "Seerah"),
        ("arabic", "Arabic Lessons"),
        ("refutation", "Refutations"),
        ("refutations", "Refutations"),
        ("clip", "Short Clips"),
        ("clips", "Short Clips"),
        ("lesson", "Long Lessons"),
        ("lessons", "Long Lessons"),
        ("lecture", "Long Lessons"),
        ("lectures", "Long Lessons"),
    ];

    for (keyword, category) in &categories {
        if lower.contains(keyword) {
            return Some(category.to_string());
        }
    }

    None
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn file_modified_millis(metadata: &std::fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn scan_folder(path: &str, include_subfolders: bool) -> ScanResult {
    let mut result = ScanResult::default();
    let walker = if include_subfolders {
        WalkDir::new(path)
    } else {
        WalkDir::new(path).max_depth(1)
    };

    for entry in walker.into_iter() {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                result.failed_count += 1;
                result
                    .errors
                    .push(format!("Could not read an entry: {}", error));
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        if !is_video_file(file_path) {
            result.skipped_count += 1;
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                result.failed_count += 1;
                result.errors.push(format!(
                    "Could not read metadata for {}: {}",
                    path_to_string(file_path),
                    error
                ));
                continue;
            }
        };

        let file_name = file_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("")
            .to_string();

        result.files.push(ScannedFile {
            path: file_path.to_path_buf(),
            file_name,
            size: metadata.len() as i64,
            modified_at: file_modified_millis(&metadata),
        });
    }

    result.files.sort_by(|a, b| {
        let name_order = natord::compare(&a.file_name, &b.file_name);
        if name_order == std::cmp::Ordering::Equal {
            natord::compare(&path_to_string(&a.path), &path_to_string(&b.path))
        } else {
            name_order
        }
    });

    result
}

fn load_videos_for_ids(db: &DbState, video_ids: &[String]) -> Result<Vec<Video>, String> {
    let mut videos = Vec::with_capacity(video_ids.len());
    for id in video_ids {
        if let Some(video) = db::video::get_video_by_id(db, id).map_err(|e| e.to_string())? {
            videos.push(video);
        }
    }
    Ok(videos)
}

fn unique_video_ids(video_ids: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    video_ids
        .into_iter()
        .filter(|id| seen.insert(id.clone()))
        .collect()
}

fn thumbnail_needs_background_generation(status: &str) -> bool {
    matches!(status, "missing" | "queued" | "generating")
}

fn save_playlist_for_ids(
    db: &DbState,
    existing: Option<Playlist>,
    folder_path: &str,
    folder_name: String,
    video_ids: Vec<String>,
    category: Option<String>,
    now: i64,
) -> Result<Playlist, String> {
    let video_ids = unique_video_ids(video_ids);
    let videos = load_videos_for_ids(db, &video_ids)?;
    let total_duration = videos.iter().map(|video| video.duration_seconds).sum();
    let total_progress = videos.iter().map(|video| video.progress_seconds).sum();
    let thumbnail_path = videos.iter().find_map(|video| video.thumbnail_path.clone());

    let playlist = Playlist {
        id: existing
            .as_ref()
            .map(|playlist| playlist.id.clone())
            .unwrap_or_else(|| Uuid::new_v4().to_string()),
        name: existing
            .as_ref()
            .map(|playlist| playlist.name.clone())
            .unwrap_or(folder_name),
        folder_path: folder_path.to_string(),
        video_ids,
        video_count: videos.len() as i64,
        total_duration_seconds: total_duration,
        progress_seconds: total_progress,
        thumbnail_path,
        category,
        created_at: existing
            .as_ref()
            .map(|playlist| playlist.created_at)
            .unwrap_or(now),
        updated_at: now,
    };

    db::playlist::insert_playlist(db, &playlist).map_err(|e| e.to_string())?;
    Ok(playlist)
}

fn build_video_from_scanned_file(
    scanned: &ScannedFile,
    category: Option<String>,
    now: i64,
) -> Video {
    let extension = scanned
        .path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    let parent = scanned
        .path
        .parent()
        .map(path_to_string)
        .unwrap_or_default();

    Video {
        id: Uuid::new_v4().to_string(),
        title: clean_filename(&scanned.file_name),
        file_path: path_to_string(&scanned.path),
        folder_path: parent,
        file_name: scanned.file_name.clone(),
        extension,
        file_size: scanned.size,
        modified_at: scanned.modified_at,
        created_at: now,
        updated_at: now,
        thumbnail_status: "queued".to_string(),
        category,
        playable_status: "unknown".to_string(),
        ..Video::default()
    }
}

pub fn import_folder(
    db: &DbState,
    folder_path: &str,
    include_subfolders: bool,
) -> Result<ImportOutcome, String> {
    let folder = Path::new(folder_path);
    if !folder.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !folder.is_dir() {
        return Err(format!("Selected path is not a folder: {}", folder_path));
    }

    let folder_name = folder
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported Videos")
        .to_string();
    let category = guess_category(&folder_name);
    let existing =
        db::playlist::get_playlist_by_folder(db, folder_path).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let scan = scan_folder(folder_path, include_subfolders);

    let mut imported_count = 0usize;
    let mut skipped_count = scan.skipped_count;
    let mut failed_count = scan.failed_count;
    let mut errors = scan.errors;
    let mut playlist_video_ids = Vec::new();
    let mut background_video_ids = Vec::new();

    for scanned in scan.files {
        let path_str = path_to_string(&scanned.path);

        match db::video::get_video_by_path(db, &path_str).map_err(|e| e.to_string())? {
            Some(existing_video) => {
                skipped_count += 1;
                playlist_video_ids.push(existing_video.id.clone());
                if thumbnail_needs_background_generation(&existing_video.thumbnail_status) {
                    background_video_ids.push(existing_video.id);
                }
            }
            None => {
                let video = build_video_from_scanned_file(&scanned, category.clone(), now);
                match db::video::insert_video(db, &video) {
                    Ok(()) => {
                        imported_count += 1;
                        playlist_video_ids.push(video.id.clone());
                        background_video_ids.push(video.id);
                    }
                    Err(error) => {
                        failed_count += 1;
                        errors.push(format!("Could not import {}: {}", path_str, error));
                    }
                }
            }
        }
    }

    if playlist_video_ids.is_empty() && existing.is_none() {
        errors.push(format!(
            "No supported video files found. Supported extensions: {}",
            VIDEO_EXTENSIONS
                .iter()
                .map(|ext| format!(".{}", ext))
                .collect::<Vec<_>>()
                .join(", ")
        ));
        return Ok(ImportOutcome {
            result: ImportResult {
                imported_count,
                skipped_count,
                failed_count,
                playlist_id: None,
                errors,
            },
            video_ids_for_background: Vec::new(),
        });
    }

    let playlist = save_playlist_for_ids(
        db,
        existing,
        folder_path,
        folder_name,
        playlist_video_ids,
        category,
        now,
    )?;
    db::settings::add_imported_folder(db, folder_path).map_err(|e| e.to_string())?;

    Ok(ImportOutcome {
        result: ImportResult {
            imported_count,
            skipped_count,
            failed_count,
            playlist_id: Some(playlist.id),
            errors,
        },
        video_ids_for_background: unique_video_ids(background_video_ids),
    })
}

pub fn import_single_video(db: &DbState, video_path: &str) -> Result<ImportOutcome, String> {
    let path = Path::new(video_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", video_path));
    }
    if !path.is_file() {
        return Err(format!("Selected path is not a file: {}", video_path));
    }

    if !is_video_file(path) {
        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| format!(".{}", ext))
            .unwrap_or_else(|| "unknown".to_string());
        return Ok(ImportOutcome {
            result: ImportResult {
                imported_count: 0,
                skipped_count: 1,
                failed_count: 0,
                playlist_id: None,
                errors: vec![format!("Unsupported video type: {}", extension)],
            },
            video_ids_for_background: Vec::new(),
        });
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Could not resolve the selected file folder".to_string())?;
    let parent_path = path_to_string(parent);
    let folder_name = parent
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Imported Videos")
        .to_string();
    let category = guess_category(&folder_name);
    let existing_playlist =
        db::playlist::get_playlist_by_folder(db, &parent_path).map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let mut imported_count = 0usize;
    let mut skipped_count = 0usize;
    let mut failed_count = 0usize;
    let mut errors = Vec::new();
    let mut background_video_ids = Vec::new();

    let mut playlist_video_ids = existing_playlist
        .as_ref()
        .map(|playlist| playlist.video_ids.clone())
        .unwrap_or_default();

    let path_str = path_to_string(path);
    let video_id = match db::video::get_video_by_path(db, &path_str).map_err(|e| e.to_string())? {
        Some(existing_video) => {
            skipped_count += 1;
            if thumbnail_needs_background_generation(&existing_video.thumbnail_status) {
                background_video_ids.push(existing_video.id.clone());
            }
            existing_video.id
        }
        None => {
            let metadata = match std::fs::metadata(path) {
                Ok(metadata) => metadata,
                Err(error) => {
                    failed_count += 1;
                    errors.push(format!(
                        "Could not read metadata for {}: {}",
                        video_path, error
                    ));
                    return Ok(ImportOutcome {
                        result: ImportResult {
                            imported_count,
                            skipped_count,
                            failed_count,
                            playlist_id: existing_playlist
                                .as_ref()
                                .map(|playlist| playlist.id.clone()),
                            errors,
                        },
                        video_ids_for_background: Vec::new(),
                    });
                }
            };

            let scanned = ScannedFile {
                path: path.to_path_buf(),
                file_name: path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("")
                    .to_string(),
                size: metadata.len() as i64,
                modified_at: file_modified_millis(&metadata),
            };
            let video = build_video_from_scanned_file(&scanned, category.clone(), now);
            db::video::insert_video(db, &video).map_err(|e| e.to_string())?;
            imported_count += 1;
            background_video_ids.push(video.id.clone());
            video.id
        }
    };

    playlist_video_ids.push(video_id);
    let playlist = save_playlist_for_ids(
        db,
        existing_playlist,
        &parent_path,
        folder_name,
        playlist_video_ids,
        category,
        now,
    )?;
    db::settings::add_imported_folder(db, &parent_path).map_err(|e| e.to_string())?;

    Ok(ImportOutcome {
        result: ImportResult {
            imported_count,
            skipped_count,
            failed_count,
            playlist_id: Some(playlist.id),
            errors,
        },
        video_ids_for_background: unique_video_ids(background_video_ids),
    })
}

pub fn rescan_folder(db: &DbState, folder_path: &str) -> Result<Playlist, String> {
    let outcome = import_folder(db, folder_path, true)?;
    let playlist_id = outcome
        .result
        .playlist_id
        .ok_or_else(|| "No playlist was created during rescan".to_string())?;
    db::playlist::get_playlist_by_id(db, &playlist_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Playlist not found after rescan".to_string())
}

use crate::db::DbState;
use crate::models::settings::Settings;
use rusqlite::{params, Result, Row};
use serde_json;

fn row_to_settings(row: &Row) -> Result<Settings> {
    let folders_json: String = row.get(3)?;
    let imported_folders: Vec<String> = serde_json::from_str(&folders_json).unwrap_or_default();
    let automatic_thumbnails_mode: String = row.get(8)?;

    Ok(Settings {
        id: row.get(0)?,
        language: {
            let language: String = row.get(1)?;
            if language == "ar" {
                "ar".to_string()
            } else {
                "en".to_string()
            }
        },
        theme: {
            // Persist whatever theme id was stored; the frontend validates the
            // list. (A hard-coded allow-list here used to silently reset new
            // themes like "blue"/"red" back to "noor" on every reload.)
            let theme: String = row.get(2).unwrap_or_default();
            if theme.trim().is_empty() {
                "noor".to_string()
            } else {
                theme
            }
        },
        imported_folders,
        thumbnail_cache_path: row.get(4)?,
        ffmpeg_path: row.get(5)?,
        ffprobe_path: row.get(6)?,
        ffmpeg_status: row.get(7)?,
        automatic_thumbnails_mode: if automatic_thumbnails_mode.trim().is_empty() {
            "automatic".to_string()
        } else {
            automatic_thumbnails_mode
        },
        performance_mode: row.get::<_, i64>(9)? != 0,
        reminder_sound_path: row.get(10)?,
        reminder_volume: {
            let volume: f64 = row.get(11)?;
            if volume <= 1.0 {
                volume * 100.0
            } else {
                volume
            }
        },
        run_in_tray: row.get::<_, i64>(12)? != 0,
        last_opened_playlist_id: row.get(13)?,
        last_played_video_id: row.get(14)?,
    })
}

pub fn get_settings(db: &DbState) -> Result<Settings> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, language, theme, imported_folders, thumbnail_cache_path, ffmpeg_path,
            ffprobe_path, ffmpeg_status, automatic_thumbnails_mode, performance_mode,
            reminder_sound_path, reminder_volume, run_in_tray, last_opened_playlist_id,
            last_played_video_id
        FROM settings
        WHERE id = 'default'",
    )?;
    let mut rows = stmt.query([])?;

    if let Some(row) = rows.next()? {
        Ok(row_to_settings(row)?)
    } else {
        // Create default settings
        conn.execute(
            "INSERT INTO settings (id, imported_folders) VALUES ('default', '[]')",
            [],
        )?;
        Ok(Settings::default())
    }
}

pub fn update_settings(db: &DbState, settings: &Settings) -> Result<()> {
    let conn = db.lock().unwrap();
    let folders_json = serde_json::to_string(&settings.imported_folders).unwrap_or_default();

    conn.execute(
        "UPDATE settings SET
            language = ?1, theme = ?2, imported_folders = ?3, thumbnail_cache_path = ?4,
            ffmpeg_path = ?5, ffprobe_path = ?6, ffmpeg_status = ?7,
            automatic_thumbnails_mode = ?8, performance_mode = ?9,
            reminder_sound_path = ?10, reminder_volume = ?11, run_in_tray = ?12,
            last_opened_playlist_id = ?13, last_played_video_id = ?14
        WHERE id = 'default'",
        params![
            &settings.language,
            &settings.theme,
            &folders_json,
            &settings.thumbnail_cache_path,
            &settings.ffmpeg_path,
            &settings.ffprobe_path,
            &settings.ffmpeg_status,
            &settings.automatic_thumbnails_mode,
            settings.performance_mode as i64,
            &settings.reminder_sound_path,
            settings.reminder_volume,
            settings.run_in_tray as i64,
            &settings.last_opened_playlist_id,
            &settings.last_played_video_id
        ],
    )?;
    Ok(())
}

pub fn add_imported_folder(db: &DbState, folder: &str) -> Result<()> {
    let mut settings = get_settings(db)?;
    if !settings.imported_folders.contains(&folder.to_string()) {
        settings.imported_folders.push(folder.to_string());
        update_settings(db, &settings)?;
    }
    Ok(())
}

pub fn remove_imported_folder(db: &DbState, folder: &str) -> Result<()> {
    let mut settings = get_settings(db)?;
    settings.imported_folders.retain(|f| f != folder);
    update_settings(db, &settings)?;
    Ok(())
}

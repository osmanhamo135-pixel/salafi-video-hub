use rusqlite::{Connection, Result};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

use crate::utils::paths::get_db_path;

pub type DbState = Arc<Mutex<Connection>>;

pub fn init_db(app_handle: &AppHandle) -> Result<DbState> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;
    let db = Arc::new(Mutex::new(conn));
    create_tables(&db)?;
    Ok(db)
}

pub fn create_tables(db: &DbState) -> Result<()> {
    let conn = db.lock().unwrap();

    conn.execute_batch(
        "BEGIN;
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL UNIQUE,
            folder_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            extension TEXT NOT NULL,
            duration_seconds INTEGER DEFAULT 0,
            thumbnail_path TEXT,
            thumbnail_status TEXT DEFAULT 'missing',
            category TEXT,
            speaker TEXT,
            description TEXT,
            progress_seconds INTEGER DEFAULT 0,
            completed INTEGER DEFAULT 0,
            favorite INTEGER DEFAULT 0,
            watch_later INTEGER DEFAULT 0,
            file_size INTEGER DEFAULT 0,
            modified_at INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0,
            last_played_at INTEGER,
            playable_status TEXT DEFAULT 'unknown',
            last_playback_error TEXT,
            codec_info TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_path);
        CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
        CREATE INDEX IF NOT EXISTS idx_videos_playable ON videos(playable_status);
        CREATE INDEX IF NOT EXISTS idx_videos_favorite ON videos(favorite);
        CREATE INDEX IF NOT EXISTS idx_videos_completed ON videos(completed);

        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            folder_path TEXT NOT NULL UNIQUE,
            video_ids TEXT NOT NULL,
            video_count INTEGER DEFAULT 0,
            total_duration_seconds INTEGER DEFAULT 0,
            progress_seconds INTEGER DEFAULT 0,
            thumbnail_path TEXT,
            category TEXT,
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_playlists_category ON playlists(category);

        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            target_type TEXT NOT NULL,
            target_id TEXT NOT NULL,
            time TEXT NOT NULL,
            repeat TEXT DEFAULT 'none',
            custom_days TEXT,
            sound_path TEXT,
            volume REAL DEFAULT 0.7,
            last_triggered_at INTEGER,
            last_fired_key TEXT,
            created_at INTEGER DEFAULT 0,
            updated_at INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
            id TEXT PRIMARY KEY DEFAULT 'default',
            language TEXT DEFAULT 'en',
            theme TEXT DEFAULT 'noor',
            imported_folders TEXT NOT NULL,
            thumbnail_cache_path TEXT,
            ffmpeg_path TEXT,
            ffprobe_path TEXT,
            ffmpeg_status TEXT DEFAULT 'missing',
            automatic_thumbnails_mode TEXT DEFAULT 'idle-only',
            performance_mode INTEGER DEFAULT 1,
            reminder_sound_path TEXT,
            reminder_volume REAL DEFAULT 80,
            run_in_tray INTEGER DEFAULT 0,
            last_opened_playlist_id TEXT,
            last_played_video_id TEXT
        );
        
        INSERT OR IGNORE INTO settings (id, imported_folders) VALUES ('default', '[]');
        COMMIT;",
    )?;

    ensure_column(&conn, "settings", "language", "TEXT DEFAULT 'en'")?;
    ensure_column(&conn, "settings", "theme", "TEXT DEFAULT 'noor'")?;

    Ok(())
}

fn ensure_column(conn: &Connection, table: &str, column: &str, definition: &str) -> Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

    for existing in columns {
        if existing? == column {
            return Ok(());
        }
    }

    conn.execute(
        &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition),
        [],
    )?;
    Ok(())
}

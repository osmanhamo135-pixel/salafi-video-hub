pub mod playlist;
pub mod reminder;
pub mod schema;
pub mod settings;
pub mod video;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbState = Arc<Mutex<Connection>>;

pub fn get_db() -> Result<DbState, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or_else(|| "Could not find data directory".to_string())?
        .join("com.salafivideohub.app");

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = app_data_dir.join("salafi_video_hub.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    Ok(Arc::new(Mutex::new(conn)))
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let escaped_table = table.replace('"', "\"\"");
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info(\"{}\")", escaped_table))
        .map_err(|e| format!("Failed to inspect {} table: {}", table, e))?;
    let mut rows = stmt
        .query([])
        .map_err(|e| format!("Failed to read {} table columns: {}", table, e))?;

    while let Some(row) = rows
        .next()
        .map_err(|e| format!("Failed to read {} table column row: {}", table, e))?
    {
        let name: String = row
            .get(1)
            .map_err(|e| format!("Failed to read {} table column name: {}", table, e))?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    if !column_exists(conn, table, column)? {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition),
            [],
        )
        .map_err(|e| format!("Failed to add {}.{} column: {}", table, column, e))?;
    }

    Ok(())
}

fn ensure_schema_columns(conn: &Connection) -> Result<(), String> {
    for (column, definition) in [
        ("title", "TEXT NOT NULL DEFAULT ''"),
        ("file_path", "TEXT NOT NULL DEFAULT ''"),
        ("folder_path", "TEXT NOT NULL DEFAULT ''"),
        ("file_name", "TEXT NOT NULL DEFAULT ''"),
        ("extension", "TEXT NOT NULL DEFAULT ''"),
        ("duration_seconds", "INTEGER DEFAULT 0"),
        ("thumbnail_path", "TEXT"),
        ("thumbnail_status", "TEXT DEFAULT 'missing'"),
        ("category", "TEXT"),
        ("speaker", "TEXT"),
        ("description", "TEXT"),
        ("progress_seconds", "INTEGER DEFAULT 0"),
        ("completed", "INTEGER DEFAULT 0"),
        ("favorite", "INTEGER DEFAULT 0"),
        ("watch_later", "INTEGER DEFAULT 0"),
        ("file_size", "INTEGER DEFAULT 0"),
        ("modified_at", "INTEGER DEFAULT 0"),
        ("created_at", "INTEGER DEFAULT 0"),
        ("updated_at", "INTEGER DEFAULT 0"),
        ("last_played_at", "INTEGER"),
        ("playable_status", "TEXT DEFAULT 'unknown'"),
        ("last_playback_error", "TEXT"),
        ("codec_info", "TEXT"),
    ] {
        ensure_column(conn, "videos", column, definition)?;
    }

    for (column, definition) in [
        ("name", "TEXT NOT NULL DEFAULT ''"),
        ("folder_path", "TEXT NOT NULL DEFAULT ''"),
        ("video_ids", "TEXT NOT NULL DEFAULT '[]'"),
        ("video_count", "INTEGER DEFAULT 0"),
        ("total_duration_seconds", "INTEGER DEFAULT 0"),
        ("progress_seconds", "INTEGER DEFAULT 0"),
        ("thumbnail_path", "TEXT"),
        ("category", "TEXT"),
        ("created_at", "INTEGER DEFAULT 0"),
        ("updated_at", "INTEGER DEFAULT 0"),
    ] {
        ensure_column(conn, "playlists", column, definition)?;
    }

    for (column, definition) in [
        ("title", "TEXT NOT NULL DEFAULT ''"),
        ("enabled", "INTEGER DEFAULT 1"),
        ("target_type", "TEXT NOT NULL DEFAULT 'playlist'"),
        ("target_id", "TEXT NOT NULL DEFAULT ''"),
        ("time", "TEXT NOT NULL DEFAULT ''"),
        ("repeat", "TEXT DEFAULT 'none'"),
        ("custom_days", "TEXT"),
        ("sound_path", "TEXT"),
        ("volume", "REAL DEFAULT 0.7"),
        ("last_triggered_at", "INTEGER"),
        ("last_fired_key", "TEXT"),
        ("created_at", "INTEGER DEFAULT 0"),
        ("updated_at", "INTEGER DEFAULT 0"),
    ] {
        ensure_column(conn, "reminders", column, definition)?;
    }

    for (column, definition) in [
        ("id", "TEXT DEFAULT 'default'"),
        ("language", "TEXT DEFAULT 'en'"),
        ("theme", "TEXT DEFAULT 'noor'"),
        ("imported_folders", "TEXT NOT NULL DEFAULT '[]'"),
        ("thumbnail_cache_path", "TEXT"),
        ("ffmpeg_path", "TEXT"),
        ("ffprobe_path", "TEXT"),
        ("ffmpeg_status", "TEXT DEFAULT 'missing'"),
        ("automatic_thumbnails_mode", "TEXT DEFAULT 'automatic'"),
        ("performance_mode", "INTEGER DEFAULT 1"),
        ("reminder_sound_path", "TEXT"),
        ("reminder_volume", "REAL DEFAULT 0.7"),
        ("run_in_tray", "INTEGER DEFAULT 0"),
        ("last_opened_playlist_id", "TEXT"),
        ("last_played_video_id", "TEXT"),
    ] {
        ensure_column(conn, "settings", column, definition)?;
    }

    Ok(())
}

pub fn init_database() -> Result<DbState, String> {
    let db = get_db()?;
    {
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
                automatic_thumbnails_mode TEXT DEFAULT 'automatic',
                performance_mode INTEGER DEFAULT 1,
                reminder_sound_path TEXT,
                reminder_volume REAL DEFAULT 0.7,
                run_in_tray INTEGER DEFAULT 0,
                last_opened_playlist_id TEXT,
                last_played_video_id TEXT
            );
            COMMIT;",
        )
        .map_err(|e| format!("Failed to initialize database schema: {}", e))?;

        ensure_schema_columns(&conn)?;

        conn.execute_batch(
            "CREATE INDEX IF NOT EXISTS idx_videos_folder ON videos(folder_path);
            CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
            CREATE INDEX IF NOT EXISTS idx_videos_playable ON videos(playable_status);
            CREATE INDEX IF NOT EXISTS idx_videos_favorite ON videos(favorite);
            CREATE INDEX IF NOT EXISTS idx_videos_completed ON videos(completed);
            CREATE INDEX IF NOT EXISTS idx_videos_last_played ON videos(last_played_at DESC);
            CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_playlists_category ON playlists(category);
            INSERT INTO settings (id, imported_folders)
            SELECT 'default', '[]'
            WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 'default');
            ",
        )
        .map_err(|e| format!("Failed to initialize database schema: {}", e))?;
    }
    Ok(db)
}

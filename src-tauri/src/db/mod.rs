pub mod playlist;
pub mod reminder;
pub mod schema;
pub mod settings;
pub mod video;

use rusqlite::Connection;
use std::sync::{Arc, Mutex};

pub type DbState = Arc<Mutex<Connection>>;

/// Locks the shared connection, recovering from a poisoned mutex.
///
/// A panic anywhere while the connection is held — a bad column index, a
/// non-UTF-8 path — poisons the mutex, and every plain `.lock().unwrap()` after
/// it panics too. That turned one bad row into a dead session: library,
/// settings and reminders all failing until the app was restarted.
///
/// Recovering is safe here because no application code holds an open
/// transaction across a point where it could panic; the only `BEGIN` blocks are
/// single `execute_batch` calls during schema setup. Statements are atomic, so
/// the connection is not left half-written.
pub fn lock_conn(db: &DbState) -> std::sync::MutexGuard<'_, Connection> {
    db.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

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
        ("volume", "REAL DEFAULT 70.0"),
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
        ("reminder_volume", "REAL DEFAULT 70.0"),
        ("run_in_tray", "INTEGER DEFAULT 0"),
        ("last_opened_playlist_id", "TEXT"),
        ("last_played_video_id", "TEXT"),
    ] {
        ensure_column(conn, "settings", column, definition)?;
    }

    migrate_volumes_to_percent(conn)?;

    Ok(())
}

/// Moves stored reminder volumes onto a single 0-100 scale, once.
///
/// Both columns default to `0.7` while the UI has always written 0-100, so the
/// two scales coexisted in the same column and both sides guessed with a
/// "<= 1 means it's a fraction" heuristic. That guess is wrong in exactly one
/// place and it is the worst one: a user who drags the slider to 1% got a
/// full-volume alarm. It also rendered a legacy `0.7` row as "0.7 %".
///
/// Anything <= 1 is a pre-scale value here, because this runs before any newer
/// value can have been written. `user_version` guards it so a genuine 1% set
/// afterwards is never re-scaled.
fn migrate_volumes_to_percent(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|e| format!("Failed to read schema version: {}", e))?;
    if version >= 1 {
        return Ok(());
    }

    conn.execute(
        "UPDATE settings SET reminder_volume = reminder_volume * 100.0 WHERE reminder_volume <= 1.0",
        [],
    )
    .map_err(|e| format!("Failed to migrate reminder volume: {}", e))?;
    conn.execute(
        "UPDATE reminders SET volume = volume * 100.0 WHERE volume <= 1.0",
        [],
    )
    .map_err(|e| format!("Failed to migrate reminder volumes: {}", e))?;

    conn.execute("PRAGMA user_version = 1", [])
        .map_err(|e| format!("Failed to record schema version: {}", e))?;

    Ok(())
}

pub fn init_database() -> Result<DbState, String> {
    let db = get_db()?;
    {
        let conn = lock_conn(&db);
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
                volume REAL DEFAULT 70.0,
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
                reminder_volume REAL DEFAULT 70.0,
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

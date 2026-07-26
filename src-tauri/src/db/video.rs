use crate::db::{lock_conn, DbState};
use crate::models::video::Video;
use rusqlite::{params, params_from_iter, Result, Row};

/// The video columns, in exactly the order `row_to_video` reads them.
///
/// Every read of this table selects these names rather than `*`. With `SELECT *`
/// the column order comes from `CREATE TABLE` on a fresh database but from the
/// `ensure_column` upgrade order on an existing one, so a database whose
/// migration history added columns in a different sequence would silently map
/// `codec_info` into `playable_status` — or fail the query outright on a type
/// mismatch. Naming them makes the positional `row.get` indices below correct by
/// construction, whatever the physical layout.
const VIDEO_COLUMNS: &str = "id, title, file_path, folder_path, file_name, extension, \
     duration_seconds, thumbnail_path, thumbnail_status, category, speaker, description, \
     progress_seconds, completed, favorite, watch_later, file_size, modified_at, created_at, \
     updated_at, last_played_at, playable_status, last_playback_error, codec_info";

fn row_to_video(row: &Row) -> Result<Video> {
    Ok(Video {
        id: row.get(0)?,
        title: row.get(1)?,
        file_path: row.get(2)?,
        folder_path: row.get(3)?,
        file_name: row.get(4)?,
        extension: row.get(5)?,
        duration_seconds: row.get(6)?,
        thumbnail_path: row.get(7)?,
        thumbnail_status: row.get(8)?,
        category: row.get(9)?,
        speaker: row.get(10)?,
        description: row.get(11)?,
        progress_seconds: row.get(12)?,
        completed: row.get::<_, i64>(13)? != 0,
        favorite: row.get::<_, i64>(14)? != 0,
        watch_later: row.get::<_, i64>(15)? != 0,
        file_size: row.get(16)?,
        modified_at: row.get(17)?,
        created_at: row.get(18)?,
        updated_at: row.get(19)?,
        last_played_at: row.get(20)?,
        playable_status: row.get(21)?,
        last_playback_error: row.get(22)?,
        codec_info: row.get(23)?,
    })
}

pub fn insert_video(db: &DbState, video: &Video) -> Result<()> {
    let conn = lock_conn(db);
    conn.execute(
        "INSERT OR IGNORE INTO videos (
            id, title, file_path, folder_path, file_name, extension,
            duration_seconds, thumbnail_path, thumbnail_status, category,
            speaker, description, progress_seconds, completed, favorite,
            watch_later, file_size, modified_at, created_at, updated_at,
            last_played_at, playable_status, last_playback_error, codec_info
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
        params![
            &video.id, &video.title, &video.file_path, &video.folder_path,
            &video.file_name, &video.extension, video.duration_seconds,
            &video.thumbnail_path, &video.thumbnail_status, &video.category,
            &video.speaker, &video.description, video.progress_seconds,
            video.completed as i64, video.favorite as i64, video.watch_later as i64,
            video.file_size, video.modified_at, video.created_at, video.updated_at,
            video.last_played_at, &video.playable_status, &video.last_playback_error, &video.codec_info
        ],
    )?;
    Ok(())
}

pub fn update_video(db: &DbState, video: &Video) -> Result<()> {
    let conn = lock_conn(db);
    conn.execute(
        "UPDATE videos SET
            title = ?1, file_path = ?2, folder_path = ?3, file_name = ?4,
            extension = ?5, duration_seconds = ?6, thumbnail_path = ?7,
            thumbnail_status = ?8, category = ?9, speaker = ?10,
            description = ?11, progress_seconds = ?12, completed = ?13,
            favorite = ?14, watch_later = ?15, file_size = ?16,
            modified_at = ?17, updated_at = ?18, last_played_at = ?19,
            playable_status = ?20, last_playback_error = ?21, codec_info = ?22
        WHERE id = ?23",
        params![
            &video.title,
            &video.file_path,
            &video.folder_path,
            &video.file_name,
            &video.extension,
            video.duration_seconds,
            &video.thumbnail_path,
            &video.thumbnail_status,
            &video.category,
            &video.speaker,
            &video.description,
            video.progress_seconds,
            video.completed as i64,
            video.favorite as i64,
            video.watch_later as i64,
            video.file_size,
            video.modified_at,
            video.updated_at,
            video.last_played_at,
            &video.playable_status,
            &video.last_playback_error,
            &video.codec_info,
            &video.id
        ],
    )?;
    Ok(())
}

pub fn get_video_by_id(db: &DbState, id: &str) -> Result<Option<Video>> {
    let conn = lock_conn(db);
    let mut stmt = conn.prepare(&format!("SELECT {} FROM videos WHERE id = ?1", VIDEO_COLUMNS))?;
    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_video(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_video_by_path(db: &DbState, file_path: &str) -> Result<Option<Video>> {
    let conn = lock_conn(db);
    let mut stmt = conn.prepare(&format!("SELECT {} FROM videos WHERE file_path = ?1", VIDEO_COLUMNS))?;
    let mut rows = stmt.query(params![file_path])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_video(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_videos_by_folder(db: &DbState, folder_path: &str) -> Result<Vec<Video>> {
    let conn = lock_conn(db);
    let mut stmt =
        conn.prepare(&format!(
        "SELECT {} FROM videos WHERE folder_path = ?1 ORDER BY file_name",
        VIDEO_COLUMNS
    ))?;
    let rows = stmt.query_map(params![folder_path], row_to_video)?;
    rows.collect()
}

pub fn get_all_videos(db: &DbState) -> Result<Vec<Video>> {
    let conn = lock_conn(db);
    let mut stmt = conn.prepare(&format!("SELECT {} FROM videos ORDER BY title", VIDEO_COLUMNS))?;
    let rows = stmt.query_map([], row_to_video)?;
    rows.collect()
}

pub fn get_videos_by_ids(db: &DbState, ids: &[String]) -> Result<Vec<Video>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut unique_ids = Vec::new();
    for id in ids {
        if !id.trim().is_empty() && !unique_ids.iter().any(|existing| existing == id) {
            unique_ids.push(id.clone());
        }
    }

    if unique_ids.is_empty() {
        return Ok(Vec::new());
    }

    let conn = lock_conn(db);
    let placeholders = std::iter::repeat("?")
        .take(unique_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT {} FROM videos WHERE id IN ({}) ORDER BY title",
        VIDEO_COLUMNS,
        placeholders
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(unique_ids.iter()), row_to_video)?;
    rows.collect()
}

pub fn search_videos(db: &DbState, query: &str) -> Result<Vec<Video>> {
    let conn = lock_conn(db);
    // `%` and `_` are LIKE wildcards, so a title containing either matched far
    // more than the user typed. Escape them and declare the escape character.
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    let pattern = format!("%{}%", escaped);
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM videos WHERE
            title LIKE ?1 ESCAPE '\\' OR file_name LIKE ?1 ESCAPE '\\'
            OR category LIKE ?1 ESCAPE '\\' OR speaker LIKE ?1 ESCAPE '\\'
            OR folder_path LIKE ?1 ESCAPE '\\'
        ORDER BY title",
        VIDEO_COLUMNS
    ))?;
    let rows = stmt.query_map(params![pattern], row_to_video)?;
    rows.collect()
}

pub fn update_video_progress(db: &DbState, id: &str, progress: i64, completed: bool) -> Result<()> {
    let conn = lock_conn(db);
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET progress_seconds = ?1, completed = ?2, last_played_at = ?3, updated_at = ?4 WHERE id = ?5",
        params![progress, completed as i64, now, now, id],
    )?;
    Ok(())
}

pub fn update_video_favorite(db: &DbState, id: &str, favorite: bool) -> Result<()> {
    let conn = lock_conn(db);
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![favorite as i64, now, id],
    )?;
    Ok(())
}

pub fn update_video_watch_later(db: &DbState, id: &str, watch_later: bool) -> Result<()> {
    let conn = lock_conn(db);
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET watch_later = ?1, updated_at = ?2 WHERE id = ?3",
        params![watch_later as i64, now, id],
    )?;
    Ok(())
}

pub fn delete_video(db: &DbState, id: &str) -> Result<()> {
    let conn = lock_conn(db);
    conn.execute("DELETE FROM videos WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_videos_by_folder(db: &DbState, folder_path: &str) -> Result<usize> {
    let conn = lock_conn(db);
    conn.execute(
        "DELETE FROM videos WHERE folder_path = ?1",
        params![folder_path],
    )
}

pub fn get_continue_watching(db: &DbState, limit: i64) -> Result<Vec<Video>> {
    let conn = lock_conn(db);
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM videos WHERE progress_seconds > 0 AND completed = 0
        ORDER BY last_played_at DESC LIMIT ?1",
        VIDEO_COLUMNS
    ))?;
    let rows = stmt.query_map(params![limit], row_to_video)?;
    rows.collect()
}

pub fn get_recently_added(db: &DbState, limit: i64) -> Result<Vec<Video>> {
    let conn = lock_conn(db);
    let mut stmt = conn.prepare(&format!(
        "SELECT {} FROM videos ORDER BY created_at DESC LIMIT ?1",
        VIDEO_COLUMNS
    ))?;
    let rows = stmt.query_map(params![limit], row_to_video)?;
    rows.collect()
}

pub fn get_video_count(db: &DbState) -> Result<i64> {
    let conn = lock_conn(db);
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM videos", [], |row| row.get(0))?;
    Ok(count)
}

pub fn get_completed_count(db: &DbState) -> Result<i64> {
    let conn = lock_conn(db);
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM videos WHERE completed = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

pub fn get_total_duration(db: &DbState) -> Result<i64> {
    let conn = lock_conn(db);
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM videos",
        [],
        |row| row.get(0),
    )?;
    Ok(total)
}

#[cfg(test)]
mod video_row_tests {
    use super::*;
    use rusqlite::Connection;

    /// Builds the table with the columns deliberately declared in a *different*
    /// order from `VIDEO_COLUMNS`, standing in for a database whose upgrade
    /// history added them in another sequence. Reading back through the named
    /// column list must still produce the right field in every position — which
    /// is precisely what `SELECT *` could not guarantee.
    fn table_with_shuffled_physical_order() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE videos (
                codec_info TEXT,
                last_playback_error TEXT,
                playable_status TEXT,
                id TEXT PRIMARY KEY,
                title TEXT,
                file_path TEXT,
                folder_path TEXT,
                file_name TEXT,
                extension TEXT,
                duration_seconds INTEGER,
                thumbnail_path TEXT,
                thumbnail_status TEXT,
                category TEXT,
                speaker TEXT,
                description TEXT,
                progress_seconds INTEGER,
                completed INTEGER,
                favorite INTEGER,
                watch_later INTEGER,
                file_size INTEGER,
                modified_at INTEGER,
                created_at INTEGER,
                updated_at INTEGER,
                last_played_at INTEGER
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn video_columns_covers_every_field_once() {
        let names: Vec<&str> = VIDEO_COLUMNS.split(',').map(str::trim).collect();
        assert_eq!(names.len(), 24, "column list must match row_to_video's indices");
        let mut sorted = names.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), names.len(), "duplicate column in VIDEO_COLUMNS");
    }

    #[test]
    fn rows_map_to_the_right_fields_whatever_the_physical_column_order() {
        let conn = table_with_shuffled_physical_order();
        conn.execute(
            &format!(
                "INSERT INTO videos ({}) VALUES \
                 (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, \
                  ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)",
                VIDEO_COLUMNS
            ),
            params![
                "vid-1",
                "The Title",
                "C:/a/b.mp4",
                "C:/a",
                "b.mp4",
                "mp4",
                610_i64,
                "C:/thumbs/b.jpg",
                "ready",
                "aqeedah",
                "A Speaker",
                "A description",
                120_i64,
                1_i64,
                1_i64,
                0_i64,
                4096_i64,
                11_i64,
                22_i64,
                33_i64,
                44_i64,
                "playable",
                "no error",
                "{\"width\":1920}",
            ],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(&format!("SELECT {} FROM videos", VIDEO_COLUMNS))
            .unwrap();
        let video = stmt.query_row([], row_to_video).unwrap();

        assert_eq!(video.id, "vid-1");
        assert_eq!(video.title, "The Title");
        assert_eq!(video.file_path, "C:/a/b.mp4");
        assert_eq!(video.folder_path, "C:/a");
        assert_eq!(video.file_name, "b.mp4");
        assert_eq!(video.extension, "mp4");
        assert_eq!(video.duration_seconds, 610);
        assert_eq!(video.thumbnail_path.as_deref(), Some("C:/thumbs/b.jpg"));
        assert_eq!(video.thumbnail_status, "ready");
        assert_eq!(video.category.as_deref(), Some("aqeedah"));
        assert_eq!(video.speaker.as_deref(), Some("A Speaker"));
        assert_eq!(video.description.as_deref(), Some("A description"));
        assert_eq!(video.progress_seconds, 120);
        assert!(video.completed);
        assert!(video.favorite);
        assert!(!video.watch_later);
        assert_eq!(video.file_size, 4096);
        assert_eq!(video.modified_at, 11);
        assert_eq!(video.created_at, 22);
        assert_eq!(video.updated_at, 33);
        assert_eq!(video.last_played_at, Some(44));
        assert_eq!(video.playable_status, "playable");
        assert_eq!(video.last_playback_error.as_deref(), Some("no error"));
        assert_eq!(video.codec_info.as_deref(), Some("{\"width\":1920}"));
    }
}

use crate::db::DbState;
use crate::models::video::Video;
use rusqlite::{params, params_from_iter, Result, Row};

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
    let conn = db.lock().unwrap();
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
    let conn = db.lock().unwrap();
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
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM videos WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_video(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_video_by_path(db: &DbState, file_path: &str) -> Result<Option<Video>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM videos WHERE file_path = ?1")?;
    let mut rows = stmt.query(params![file_path])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_video(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_videos_by_folder(db: &DbState, folder_path: &str) -> Result<Vec<Video>> {
    let conn = db.lock().unwrap();
    let mut stmt =
        conn.prepare("SELECT * FROM videos WHERE folder_path = ?1 ORDER BY file_name")?;
    let rows = stmt.query_map(params![folder_path], row_to_video)?;
    rows.collect()
}

pub fn get_all_videos(db: &DbState) -> Result<Vec<Video>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM videos ORDER BY title")?;
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

    let conn = db.lock().unwrap();
    let placeholders = std::iter::repeat("?")
        .take(unique_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("SELECT * FROM videos WHERE id IN ({}) ORDER BY title", placeholders);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(unique_ids.iter()), row_to_video)?;
    rows.collect()
}

pub fn search_videos(db: &DbState, query: &str) -> Result<Vec<Video>> {
    let conn = db.lock().unwrap();
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT * FROM videos WHERE 
            title LIKE ?1 OR file_name LIKE ?1 OR category LIKE ?1 
            OR speaker LIKE ?1 OR folder_path LIKE ?1
        ORDER BY title",
    )?;
    let rows = stmt.query_map(params![pattern], row_to_video)?;
    rows.collect()
}

pub fn update_video_progress(db: &DbState, id: &str, progress: i64, completed: bool) -> Result<()> {
    let conn = db.lock().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET progress_seconds = ?1, completed = ?2, last_played_at = ?3, updated_at = ?4 WHERE id = ?5",
        params![progress, completed as i64, now, now, id],
    )?;
    Ok(())
}

pub fn update_video_favorite(db: &DbState, id: &str, favorite: bool) -> Result<()> {
    let conn = db.lock().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET favorite = ?1, updated_at = ?2 WHERE id = ?3",
        params![favorite as i64, now, id],
    )?;
    Ok(())
}

pub fn update_video_watch_later(db: &DbState, id: &str, watch_later: bool) -> Result<()> {
    let conn = db.lock().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE videos SET watch_later = ?1, updated_at = ?2 WHERE id = ?3",
        params![watch_later as i64, now, id],
    )?;
    Ok(())
}

pub fn delete_video(db: &DbState, id: &str) -> Result<()> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM videos WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_videos_by_folder(db: &DbState, folder_path: &str) -> Result<usize> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM videos WHERE folder_path = ?1", params![folder_path])
}

pub fn get_continue_watching(db: &DbState, limit: i64) -> Result<Vec<Video>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT * FROM videos WHERE progress_seconds > 0 AND completed = 0 
        ORDER BY last_played_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], row_to_video)?;
    rows.collect()
}

pub fn get_recently_added(db: &DbState, limit: i64) -> Result<Vec<Video>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM videos ORDER BY created_at DESC LIMIT ?1")?;
    let rows = stmt.query_map(params![limit], row_to_video)?;
    rows.collect()
}

pub fn get_video_count(db: &DbState) -> Result<i64> {
    let conn = db.lock().unwrap();
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM videos", [], |row| row.get(0))?;
    Ok(count)
}

pub fn get_completed_count(db: &DbState) -> Result<i64> {
    let conn = db.lock().unwrap();
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM videos WHERE completed = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

pub fn get_total_duration(db: &DbState) -> Result<i64> {
    let conn = db.lock().unwrap();
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM videos",
        [],
        |row| row.get(0),
    )?;
    Ok(total)
}

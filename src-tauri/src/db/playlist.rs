use crate::db::DbState;
use crate::models::playlist::Playlist;
use rusqlite::{params, Result, Row};
use serde_json;

fn row_to_playlist(row: &Row) -> Result<Playlist> {
    let video_ids_json: String = row.get(3)?;
    let video_ids: Vec<String> = serde_json::from_str(&video_ids_json).unwrap_or_default();

    Ok(Playlist {
        id: row.get(0)?,
        name: row.get(1)?,
        folder_path: row.get(2)?,
        video_ids,
        video_count: row.get(4)?,
        total_duration_seconds: row.get(5)?,
        progress_seconds: row.get(6)?,
        thumbnail_path: row.get(7)?,
        category: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn insert_playlist(db: &DbState, playlist: &Playlist) -> Result<()> {
    let conn = db.lock().unwrap();
    let video_ids_json = serde_json::to_string(&playlist.video_ids).unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO playlists (
            id, name, folder_path, video_ids, video_count,
            total_duration_seconds, progress_seconds, thumbnail_path,
            category, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            &playlist.id,
            &playlist.name,
            &playlist.folder_path,
            &video_ids_json,
            playlist.video_count,
            playlist.total_duration_seconds,
            playlist.progress_seconds,
            &playlist.thumbnail_path,
            &playlist.category,
            playlist.created_at,
            playlist.updated_at
        ],
    )?;
    Ok(())
}

pub fn get_playlist_by_id(db: &DbState, id: &str) -> Result<Option<Playlist>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_playlist(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_playlist_by_folder(db: &DbState, folder_path: &str) -> Result<Option<Playlist>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM playlists WHERE folder_path = ?1")?;
    let mut rows = stmt.query(params![folder_path])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_playlist(row)?))
    } else {
        Ok(None)
    }
}

pub fn get_all_playlists(db: &DbState) -> Result<Vec<Playlist>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare("SELECT * FROM playlists ORDER BY name")?;
    let rows = stmt.query_map([], row_to_playlist)?;
    rows.collect()
}

pub fn delete_playlist(db: &DbState, id: &str) -> Result<()> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn update_playlist(db: &DbState, playlist: &Playlist) -> Result<()> {
    let conn = db.lock().unwrap();
    let video_ids_json = serde_json::to_string(&playlist.video_ids).unwrap_or_default();

    conn.execute(
        "UPDATE playlists SET
            name = ?1, folder_path = ?2, video_ids = ?3, video_count = ?4,
            total_duration_seconds = ?5, progress_seconds = ?6,
            thumbnail_path = ?7, category = ?8, updated_at = ?9
        WHERE id = ?10",
        params![
            &playlist.name,
            &playlist.folder_path,
            &video_ids_json,
            playlist.video_count,
            playlist.total_duration_seconds,
            playlist.progress_seconds,
            &playlist.thumbnail_path,
            &playlist.category,
            playlist.updated_at,
            &playlist.id
        ],
    )?;
    Ok(())
}

pub fn refresh_playlist_progress(db: &DbState, playlist: &Playlist) -> Result<Playlist> {
    let mut refreshed = playlist.clone();
    let mut videos = Vec::new();

    for id in &refreshed.video_ids {
        if let Some(video) = crate::db::video::get_video_by_id(db, id)? {
            videos.push(video);
        }
    }

    let video_count = videos.len() as i64;
    let total_duration_seconds = videos.iter().map(|video| video.duration_seconds).sum();
    let progress_seconds = videos
        .iter()
        .map(|video| {
            if video.completed {
                video.duration_seconds
            } else {
                video.progress_seconds.min(video.duration_seconds)
            }
        })
        .sum();
    let thumbnail_path = videos
        .iter()
        .find_map(|video| video.thumbnail_path.clone())
        .or_else(|| refreshed.thumbnail_path.clone());

    let changed = refreshed.video_count != video_count
        || refreshed.total_duration_seconds != total_duration_seconds
        || refreshed.progress_seconds != progress_seconds
        || refreshed.thumbnail_path != thumbnail_path;

    refreshed.video_count = video_count;
    refreshed.total_duration_seconds = total_duration_seconds;
    refreshed.progress_seconds = progress_seconds;
    refreshed.thumbnail_path = thumbnail_path;

    if changed {
        refreshed.updated_at = chrono::Utc::now().timestamp_millis();
        update_playlist(db, &refreshed)?;
    }

    Ok(refreshed)
}

pub fn refresh_progress_for_video(db: &DbState, video_id: &str) -> Result<()> {
    let playlists = get_all_playlists(db)?;

    for playlist in playlists
        .into_iter()
        .filter(|playlist| playlist.video_ids.iter().any(|id| id == video_id))
    {
        refresh_playlist_progress(db, &playlist)?;
    }

    Ok(())
}

pub fn search_playlists(db: &DbState, query: &str) -> Result<Vec<Playlist>> {
    let conn = db.lock().unwrap();
    let pattern = format!("%{}%", query);
    let mut stmt = conn.prepare(
        "SELECT * FROM playlists WHERE name LIKE ?1 OR folder_path LIKE ?1 OR category LIKE ?1 ORDER BY name"
    )?;
    let rows = stmt.query_map(params![pattern], row_to_playlist)?;
    rows.collect()
}

pub fn get_playlist_stats(db: &DbState) -> Result<(i64, i64, i64, i64)> {
    let conn = db.lock().unwrap();
    let playlist_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM playlists", [], |row| row.get(0))?;
    let video_count: i64 = conn.query_row("SELECT COUNT(*) FROM videos", [], |row| row.get(0))?;
    let total_duration: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM videos",
        [],
        |row| row.get(0),
    )?;
    let completed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM videos WHERE completed = 1",
        [],
        |row| row.get(0),
    )?;

    Ok((playlist_count, video_count, total_duration, completed))
}

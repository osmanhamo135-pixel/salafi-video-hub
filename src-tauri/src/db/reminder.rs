use crate::db::DbState;
use crate::models::reminder::Reminder;
use rusqlite::{params, Result, Row};
use serde_json;

fn row_to_reminder(row: &Row) -> Result<Reminder> {
    let custom_days_json: Option<String> = row.get(7)?;
    let custom_days = custom_days_json.and_then(|s| serde_json::from_str(&s).ok());

    Ok(Reminder {
        id: row.get(0)?,
        title: row.get(1)?,
        enabled: row.get::<_, i64>(2)? != 0,
        target_type: row.get(3)?,
        target_id: row.get(4)?,
        time: row.get(5)?,
        repeat: row.get(6)?,
        custom_days,
        sound_path: row.get(8)?,
        volume: {
            let volume: f64 = row.get(9)?;
            if volume <= 1.0 {
                volume * 100.0
            } else {
                volume
            }
        },
        last_triggered_at: row.get(10)?,
        last_fired_key: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn insert_reminder(db: &DbState, reminder: &Reminder) -> Result<()> {
    let conn = db.lock().unwrap();
    let custom_days_json = reminder
        .custom_days
        .as_ref()
        .map(|d| serde_json::to_string(d).unwrap_or_default());

    conn.execute(
        "INSERT OR REPLACE INTO reminders (
            id, title, enabled, target_type, target_id, time,
            repeat, custom_days, sound_path, volume, last_triggered_at,
            last_fired_key, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        params![
            &reminder.id,
            &reminder.title,
            reminder.enabled as i64,
            &reminder.target_type,
            &reminder.target_id,
            &reminder.time,
            &reminder.repeat,
            &custom_days_json,
            &reminder.sound_path,
            reminder.volume,
            reminder.last_triggered_at,
            &reminder.last_fired_key,
            reminder.created_at,
            reminder.updated_at
        ],
    )?;
    Ok(())
}

pub fn get_all_reminders(db: &DbState) -> Result<Vec<Reminder>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, enabled, target_type, target_id, time, repeat,
            custom_days, sound_path, volume, last_triggered_at, last_fired_key,
            created_at, updated_at
        FROM reminders
        ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], row_to_reminder)?;
    rows.collect()
}

pub fn get_reminder_by_id(db: &DbState, id: &str) -> Result<Option<Reminder>> {
    let conn = db.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, title, enabled, target_type, target_id, time, repeat,
            custom_days, sound_path, volume, last_triggered_at, last_fired_key,
            created_at, updated_at
        FROM reminders
        WHERE id = ?1",
    )?;
    let mut rows = stmt.query(params![id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(row_to_reminder(row)?))
    } else {
        Ok(None)
    }
}

pub fn update_reminder(db: &DbState, reminder: &Reminder) -> Result<()> {
    let conn = db.lock().unwrap();
    let custom_days_json = reminder
        .custom_days
        .as_ref()
        .map(|d| serde_json::to_string(d).unwrap_or_default());

    conn.execute(
        "UPDATE reminders SET
            title = ?1, enabled = ?2, target_type = ?3, target_id = ?4,
            time = ?5, repeat = ?6, custom_days = ?7, sound_path = ?8,
            volume = ?9, last_triggered_at = ?10, last_fired_key = ?11,
            updated_at = ?12
        WHERE id = ?13",
        params![
            &reminder.title,
            reminder.enabled as i64,
            &reminder.target_type,
            &reminder.target_id,
            &reminder.time,
            &reminder.repeat,
            &custom_days_json,
            &reminder.sound_path,
            reminder.volume,
            reminder.last_triggered_at,
            &reminder.last_fired_key,
            reminder.updated_at,
            &reminder.id
        ],
    )?;
    Ok(())
}

pub fn mark_reminder_triggered(
    db: &DbState,
    id: &str,
    fired_key: &str,
    triggered_at: i64,
    disable_if_one_time: bool,
) -> Result<()> {
    let conn = db.lock().unwrap();
    conn.execute(
        "UPDATE reminders SET
            last_triggered_at = ?1,
            last_fired_key = ?2,
            enabled = CASE WHEN ?3 THEN 0 ELSE enabled END,
            updated_at = ?1
        WHERE id = ?4",
        params![triggered_at, fired_key, disable_if_one_time, id],
    )?;
    Ok(())
}

pub fn delete_reminder(db: &DbState, id: &str) -> Result<()> {
    let conn = db.lock().unwrap();
    conn.execute("DELETE FROM reminders WHERE id = ?1", params![id])?;
    Ok(())
}

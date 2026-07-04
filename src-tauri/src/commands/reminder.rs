use crate::db::DbState;
use crate::models::reminder::Reminder;
use std::path::Path;
use tauri::Manager;
use tauri::State;

#[tauri::command]
pub fn create_reminder(db: State<'_, DbState>, reminder: Reminder) -> Result<Reminder, String> {
    let mut reminder = reminder;
    let now = chrono::Utc::now().timestamp_millis();
    if reminder.id.is_empty() {
        reminder.id = uuid::Uuid::new_v4().to_string();
    }
    if reminder.created_at == 0 {
        reminder.created_at = now;
    }
    reminder.updated_at = now;

    crate::db::reminder::insert_reminder(&db, &reminder).map_err(|e| e.to_string())?;
    Ok(reminder)
}

#[tauri::command]
pub async fn get_all_reminders(db: State<'_, DbState>) -> Result<Vec<Reminder>, String> {
    let db = db.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        crate::db::reminder::get_all_reminders(&db).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn update_reminder(
    db: State<'_, DbState>,
    id: String,
    reminder: Reminder,
) -> Result<Reminder, String> {
    let mut reminder = reminder;
    reminder.id = id;
    reminder.updated_at = chrono::Utc::now().timestamp_millis();
    crate::db::reminder::update_reminder(&db, &reminder).map_err(|e| e.to_string())?;
    Ok(reminder)
}

#[tauri::command]
pub fn delete_reminder(db: State<'_, DbState>, id: String) -> Result<(), String> {
    crate::db::reminder::delete_reminder(&db, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_reminder(
    db: State<'_, DbState>,
    id: String,
    enabled: Option<bool>,
) -> Result<Reminder, String> {
    let mut reminder = crate::db::reminder::get_reminder_by_id(&db, &id)
        .map_err(|e| e.to_string())?
        .ok_or("Reminder not found")?;
    reminder.enabled = enabled.unwrap_or(!reminder.enabled);
    reminder.updated_at = chrono::Utc::now().timestamp_millis();
    crate::db::reminder::update_reminder(&db, &reminder).map_err(|e| e.to_string())?;
    Ok(reminder)
}

#[tauri::command]
pub fn mark_reminder_triggered(
    db: State<'_, DbState>,
    id: String,
    fired_key: String,
    triggered_at: i64,
    disable_if_one_time: bool,
) -> Result<(), String> {
    crate::db::reminder::mark_reminder_triggered(
        &db,
        &id,
        &fired_key,
        triggered_at,
        disable_if_one_time,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn allow_reminder_sound_path(
    app_handle: tauri::AppHandle,
    file_path: String,
) -> Result<(), String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("Sound file does not exist: {}", file_path));
    }

    app_handle
        .asset_protocol_scope()
        .allow_file(path)
        .map_err(|e| format!("Failed to allow reminder sound access: {}", e))
}

#[tauri::command]
pub fn test_reminder_sound(
    sound_path: Option<String>,
    _volume: Option<f64>,
) -> Result<(), String> {
    let path = sound_path.ok_or_else(|| "No reminder sound selected".to_string())?;
    if path.trim().is_empty() {
        return Err("No reminder sound selected".to_string());
    }
    if !Path::new(&path).exists() {
        return Err(format!("Sound file does not exist: {}", path));
    }

    crate::commands::file_ops::open_file_externally(path)
}

use crate::db::DbState;
use chrono::Local;
use tauri::AppHandle;

pub fn start_reminder_checker(_app_handle: AppHandle, _db: DbState) {
    // Reminder alarms are handled by the frontend runtime while the app window is open.
}

pub fn check_due_reminders(db: &DbState) -> Vec<crate::models::reminder::Reminder> {
    let now = Local::now().format("%H:%M").to_string();
    crate::db::reminder::get_all_reminders(db)
        .unwrap_or_default()
        .into_iter()
        .filter(|reminder| reminder.enabled && reminder.time == now)
        .collect()
}

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Reminder {
    pub id: String,
    pub title: String,
    pub enabled: bool,
    pub target_type: String,
    pub target_id: String,
    pub time: String,
    pub repeat: String,
    pub custom_days: Option<Vec<i64>>,
    pub sound_path: Option<String>,
    pub volume: f64,
    pub last_triggered_at: Option<i64>,
    pub last_fired_key: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for Reminder {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            enabled: true,
            target_type: String::new(),
            target_id: String::new(),
            time: String::new(),
            repeat: "none".to_string(),
            custom_days: None,
            sound_path: None,
            volume: 80.0,
            last_triggered_at: None,
            last_fired_key: None,
            created_at: 0,
            updated_at: 0,
        }
    }
}

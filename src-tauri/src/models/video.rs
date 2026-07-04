use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub folder_path: String,
    pub file_name: String,
    pub extension: String,
    pub duration_seconds: i64,
    pub thumbnail_path: Option<String>,
    pub thumbnail_status: String,
    pub category: Option<String>,
    pub speaker: Option<String>,
    pub description: Option<String>,
    pub progress_seconds: i64,
    pub completed: bool,
    pub favorite: bool,
    pub watch_later: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_played_at: Option<i64>,
    pub playable_status: String,
    pub last_playback_error: Option<String>,
    pub codec_info: Option<String>,
}

impl Default for Video {
    fn default() -> Self {
        Self {
            id: String::new(),
            title: String::new(),
            file_path: String::new(),
            folder_path: String::new(),
            file_name: String::new(),
            extension: String::new(),
            duration_seconds: 0,
            thumbnail_path: None,
            thumbnail_status: "missing".to_string(),
            category: None,
            speaker: None,
            description: None,
            progress_seconds: 0,
            completed: false,
            favorite: false,
            watch_later: false,
            file_size: 0,
            modified_at: 0,
            created_at: 0,
            updated_at: 0,
            last_played_at: None,
            playable_status: "unknown".to_string(),
            last_playback_error: None,
            codec_info: None,
        }
    }
}

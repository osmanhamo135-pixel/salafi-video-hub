use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
// Container-level default: a backup written by an older build simply lacks
// the fields added since, and rejecting the whole file over them threw away
// the user's entire restorable library. Missing fields take the struct's
// Default; import_backup refuses rows that defaulted away their identity.
#[serde(default)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub folder_path: String,
    pub video_ids: Vec<String>,
    pub video_count: i64,
    pub total_duration_seconds: i64,
    pub progress_seconds: i64,
    pub thumbnail_path: Option<String>,
    pub category: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Default for Playlist {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            folder_path: String::new(),
            video_ids: Vec::new(),
            video_count: 0,
            total_duration_seconds: 0,
            progress_seconds: 0,
            thumbnail_path: None,
            category: None,
            created_at: 0,
            updated_at: 0,
        }
    }
}

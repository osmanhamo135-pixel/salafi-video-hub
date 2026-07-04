use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub id: String,
    pub language: String,
    pub theme: String,
    pub imported_folders: Vec<String>,
    pub thumbnail_cache_path: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ffmpeg_status: String,
    pub automatic_thumbnails_mode: String,
    pub performance_mode: bool,
    pub reminder_sound_path: Option<String>,
    pub reminder_volume: f64,
    pub run_in_tray: bool,
    pub last_opened_playlist_id: Option<String>,
    pub last_played_video_id: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            id: "default".to_string(),
            language: "en".to_string(),
            theme: "noor".to_string(),
            imported_folders: Vec::new(),
            thumbnail_cache_path: None,
            ffmpeg_path: None,
            ffprobe_path: None,
            ffmpeg_status: "missing".to_string(),
            automatic_thumbnails_mode: "automatic".to_string(),
            performance_mode: true,
            reminder_sound_path: None,
            reminder_volume: 80.0,
            run_in_tray: false,
            last_opened_playlist_id: None,
            last_played_video_id: None,
        }
    }
}

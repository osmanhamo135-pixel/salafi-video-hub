use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::commands::radio::fetch_url;
use crate::utils::paths::get_app_data_dir;

/// The full bundled Quran (Tanzil Uthmani text + Saheeh International
/// translation), parsed once and kept in memory for instant access.
static QURAN: OnceLock<Vec<Surah>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Surah {
    pub id: i64,
    /// Arabic surah name (e.g. الفاتحة).
    pub name: String,
    pub transliteration: String,
    /// English meaning of the surah name (e.g. "The Opener").
    pub translation: String,
    /// "meccan" or "medinan".
    #[serde(rename = "type")]
    pub revelation_type: String,
    pub total_verses: i64,
    pub verses: Vec<Verse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verse {
    pub id: i64,
    /// Verbatim Uthmani Arabic text — never modified (Tanzil terms).
    pub text: String,
    pub translation: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SurahMeta {
    pub id: i64,
    pub name: String,
    pub transliteration: String,
    pub translation: String,
    pub revelation_type: String,
    pub total_verses: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuranReciter {
    pub id: String,
    pub name: String,
    /// Riwayah/moshaf name, e.g. "Hafs A'n Assem - Murattal".
    pub moshaf_name: String,
    /// Base URL; surah audio is `{server}{surah:03}.mp3`.
    pub server: String,
    /// Surah numbers this recitation actually provides.
    pub available_surahs: Vec<i64>,
}

#[tauri::command]
pub fn get_quran_surahs(app_handle: AppHandle) -> Result<Vec<SurahMeta>, String> {
    let quran = load_quran(&app_handle)?;
    Ok(quran
        .iter()
        .map(|surah| SurahMeta {
            id: surah.id,
            name: surah.name.clone(),
            transliteration: surah.transliteration.clone(),
            translation: surah.translation.clone(),
            revelation_type: surah.revelation_type.clone(),
            total_verses: surah.total_verses,
        })
        .collect())
}

#[tauri::command]
pub fn get_quran_surah(app_handle: AppHandle, surah_id: i64) -> Result<Surah, String> {
    let quran = load_quran(&app_handle)?;
    quran
        .iter()
        .find(|surah| surah.id == surah_id)
        .cloned()
        .ok_or_else(|| format!("Surah {} was not found.", surah_id))
}

fn load_quran(app_handle: &AppHandle) -> Result<&'static Vec<Surah>, String> {
    if let Some(quran) = QURAN.get() {
        return Ok(quran);
    }

    let path = locate_quran_file(app_handle)
        .ok_or_else(|| "The bundled Quran text file could not be found.".to_string())?;
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read the Quran text: {}", error))?;
    let parsed: Vec<Surah> = serde_json::from_str(&raw)
        .map_err(|error| format!("Could not parse the Quran text: {}", error))?;

    if parsed.len() != 114 {
        return Err("The bundled Quran text is incomplete.".to_string());
    }

    Ok(QURAN.get_or_init(|| parsed))
}

fn locate_quran_file(app_handle: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join("quran.json"));
        candidates.push(resource_dir.join("resources").join("quran.json"));
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("quran.json"));
            candidates.push(exe_dir.join("resources").join("quran.json"));
        }
    }
    // Dev builds run from src-tauri, where the file lives in ./resources.
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("quran.json"));

    candidates.into_iter().find(|path| path.is_file())
}

/// Fetches the reciter catalog (name + audio server per riwayah) with the same
/// remote-then-cache strategy as the radio catalog.
#[tauri::command]
pub async fn get_quran_reciters(
    app_handle: AppHandle,
    language: String,
) -> Result<Vec<QuranReciter>, String> {
    tauri::async_runtime::spawn_blocking(move || get_reciters_blocking(&app_handle, &language))
        .await
        .map_err(|error| error.to_string())?
}

fn get_reciters_blocking(app_handle: &AppHandle, language: &str) -> Result<Vec<QuranReciter>, String> {
    let language = if language.trim().eq_ignore_ascii_case("ar") { "ar" } else { "eng" };
    let cache_path = reciters_cache_path(app_handle, language)?;

    let fetched = fetch_url(&format!(
        "https://mp3quran.net/api/v3/reciters?language={}",
        language
    ))
    .ok()
    .and_then(|body| parse_reciters(&body).ok())
    .filter(|reciters| !reciters.is_empty());

    match fetched {
        Some(reciters) => {
            if let Ok(json) = serde_json::to_string(&reciters) {
                let _ = fs::write(&cache_path, json);
            }
            Ok(reciters)
        }
        None => {
            let cached = fs::read_to_string(&cache_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<Vec<QuranReciter>>(&raw).ok())
                .filter(|reciters| !reciters.is_empty());
            cached.ok_or_else(|| {
                "Could not load the reciters. Check your internet connection and try again."
                    .to_string()
            })
        }
    }
}

fn reciters_cache_path(app_handle: &AppHandle, language: &str) -> Result<PathBuf, String> {
    let dir = get_app_data_dir(app_handle)?.join("cache");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("quran-reciters-{}.json", language)))
}

fn parse_reciters(body: &str) -> Result<Vec<QuranReciter>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid reciter response: {}", error))?;

    let entries = json
        .get("reciters")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Reciter response had no list.".to_string())?;

    let mut reciters = Vec::new();
    for entry in entries {
        let Some(name) = entry.get("name").and_then(|value| value.as_str()) else { continue };
        let reciter_id = entry
            .get("id")
            .map(|value| value.to_string().trim_matches('"').to_string())
            .unwrap_or_default();
        let Some(moshafs) = entry.get("moshaf").and_then(|value| value.as_array()) else { continue };

        for moshaf in moshafs {
            let Some(server) = moshaf.get("server").and_then(|value| value.as_str()) else { continue };
            if !(server.starts_with("http://") || server.starts_with("https://")) {
                continue;
            }
            let moshaf_name = moshaf
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string();
            let moshaf_id = moshaf
                .get("id")
                .map(|value| value.to_string().trim_matches('"').to_string())
                .unwrap_or_default();
            let available_surahs = moshaf
                .get("surah_list")
                .and_then(|value| value.as_str())
                .map(|list| {
                    list.split(',')
                        .filter_map(|part| part.trim().parse::<i64>().ok())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            reciters.push(QuranReciter {
                id: format!("{}-{}", reciter_id, moshaf_id),
                name: name.trim().to_string(),
                moshaf_name,
                server: server.trim().to_string(),
                available_surahs,
            });
        }
    }

    Ok(reciters)
}

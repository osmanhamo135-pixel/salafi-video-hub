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
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("quran.json"),
    );

    candidates.into_iter().find(|path| path.is_file())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimingRead {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name_ar: Option<String>,
    #[serde(default)]
    pub timing_level: String,
    /// Audio base URL for this read; surah audio is `{folder_url}{surah:03}.mp3`.
    pub folder_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AyahTiming {
    pub ayah: i64,
    pub start_ms: i64,
    pub end_ms: i64,
}

/// Lists the recitations that provide trusted ayah-timing data, so highlighting
/// always pairs a reciter's own timing with that reciter's own recording.
#[tauri::command]
pub async fn get_quran_timing_reads(app_handle: AppHandle) -> Result<Vec<TimingRead>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let cache_path = get_app_data_dir(&app_handle)?
            .join("cache")
            .join("quran-timing-reads.json");
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let fetched = fetch_url("https://mp3quran.net/api/v3/ayat_timing/reads")
            .ok()
            .and_then(|body| parse_timing_reads(&body).ok())
            .filter(|reads| !reads.is_empty());

        match fetched {
            Some(reads) => {
                if let Ok(json) = serde_json::to_string(&reads) {
                    let _ = fs::write(&cache_path, json);
                }
                Ok(reads)
            }
            None => fs::read_to_string(&cache_path)
                .ok()
                .and_then(|raw| serde_json::from_str::<Vec<TimingRead>>(&raw).ok())
                .filter(|reads| !reads.is_empty())
                .ok_or_else(|| {
                    "Could not load synced reciters. Check your internet connection.".to_string()
                }),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

fn parse_timing_reads(body: &str) -> Result<Vec<TimingRead>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|error| format!("Invalid reads response: {}", error))?;

    let entries = json
        .as_array()
        .or_else(|| json.get("reads").and_then(|value| value.as_array()))
        .ok_or_else(|| "Reads response had no list.".to_string())?;

    Ok(entries
        .iter()
        .filter_map(|entry| {
            let name = entry.get("name")?.as_str()?.trim().to_string();
            let folder_url = entry
                .get("folder_url")
                .or_else(|| entry.get("server"))?
                .as_str()?
                .trim()
                .to_string();
            if name.is_empty()
                || !(folder_url.starts_with("http://") || folder_url.starts_with("https://"))
            {
                return None;
            }
            let id = entry
                .get("id")
                .map(|value| value.to_string().trim_matches('"').to_string())
                .filter(|value| !value.is_empty())?;
            // A read in another riwayah is distinct content: keep the riwayah
            // in the display name so two reads by one reciter stay tellable
            // apart (Hafs is the default and is left unsuffixed).
            let rewaya = entry
                .get("rewaya")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .unwrap_or("");
            let name = if rewaya.is_empty() || rewaya.contains("حفص") {
                name
            } else {
                format!("{} - {}", name, rewaya)
            };
            Some(TimingRead {
                id,
                name,
                name_ar: None,
                timing_level: "ayah".to_string(),
                folder_url,
            })
        })
        .collect())
}

/// Normalizes an audio folder/server URL for exact matching between the
/// timing catalog and the reciter catalog.
fn normalize_server_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_ascii_lowercase()
}

/// Fetches per-ayah timing (milliseconds) for one surah of one timing-capable
/// read. Cached permanently on disk — timing data for a published recording
/// does not change, so replays work offline and instantly.
#[tauri::command]
pub async fn get_quran_ayah_timings(
    app_handle: AppHandle,
    read_id: String,
    surah_id: i64,
) -> Result<Vec<AyahTiming>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = get_app_data_dir(&app_handle)?
            .join("cache")
            .join("quran-timings");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let safe_read: String = read_id
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .collect();
        let cache_path = dir.join(format!("{}-{}.json", safe_read, surah_id));

        if let Ok(raw) = fs::read_to_string(&cache_path) {
            if let Ok(cached) = serde_json::from_str::<Vec<AyahTiming>>(&raw) {
                if !cached.is_empty() {
                    return Ok(cached);
                }
            }
        }

        let body = fetch_url(&format!(
            "https://mp3quran.net/api/v3/ayat_timing?surah={}&read={}",
            surah_id, read_id
        ))?;
        let timings = parse_ayah_timings(&body)?;
        if timings.is_empty() {
            return Err("No timing data is available for this surah and reciter.".to_string());
        }

        if let Ok(json) = serde_json::to_string(&timings) {
            let _ = fs::write(&cache_path, json);
        }
        Ok(timings)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn parse_ayah_timings(body: &str) -> Result<Vec<AyahTiming>, String> {
    let json: serde_json::Value = serde_json::from_str(body)
        .map_err(|error| format!("Invalid timing response: {}", error))?;

    let entries = json
        .as_array()
        .or_else(|| json.get("timings").and_then(|value| value.as_array()))
        .ok_or_else(|| "Timing response had no list.".to_string())?;

    let as_ms = |value: Option<&serde_json::Value>| -> Option<i64> {
        let value = value?;
        value
            .as_i64()
            .or_else(|| value.as_f64().map(|f| f as i64))
            .or_else(|| value.as_str().and_then(|s| s.trim().parse::<i64>().ok()))
    };

    let mut timings = entries
        .iter()
        .filter_map(|entry| {
            let ayah = as_ms(entry.get("ayah"))?;
            let start_ms = as_ms(entry.get("start_time"))?;
            let end_ms = as_ms(entry.get("end_time"))?;
            if ayah < 0 || end_ms < start_ms {
                return None;
            }
            Some(AyahTiming {
                ayah,
                start_ms,
                end_ms,
            })
        })
        .collect::<Vec<_>>();

    timings.sort_by_key(|timing| timing.start_ms);
    Ok(timings)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTiming {
    pub ayah: i64,
    /// One-based word index inside the ayah.
    pub word_index: i64,
    pub start_ms: i64,
    pub end_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedAyahWords {
    pub ayah: i64,
    pub words: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedSurahAudio {
    pub audio_url: String,
    pub ayah_timings: Vec<AyahTiming>,
    pub word_timings: Vec<WordTiming>,
    pub words_by_ayah: Vec<SyncedAyahWords>,
}

/// One unified reciter catalog for the reading tracker. Quran Foundation
/// recordings expose exact word segments; every MP3Quran recitation that
/// publishes verified ayah timing is added at ayah level. Each entry always
/// pairs a reciter's own timing with that reciter's own recording, and
/// duplicate recordings of the same reciter and style are removed.
#[tauri::command]
pub async fn get_quran_word_timing_reads(app_handle: AppHandle) -> Result<Vec<TimingRead>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(combined_timing_reads(&app_handle)))
        .await
        .map_err(|error| error.to_string())?
}

fn combined_timing_reads(app_handle: &AppHandle) -> Vec<TimingRead> {
    let mut reads = word_timing_reads();
    let mut seen_mp3_137 = false;

    for read in mp3quran_ayah_reads(app_handle).unwrap_or_default() {
        // Dedup runs on the Arabic catalog name — the surnames are Arabic.
        if duplicates_word_read(read.name_ar.as_deref().unwrap_or(&read.name)) {
            continue;
        }
        if read.id == "mp3-137" {
            seen_mp3_137 = true;
        }
        reads.push(read);
    }

    // Offline-safe fallback: Ahmad Talib bin Humaid stays available even when
    // the MP3Quran catalog cannot be fetched and nothing is cached yet.
    if !seen_mp3_137 {
        reads.push(TimingRead {
            id: "mp3-137".to_string(),
            name: "أحمد طالب بن حميد".to_string(),
            name_ar: Some("أحمد طالب بن حميد".to_string()),
            timing_level: "ayah".to_string(),
            folder_url: "https://server16.mp3quran.net/a_binhameed/Rewayat-Hafs-A-n-Assem/"
                .to_string(),
        });
    }
    reads
}

/// MP3Quran recitations with verified per-ayah timing, cached with a stale
/// fallback so the catalog keeps working offline after the first fetch.
/// English display names are joined from the English reciter catalog by the
/// read's own audio folder URL — an exact match, never a name guess.
fn mp3quran_ayah_reads(app_handle: &AppHandle) -> Result<Vec<TimingRead>, String> {
    let cache_path = get_app_data_dir(app_handle)?
        .join("cache")
        .join("quran-ayah-reads-v3.json");
    if let Some(parent) = cache_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let fetched = fetch_url("https://mp3quran.net/api/v3/ayat_timing/reads")
        .ok()
        .and_then(|body| parse_timing_reads(&body).ok())
        .filter(|reads| !reads.is_empty())
        .map(|reads| {
            let english_by_server = english_reciters_by_server(app_handle);
            reads
                .into_iter()
                .map(|read| {
                    let english_name = english_by_server
                        .get(&normalize_server_url(&read.folder_url))
                        .cloned();
                    TimingRead {
                        id: format!("mp3-{}", read.id),
                        name: english_name.unwrap_or_else(|| read.name.clone()),
                        name_ar: Some(read.name.clone()),
                        timing_level: "ayah".to_string(),
                        folder_url: read.folder_url,
                    }
                })
                .collect::<Vec<_>>()
        });

    match fetched {
        Some(mut reads) => {
            reads.sort_by(|a, b| a.name.cmp(&b.name));
            if let Ok(json) = serde_json::to_string(&reads) {
                let _ = fs::write(&cache_path, json);
            }
            Ok(reads)
        }
        None => fs::read_to_string(&cache_path)
            .ok()
            .and_then(|raw| serde_json::from_str::<Vec<TimingRead>>(&raw).ok())
            .ok_or_else(|| "The MP3Quran timing catalog is not available yet.".to_string()),
    }
}

/// English reciter names keyed by their moshaf's audio server URL. Falls back
/// to an empty map when the English catalog is unavailable (Arabic names are
/// shown instead until the next successful refresh).
fn english_reciters_by_server(app_handle: &AppHandle) -> std::collections::HashMap<String, String> {
    let mut by_server = std::collections::HashMap::new();
    if let Ok(reciters) = get_reciters_blocking(app_handle, "eng") {
        for reciter in reciters {
            let key = normalize_server_url(&reciter.server);
            // A non-Hafs moshaf carries its riwayah in the moshaf name; keep
            // it so distinct riwayat stay distinguishable in English too.
            let label = if reciter.moshaf_name.to_lowercase().contains("hafs")
                || reciter.moshaf_name.is_empty()
            {
                reciter.name
            } else {
                format!("{} - {}", reciter.name, reciter.moshaf_name)
            };
            by_server.entry(key).or_insert(label);
        }
    }
    by_server
}

/// Arabic surnames of reciters whose default Hafs recordings are already
/// covered word-exactly, so their MP3Quran ayah-level duplicates are skipped.
const WORD_COVERED_SURNAMES: [&str; 12] = [
    "عبد الباسط",
    "عبدالباسط",
    "السديس",
    "الشاطري",
    "الرفاعي",
    "الحصري",
    "العفاسي",
    "المنشاوي",
    "الشريم",
    "الدوسري",
    "الطنيجي",
    "الجليل",
];

/// Riwayah markers: recitations in another riwayah are distinct content and
/// are always kept, even for word-covered reciters.
const OTHER_RIWAYAH_MARKERS: [&str; 9] = [
    "ورش", "قالون", "شعبة", "الدوري", "خلف", "البزي", "قنبل", "السوسي", "يعقوب",
];

fn duplicates_word_read(name: &str) -> bool {
    if OTHER_RIWAYAH_MARKERS.iter().any(|marker| name.contains(marker)) {
        return false;
    }
    WORD_COVERED_SURNAMES
        .iter()
        .any(|surname| name.contains(surname))
}

/// Quran Foundation recordings with exact word segments — one entry per
/// reciter and style (true duplicate recordings are not listed).
fn word_timing_reads() -> Vec<TimingRead> {
    [
        (
            "1",
            "AbdulBaset AbdulSamad - Mujawwad",
            "عبد الباسط عبد الصمد - مجوّد",
        ),
        (
            "2",
            "AbdulBaset AbdulSamad - Murattal",
            "عبد الباسط عبد الصمد - مرتّل",
        ),
        (
            "3",
            "Abdur-Rahman as-Sudais - Murattal",
            "عبد الرحمن السديس - مرتّل",
        ),
        (
            "4",
            "Abu Bakr al-Shatri - Murattal",
            "أبو بكر الشاطري - مرتّل",
        ),
        ("5", "Hani ar-Rifai - Murattal", "هاني الرفاعي - مرتّل"),
        (
            "6",
            "Mahmoud Khalil Al-Husary - Murattal",
            "محمود خليل الحصري - مرتّل",
        ),
        (
            "7",
            "Mishari Rashid al-Afasy - Murattal",
            "مشاري راشد العفاسي - مرتّل",
        ),
        (
            "8",
            "Mohamed Siddiq al-Minshawi - Mujawwad",
            "محمد صديق المنشاوي - مجوّد",
        ),
        (
            "9",
            "Mohamed Siddiq al-Minshawi - Murattal",
            "محمد صديق المنشاوي - مرتّل",
        ),
        ("10", "Saud ash-Shuraym - Murattal", "سعود الشريم - مرتّل"),
        (
            "12",
            "Mahmoud Khalil Al-Husary - Muallim",
            "محمود خليل الحصري - معلّم",
        ),
        (
            "161",
            "Khalifah al-Tunaiji - Murattal",
            "خليفة الطنيجي - مرتّل",
        ),
        (
            "168",
            "Mohamed Siddiq al-Minshawi - Kids Repeat",
            "محمد صديق المنشاوي - ترديد الأطفال",
        ),
        ("170", "Khalid al-Jalil - Murattal", "خالد الجليل - مرتّل"),
        ("172", "Hadi Toure - Murattal", "هادي توري - مرتّل"),
        ("174", "Yasser ad-Dussary - Murattal", "ياسر الدوسري - مرتّل"),
    ]
    .into_iter()
    .map(|(id, name, name_ar)| TimingRead {
        id: id.to_string(),
        name: name.to_string(),
        name_ar: Some(name_ar.to_string()),
        timing_level: "word".to_string(),
        folder_url: String::new(),
    })
    .collect::<Vec<_>>()
}

fn is_supported_word_timing_read(read_id: &str) -> bool {
    matches!(
        read_id,
        "1" | "2"
            | "3"
            | "4"
            | "5"
            | "6"
            | "7"
            | "8"
            | "9"
            | "10"
            | "12"
            | "97"
            | "161"
            | "168"
            | "170"
            | "172"
            | "173"
            | "174"
    )
}

/// Returns synchronized chapter audio. Exact recordings include word segments;
/// retained legacy recordings include verified ayah boundaries only.
#[tauri::command]
pub async fn get_quran_synced_audio(
    app_handle: AppHandle,
    read_id: String,
    surah_id: i64,
) -> Result<SyncedSurahAudio, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let read_id = read_id.trim().to_string();
        let ayah_source = match read_id.strip_prefix("mp3-") {
            Some(source_id) => Some((
                source_id.to_string(),
                lookup_mp3quran_folder(&app_handle, source_id)?,
            )),
            None => None,
        };
        if ayah_source.is_none() && !is_supported_word_timing_read(&read_id) {
            return Err("This reciter does not provide verified timing.".to_string());
        }
        if !(1..=114).contains(&surah_id) {
            return Err("Surah number must be between 1 and 114.".to_string());
        }

        let dir = get_app_data_dir(&app_handle)?
            .join("cache")
            .join("quran-word-timings-v1");
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
        let cache_path = dir.join(format!("{}-{}.json", read_id, surah_id));

        if let Ok(raw) = fs::read_to_string(&cache_path) {
            if let Ok(cached) = serde_json::from_str::<SyncedSurahAudio>(&raw) {
                if cached.audio_url.starts_with("https://")
                    && !cached.ayah_timings.is_empty()
                    && (ayah_source.is_some()
                        || (!cached.word_timings.is_empty() && !cached.words_by_ayah.is_empty()))
                {
                    return Ok(cached);
                }
            }
        }

        if let Some((source_id, folder_url)) = ayah_source {
            let body = fetch_url(&format!(
                "https://mp3quran.net/api/v3/ayat_timing?surah={}&read={}",
                surah_id, source_id
            ))?;
            let ayah_timings = parse_ayah_timings(&body)?;
            if ayah_timings.is_empty() {
                return Err("This reciter has no recording for the selected surah.".to_string());
            }
            let folder_url = if folder_url.ends_with('/') {
                folder_url
            } else {
                format!("{}/", folder_url)
            };
            let synced = SyncedSurahAudio {
                audio_url: format!("{}{:03}.mp3", folder_url, surah_id),
                ayah_timings,
                word_timings: Vec::new(),
                words_by_ayah: Vec::new(),
            };
            if let Ok(json) = serde_json::to_string(&synced) {
                let _ = fs::write(&cache_path, json);
            }
            return Ok(synced);
        }

        let url = format!(
            "https://api.quran.com/api/v4/chapter_recitations/{}/{}?segments=true",
            read_id, surah_id
        );
        let body = fetch_quran_foundation(&url)?;
        let words_url = format!(
            "https://api.quran.com/api/v4/verses/by_chapter/{}?words=true&word_fields=text_uthmani&per_page=300",
            surah_id
        );
        let words_body = fetch_quran_foundation(&words_url)?;
        let mut synced = parse_synced_surah_audio(&body, surah_id)?;
        synced.words_by_ayah = parse_synced_ayah_words(&words_body, surah_id)?;
        if synced.words_by_ayah.is_empty() {
            return Err("Quran Foundation returned no Uthmani word text for this surah.".to_string());
        }

        if let Ok(json) = serde_json::to_string(&synced) {
            let _ = fs::write(&cache_path, json);
        }
        Ok(synced)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Resolves an MP3Quran read's own audio folder so its verified timing is
/// always paired with the same recording it was measured against.
fn lookup_mp3quran_folder(app_handle: &AppHandle, source_id: &str) -> Result<String, String> {
    let target = format!("mp3-{}", source_id);
    if let Ok(reads) = mp3quran_ayah_reads(app_handle) {
        if let Some(read) = reads.iter().find(|read| read.id == target) {
            if !read.folder_url.is_empty() {
                return Ok(read.folder_url.clone());
            }
        }
    }
    if source_id == "137" {
        return Ok("https://server16.mp3quran.net/a_binhameed/Rewayat-Hafs-A-n-Assem/".to_string());
    }
    Err("This reciter's audio folder could not be resolved. Check your internet connection.".to_string())
}

fn fetch_quran_foundation(url: &str) -> Result<String, String> {
    let mut last_error = String::new();
    for attempt in 0..3 {
        match fetch_url(url) {
            Ok(value) => return Ok(value),
            Err(error) => {
                last_error = error;
                if attempt < 2 {
                    std::thread::sleep(std::time::Duration::from_millis(250));
                }
            }
        }
    }
    Err(format!(
        "Could not load Quran Foundation data: {}",
        last_error
    ))
}

fn json_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    let value = value?;
    value
        .as_i64()
        .or_else(|| value.as_f64().map(|number| number as i64))
        .or_else(|| {
            value
                .as_str()
                .and_then(|text| text.trim().parse::<i64>().ok())
        })
}

fn parse_synced_surah_audio(body: &str, surah_id: i64) -> Result<SyncedSurahAudio, String> {
    let json: serde_json::Value = serde_json::from_str(body)
        .map_err(|error| format!("Invalid Quran timing response: {}", error))?;
    let audio = json
        .get("audio_file")
        .ok_or_else(|| "Quran timing response had no audio file.".to_string())?;
    let audio_url = audio
        .get("audio_url")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| value.starts_with("https://"))
        .ok_or_else(|| "Quran timing response had no secure audio URL.".to_string())?
        .to_string();
    let timestamps = audio
        .get("timestamps")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Quran timing response had no timestamp list.".to_string())?;

    let mut ayah_timings = Vec::new();
    let mut word_timings = Vec::new();
    for timestamp in timestamps {
        let Some(verse_key) = timestamp.get("verse_key").and_then(|value| value.as_str()) else {
            continue;
        };
        let mut parts = verse_key.split(':');
        let chapter = parts.next().and_then(|part| part.parse::<i64>().ok());
        let ayah = parts.next().and_then(|part| part.parse::<i64>().ok());
        let (Some(chapter), Some(ayah)) = (chapter, ayah) else {
            continue;
        };
        if chapter != surah_id || ayah < 1 {
            continue;
        }

        let start_ms = json_i64(timestamp.get("timestamp_from"));
        let end_ms = json_i64(timestamp.get("timestamp_to"));
        if let (Some(start_ms), Some(end_ms)) = (start_ms, end_ms) {
            if start_ms >= 0 && end_ms >= start_ms {
                ayah_timings.push(AyahTiming {
                    ayah,
                    start_ms,
                    end_ms,
                });
            }
        }

        let Some(segments) = timestamp.get("segments").and_then(|value| value.as_array()) else {
            continue;
        };
        for segment in segments {
            let Some(values) = segment.as_array() else {
                continue;
            };
            if values.len() < 3 {
                continue;
            }
            let word_index = json_i64(values.first());
            let start_ms = json_i64(values.get(1));
            let end_ms = json_i64(values.get(2));
            let (Some(word_index), Some(start_ms), Some(end_ms)) = (word_index, start_ms, end_ms)
            else {
                continue;
            };
            if word_index >= 1 && start_ms >= 0 && end_ms >= start_ms {
                word_timings.push(WordTiming {
                    ayah,
                    word_index,
                    start_ms,
                    end_ms,
                });
            }
        }
    }

    ayah_timings.sort_by_key(|timing| timing.start_ms);
    word_timings.sort_by_key(|timing| timing.start_ms);
    if ayah_timings.is_empty() || word_timings.is_empty() {
        return Err("This reciter has no word timing for the selected surah.".to_string());
    }

    Ok(SyncedSurahAudio {
        audio_url,
        ayah_timings,
        word_timings,
        words_by_ayah: Vec::new(),
    })
}

fn parse_synced_ayah_words(body: &str, surah_id: i64) -> Result<Vec<SyncedAyahWords>, String> {
    let json: serde_json::Value = serde_json::from_str(body)
        .map_err(|error| format!("Invalid Quran word response: {}", error))?;
    let verses = json
        .get("verses")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Quran word response had no verse list.".to_string())?;

    let mut result = Vec::new();
    for verse in verses {
        let ayah = json_i64(verse.get("verse_number"));
        let chapter = json_i64(verse.get("chapter_id")).or_else(|| {
            verse
                .get("verse_key")
                .and_then(|value| value.as_str())
                .and_then(|key| key.split(':').next())
                .and_then(|value| value.parse::<i64>().ok())
        });
        let (Some(ayah), Some(chapter)) = (ayah, chapter) else {
            continue;
        };
        if chapter != surah_id || ayah < 1 {
            continue;
        }
        let Some(entries) = verse.get("words").and_then(|value| value.as_array()) else {
            continue;
        };
        let words = entries
            .iter()
            .filter(|entry| {
                entry
                    .get("char_type_name")
                    .and_then(|value| value.as_str())
                    .map(|value| value == "word")
                    .unwrap_or(true)
            })
            .filter_map(|entry| entry.get("text_uthmani").and_then(|value| value.as_str()))
            .map(str::trim)
            .filter(|word| !word.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>();
        if !words.is_empty() {
            result.push(SyncedAyahWords { ayah, words });
        }
    }
    result.sort_by_key(|entry| entry.ayah);
    Ok(result)
}

#[cfg(test)]
mod timing_tests {
    use super::{
        duplicates_word_read, is_supported_word_timing_read, normalize_server_url,
        parse_synced_ayah_words, parse_synced_surah_audio, parse_timing_reads, word_timing_reads,
    };

    #[test]
    fn timing_reads_keep_riwayah_in_the_name_and_hafs_plain() {
        let body = r#"[
          {"id": 5, "name": "أحمد العجمي", "rewaya": "حفص عن عاصم", "folder_url": "https://server10.mp3quran.net/ajm/"},
          {"id": 51, "name": "الحصري", "rewaya": "ورش عن نافع", "folder_url": "https://server13.mp3quran.net/husr_warsh/"}
        ]"#;
        let reads = parse_timing_reads(body).expect("valid reads response");
        assert_eq!(reads[0].name, "أحمد العجمي");
        assert_eq!(reads[1].name, "الحصري - ورش عن نافع");
        // The riwayah suffix keeps the Warsh read out of the Hafs dedup.
        assert!(!duplicates_word_read(&reads[1].name));
    }

    #[test]
    fn server_urls_match_regardless_of_trailing_slash_and_case() {
        assert_eq!(
            normalize_server_url("https://Server10.mp3quran.net/ajm/"),
            normalize_server_url("https://server10.mp3quran.net/ajm"),
        );
    }

    #[test]
    fn word_reads_are_unique_supported_and_deduplicated() {
        let reads = word_timing_reads();
        assert_eq!(reads.len(), 16);
        let unique_ids = reads
            .iter()
            .map(|read| read.id.as_str())
            .collect::<std::collections::HashSet<_>>();
        assert_eq!(unique_ids.len(), reads.len());
        assert!(reads.iter().all(|read| read.timing_level == "word"));
        assert!(reads
            .iter()
            .all(|read| is_supported_word_timing_read(&read.id)));
        // The duplicate alternate recordings are not listed.
        assert!(!reads.iter().any(|read| read.id == "97" || read.id == "173"));
    }

    #[test]
    fn ayah_catalog_skips_word_covered_hafs_but_keeps_other_riwayat() {
        // Already word-exact in the same style — skipped.
        assert!(duplicates_word_read("مشاري راشد العفاسي"));
        assert!(duplicates_word_read("عبد الباسط عبد الصمد"));
        // Another riwayah is distinct content — kept.
        assert!(!duplicates_word_read("الحصري - ورش عن نافع"));
        assert!(!duplicates_word_read("عبد الباسط - ورش"));
        // Reciters without word-exact coverage — kept.
        assert!(!duplicates_word_read("ماهر المعيقلي"));
        assert!(!duplicates_word_read("أحمد طالب بن حميد"));
    }

    #[test]
    fn parses_word_segments_and_ignores_incomplete_legacy_segments() {
        let body = r#"{
          "audio_file": {
            "audio_url": "https://example.test/1.mp3",
            "timestamps": [{
              "verse_key": "1:1",
              "timestamp_from": 0,
              "timestamp_to": 1200,
              "segments": [[1, 0, 500], [1], [2, 500, 1100]]
            }]
          }
        }"#;

        let parsed = parse_synced_surah_audio(body, 1).expect("valid timing response");
        assert_eq!(parsed.ayah_timings.len(), 1);
        assert_eq!(parsed.word_timings.len(), 2);
        assert_eq!(parsed.word_timings[1].word_index, 2);
    }

    #[test]
    fn parses_only_quran_words_and_excludes_the_end_marker() {
        let body = r#"{
          "verses": [{
            "verse_number": 1,
            "verse_key": "1:1",
            "words": [
              {"char_type_name": "word", "text_uthmani": "بِسْمِ"},
              {"char_type_name": "word", "text_uthmani": "ٱللَّهِ"},
              {"char_type_name": "end", "text_uthmani": "١"}
            ]
          }]
        }"#;

        let parsed = parse_synced_ayah_words(body, 1).expect("valid word response");
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].words, vec!["بِسْمِ", "ٱللَّهِ"]);
    }
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

fn get_reciters_blocking(
    app_handle: &AppHandle,
    language: &str,
) -> Result<Vec<QuranReciter>, String> {
    let language = if language.trim().eq_ignore_ascii_case("ar") {
        "ar"
    } else {
        "eng"
    };
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
    let json: serde_json::Value = serde_json::from_str(body)
        .map_err(|error| format!("Invalid reciter response: {}", error))?;

    let entries = json
        .get("reciters")
        .and_then(|value| value.as_array())
        .ok_or_else(|| "Reciter response had no list.".to_string())?;

    let mut reciters = Vec::new();
    for entry in entries {
        let Some(name) = entry.get("name").and_then(|value| value.as_str()) else {
            continue;
        };
        let reciter_id = entry
            .get("id")
            .map(|value| value.to_string().trim_matches('"').to_string())
            .unwrap_or_default();
        let Some(moshafs) = entry.get("moshaf").and_then(|value| value.as_array()) else {
            continue;
        };

        for moshaf in moshafs {
            let Some(server) = moshaf.get("server").and_then(|value| value.as_str()) else {
                continue;
            };
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

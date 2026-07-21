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
pub fn get_quran_surahs(
    app_handle: AppHandle,
    riwayah: Option<String>,
) -> Result<Vec<SurahMeta>, String> {
    let quran = load_riwayah(&app_handle, riwayah.as_deref())?;
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
pub fn get_quran_surah(
    app_handle: AppHandle,
    surah_id: i64,
    riwayah: Option<String>,
) -> Result<Surah, String> {
    let quran = load_riwayah(&app_handle, riwayah.as_deref())?;
    quran
        .iter()
        .find(|surah| surah.id == surah_id)
        .cloned()
        .ok_or_else(|| format!("Surah {} was not found.", surah_id))
}

/// Selects the requested riwayah's text. Hafs is the default; Warsh uses the
/// official KFGQPC dataset with its own (Madani) verse numbering — the two
/// numberings are never mixed.
fn load_riwayah(app_handle: &AppHandle, riwayah: Option<&str>) -> Result<&'static Vec<Surah>, String> {
    match riwayah.map(str::trim) {
        Some("warsh") => load_warsh(app_handle),
        _ => load_quran(app_handle),
    }
}

/// The bundled Warsh text (KFGQPC warshData v10), grouped once into the same
/// Surah shape. Surah names and metadata come from the Hafs catalog (they are
/// identical); verse texts, counts, and numbering come only from the Warsh
/// dataset itself. Warsh has no bundled translation.
static WARSH: OnceLock<Vec<Surah>> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct WarshRow {
    sura: i64,
    aya: i64,
    text: String,
}

fn load_warsh(app_handle: &AppHandle) -> Result<&'static Vec<Surah>, String> {
    if let Some(warsh) = WARSH.get() {
        return Ok(warsh);
    }

    let hafs = load_quran(app_handle)?;
    let path = locate_resource_file(app_handle, "quran-warsh.json")
        .ok_or_else(|| "The bundled Warsh text file could not be found.".to_string())?;
    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read the Warsh text: {}", error))?;
    let rows: Vec<WarshRow> = serde_json::from_str(&raw)
        .map_err(|error| format!("Could not parse the Warsh text: {}", error))?;

    let mut surahs: Vec<Surah> = hafs
        .iter()
        .map(|surah| Surah {
            id: surah.id,
            name: surah.name.clone(),
            transliteration: surah.transliteration.clone(),
            translation: surah.translation.clone(),
            revelation_type: surah.revelation_type.clone(),
            total_verses: 0,
            verses: Vec::new(),
        })
        .collect();

    for row in rows {
        let index = (row.sura - 1) as usize;
        let Some(surah) = surahs.get_mut(index) else {
            continue;
        };
        surah.verses.push(Verse {
            id: row.aya,
            text: row.text,
            translation: String::new(),
        });
    }
    for surah in &mut surahs {
        surah.verses.sort_by_key(|verse| verse.id);
        surah.total_verses = surah.verses.len() as i64;
        if surah.verses.is_empty() {
            return Err("The bundled Warsh text is incomplete.".to_string());
        }
    }

    Ok(WARSH.get_or_init(|| surahs))
}

fn load_quran(app_handle: &AppHandle) -> Result<&'static Vec<Surah>, String> {
    if let Some(quran) = QURAN.get() {
        return Ok(quran);
    }

    let path = locate_resource_file(app_handle, "quran.json")
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

fn locate_resource_file(app_handle: &AppHandle, file_name: &str) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        candidates.push(resource_dir.join(file_name));
        candidates.push(resource_dir.join("resources").join(file_name));
    }
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(file_name));
            candidates.push(exe_dir.join("resources").join(file_name));
        }
    }
    // Dev builds run from src-tauri, where the file lives in ./resources.
    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(file_name),
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

/// The reading tracker's reciter catalog: the FULL live Quran.com recitation
/// list (every recording that can provide exact word segments), fetched at
/// runtime so newly published reciters appear without an app update. Falls
/// back to the bundled list when offline on first run. Every recording is
/// verified at play time — it either yields real word segments or reports
/// "sync unavailable"; the tracker never runs on guessed timing.
#[tauri::command]
pub async fn get_quran_word_timing_reads(app_handle: AppHandle) -> Result<Vec<TimingRead>, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(dynamic_word_reads(&app_handle)))
        .await
        .map_err(|error| error.to_string())?
}

fn dynamic_word_reads(app_handle: &AppHandle) -> Vec<TimingRead> {
    let cache_path = match get_app_data_dir(app_handle) {
        Ok(dir) => {
            let cache_dir = dir.join("cache");
            let _ = fs::create_dir_all(&cache_dir);
            Some(cache_dir.join("quran-word-reads-v1.json"))
        }
        Err(_) => None,
    };

    // A fresh cache (under 24h) avoids hitting the catalog on every visit.
    if let Some(path) = cache_path.as_deref() {
        if let (Ok(metadata), Ok(raw)) = (fs::metadata(path), fs::read_to_string(path)) {
            let fresh = metadata
                .modified()
                .ok()
                .and_then(|time| time.elapsed().ok())
                .map(|age| age.as_secs() < 24 * 60 * 60)
                .unwrap_or(false);
            if fresh {
                if let Ok(cached) = serde_json::from_str::<Vec<TimingRead>>(&raw) {
                    if cached.len() >= word_timing_reads().len() {
                        return cached;
                    }
                }
            }
        }
    }

    if let Some(reads) = fetch_quran_com_reciters() {
        if reads.len() >= word_timing_reads().len() {
            if let Some(path) = cache_path.as_deref() {
                if let Ok(json) = serde_json::to_string(&reads) {
                    let _ = fs::write(path, json);
                }
            }
            return reads;
        }
    }

    // Offline / fetch failed: stale cache, then the bundled list.
    if let Some(path) = cache_path.as_deref() {
        if let Ok(raw) = fs::read_to_string(path) {
            if let Ok(cached) = serde_json::from_str::<Vec<TimingRead>>(&raw) {
                if !cached.is_empty() {
                    return cached;
                }
            }
        }
    }
    word_timing_reads()
}

/// Fetches the complete Quran.com reciter catalog in English and Arabic and
/// zips the two locales by recitation id.
fn fetch_quran_com_reciters() -> Option<Vec<TimingRead>> {
    let english = fetch_url("https://api.qurancdn.com/api/qdc/audio/reciters?locale=en").ok()?;
    let english = parse_quran_com_reciters(&english)?;
    if english.is_empty() {
        return None;
    }
    let arabic = fetch_url("https://api.qurancdn.com/api/qdc/audio/reciters?locale=ar")
        .ok()
        .and_then(|body| parse_quran_com_reciters(&body))
        .unwrap_or_default();
    let arabic_by_id: std::collections::HashMap<i64, String> = arabic.into_iter().collect();

    // The catalog can list two recordings of the same reciter and style under
    // one display name; keep the long-established (lowest id) recording so
    // the list never shows duplicates.
    let mut english = english;
    english.sort_by_key(|(id, _)| *id);
    let mut seen_names = std::collections::HashSet::new();
    let mut reads = english
        .into_iter()
        .filter(|(_, name)| seen_names.insert(name.clone()))
        .map(|(id, name)| TimingRead {
            id: id.to_string(),
            name: name.clone(),
            name_ar: arabic_by_id.get(&id).cloned().or(Some(name)),
            timing_level: "word".to_string(),
            folder_url: String::new(),
        })
        .collect::<Vec<_>>();
    reads.sort_by(|a, b| a.name.cmp(&b.name));
    Some(reads)
}

/// Parses the Quran.com `/audio/reciters` response: `{"reciters":[{"id":…,
/// "name":…,"translated_name":{"name":…},"style":{"name":…},"qirat":
/// {"name":…}}]}`. The style is appended to the display name; a non-Hafs
/// qirat is appended too so distinct riwayat stay tellable apart.
fn parse_quran_com_reciters(body: &str) -> Option<Vec<(i64, String)>> {
    let json: serde_json::Value = serde_json::from_str(body).ok()?;
    let entries = json.get("reciters")?.as_array()?;

    let nested_name = |entry: &serde_json::Value, key: &str| -> Option<String> {
        entry
            .get(key)?
            .get("name")?
            .as_str()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    };

    let mut reciters = Vec::new();
    for entry in entries {
        let Some(id) = json_i64(entry.get("id")) else {
            continue;
        };
        let base = nested_name(entry, "translated_name")
            .or_else(|| {
                entry
                    .get("name")
                    .and_then(|value| value.as_str())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(str::to_string)
            });
        let Some(base) = base else {
            continue;
        };
        let mut name = base;
        if let Some(style) = nested_name(entry, "style") {
            name = format!("{} - {}", name, style);
        }
        if let Some(qirat) = nested_name(entry, "qirat") {
            let lowered = qirat.to_lowercase();
            if !lowered.contains("hafs") && !qirat.contains("حفص") {
                name = format!("{} ({})", name, qirat);
            }
        }
        reciters.push((id, name));
    }
    Some(reciters)
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
        // Any catalog recitation id is a number; the recording itself is then
        // verified below — real word segments or a clean error, never a guess.
        if read_id.is_empty() || !read_id.chars().all(|c| c.is_ascii_digit()) {
            return Err("This reciter does not provide verified word timing.".to_string());
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
                    && !cached.word_timings.is_empty()
                    && !cached.words_by_ayah.is_empty()
                {
                    return Ok(cached);
                }
            }
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
        parse_quran_com_reciters, parse_synced_ayah_words, parse_synced_surah_audio,
        word_timing_reads,
    };

    #[test]
    fn parses_the_quran_com_reciter_catalog_with_styles_and_riwayah() {
        let body = r#"{
          "reciters": [
            {"id": 7, "name": "Mishari", "translated_name": {"name": "Mishari Rashid al-`Afasy"},
             "style": {"name": "Murattal"}, "qirat": {"name": "Hafs"}},
            {"id": 210, "translated_name": {"name": "Some Reciter"},
             "style": {"name": "Murattal"}, "qirat": {"name": "Warsh"}},
            {"id": 999, "name": ""}
          ]
        }"#;
        let reciters = parse_quran_com_reciters(body).expect("valid catalog");
        assert_eq!(reciters.len(), 2);
        assert_eq!(reciters[0].0, 7);
        assert_eq!(reciters[0].1, "Mishari Rashid al-`Afasy - Murattal");
        // A non-Hafs qirat is kept visible in the name.
        assert_eq!(reciters[1].1, "Some Reciter - Murattal (Warsh)");
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
            .all(|read| read.id.chars().all(|c| c.is_ascii_digit())));
        // The duplicate alternate recordings are not listed.
        assert!(!reads.iter().any(|read| read.id == "97" || read.id == "173"));
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

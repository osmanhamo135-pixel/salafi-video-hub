use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::utils::paths::get_app_data_dir;
use crate::utils::process::hidden_command;

/// How long a cached catalog stays fresh before we try the network again.
const CATALOG_TTL: Duration = Duration::from_secs(60 * 60 * 24);
const CATALOG_ENDPOINT: &str = "https://mp3quran.net/api/v3/radios";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RadioStation {
    pub id: String,
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RadioCatalog {
    pub stations: Vec<RadioStation>,
    pub from_cache: bool,
    pub fetched_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct CachedCatalog {
    fetched_at: u64,
    stations: Vec<RadioStation>,
}

/// Returns the Quran radio station catalog for a language ("ar" or "eng").
///
/// Strategy (per the reliability plan): serve a fresh cache instantly; refresh
/// from the remote catalog when stale; and if the network fails, keep serving
/// the last cached catalog so radio still lists stations.
#[tauri::command]
pub async fn get_radio_stations(
    app_handle: AppHandle,
    language: String,
) -> Result<RadioCatalog, String> {
    tauri::async_runtime::spawn_blocking(move || get_radio_stations_blocking(&app_handle, &language))
        .await
        .map_err(|error| error.to_string())?
}

fn get_radio_stations_blocking(
    app_handle: &AppHandle,
    language: &str,
) -> Result<RadioCatalog, String> {
    let language = normalize_language(language);
    let cache_path = catalog_cache_path(app_handle, language)?;
    let cached = read_cache(&cache_path);

    if let Some(cache) = &cached {
        if cache_age(cache) < CATALOG_TTL && !cache.stations.is_empty() {
            return Ok(RadioCatalog {
                stations: cache.stations.clone(),
                from_cache: true,
                fetched_at: cache.fetched_at,
            });
        }
    }

    match fetch_catalog(language) {
        Ok(stations) if !stations.is_empty() => {
            let fetched_at = now_secs();
            let _ = write_cache(&cache_path, &CachedCatalog { fetched_at, stations: stations.clone() });
            Ok(RadioCatalog { stations, from_cache: false, fetched_at })
        }
        _ => {
            if let Some(cache) = cached {
                if !cache.stations.is_empty() {
                    return Ok(RadioCatalog {
                        stations: cache.stations,
                        from_cache: true,
                        fetched_at: cache.fetched_at,
                    });
                }
            }
            Err("Could not load the radio stations. Check your internet connection and try again.".to_string())
        }
    }
}

fn normalize_language(language: &str) -> &'static str {
    if language.trim().eq_ignore_ascii_case("ar") {
        "ar"
    } else {
        "eng"
    }
}

fn catalog_cache_path(app_handle: &AppHandle, language: &str) -> Result<PathBuf, String> {
    let dir = get_app_data_dir(app_handle)?.join("cache");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("radio-catalog-{}.json", language)))
}

fn read_cache(path: &PathBuf) -> Option<CachedCatalog> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_cache(path: &PathBuf, cache: &CachedCatalog) -> Result<(), String> {
    let json = serde_json::to_string(cache).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn cache_age(cache: &CachedCatalog) -> Duration {
    Duration::from_secs(now_secs().saturating_sub(cache.fetched_at))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn fetch_catalog(language: &str) -> Result<Vec<RadioStation>, String> {
    let url = format!("{}?language={}", CATALOG_ENDPOINT, language);
    let body = fetch_url(&url)?;
    parse_stations(&body)
}

/// Fetches a URL body with the system curl (curl.exe ships with Windows 10+).
pub(crate) fn fetch_url(url: &str) -> Result<String, String> {
    let mut errors = Vec::new();

    for program in ["curl.exe", "curl"] {
        match hidden_command(program)
            .args([
                "-L",
                "--fail",
                "--silent",
                "--connect-timeout",
                "15",
                "--max-time",
                "30",
                // Some catalog CDNs reject curl's default agent with 403.
                "-A",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SalafiHub/1.0",
                url,
            ])
            .output()
        {
            Ok(output) if output.status.success() => {
                return String::from_utf8(output.stdout).map_err(|e| e.to_string());
            }
            Ok(output) => errors.push(format!(
                "{}: {}",
                program,
                String::from_utf8_lossy(&output.stderr).lines().next().unwrap_or("request failed")
            )),
            Err(error) => errors.push(format!("{}: {}", program, error)),
        }
    }

    Err(errors.join(" | "))
}

fn parse_stations(body: &str) -> Result<Vec<RadioStation>, String> {
    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|e| format!("Invalid catalog response: {}", e))?;

    // The catalog is {"radios": [{id, name, url}, ...]}; parse defensively in
    // case the payload is a bare array or field names shift.
    let entries = json
        .get("radios")
        .and_then(|value| value.as_array())
        .or_else(|| json.as_array())
        .ok_or_else(|| "Catalog response had no station list.".to_string())?;

    let stations = entries
        .iter()
        .filter_map(|entry| {
            let name = entry.get("name")?.as_str()?.trim().to_string();
            let url = entry
                .get("url")
                .or_else(|| entry.get("radio_url"))?
                .as_str()?
                .trim()
                .to_string();
            if name.is_empty() || !(url.starts_with("http://") || url.starts_with("https://")) {
                return None;
            }
            let id = entry
                .get("id")
                .map(|value| value.to_string().trim_matches('"').to_string())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| url.clone());
            Some(RadioStation { id, name, url })
        })
        .collect::<Vec<_>>();

    Ok(stations)
}

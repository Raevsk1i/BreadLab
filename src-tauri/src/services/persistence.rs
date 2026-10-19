use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use indexmap::IndexMap;
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::models::{Calibration, CookSession, UserState, SCHEMA_VERSION};

const MAX_IMPORT_BYTES: u64 = 2_000_000;
const IMPORT_KEYS: [&str; 6] = [
    "pantry",
    "favorites",
    "calibrations",
    "recent",
    "enabledTasteAddins",
    "checklist",
];

#[derive(Debug, Clone)]
pub struct LoadOutcome {
    pub state: UserState,
    pub notice: Option<String>,
}

pub fn state_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|err| AppError::Message(format!("Каталог данных недоступен: {err}")))?;
    let dir = base.join("BreadLab");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn load_app(app: &AppHandle) -> LoadOutcome {
    match state_dir(app) {
        Ok(dir) => load_dir(&dir),
        Err(err) => LoadOutcome {
            state: UserState::default(),
            notice: Some(err.to_string()),
        },
    }
}

pub fn save_app(app: &AppHandle, state: &UserState) -> Result<(), AppError> {
    let dir = state_dir(app)?;
    save_dir(&dir, state)
}

pub fn load_dir(dir: &Path) -> LoadOutcome {
    let primary = dir.join("state.json");
    let backup = dir.join("state.backup.json");
    if !primary.exists() && !backup.exists() {
        return LoadOutcome {
            state: UserState::default(),
            notice: None,
        };
    }
    match read_state_file(&primary) {
        Ok(state) => LoadOutcome {
            state,
            notice: None,
        },
        Err(_) => match read_state_file(&backup) {
            Ok(state) => LoadOutcome {
                state,
                notice: Some(
                    "Основной файл состояния повреждён. Восстановлена резервная копия.".into(),
                ),
            },
            Err(_) => LoadOutcome {
                state: UserState::default(),
                notice: Some("Сохранённые данные повреждены — начата новая сессия".into()),
            },
        },
    }
}

pub fn save_dir(dir: &Path, state: &UserState) -> Result<(), AppError> {
    fs::create_dir_all(dir)?;
    let mut clean = state.clone();
    prepare_for_save(&mut clean);
    let primary = dir.join("state.json");
    let backup = dir.join("state.backup.json");
    let tmp = dir.join(".state.json.tmp");
    if primary.exists() && read_state_file(&primary).is_ok() {
        fs::copy(&primary, &backup)?;
    }
    let bytes = serde_json::to_vec_pretty(&clean)?;
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, &primary)?;
    Ok(())
}

fn read_state_file(path: &Path) -> Result<UserState, AppError> {
    if !path.exists() {
        return Err(AppError::Invalid("файл отсутствует".into()));
    }
    let raw = fs::read_to_string(path)?;
    if raw.trim().is_empty() {
        return Err(AppError::Empty);
    }
    let state: UserState = serde_json::from_str(&raw)?;
    Ok(state)
}

pub fn prepare_for_save(state: &mut UserState) {
    state.schema_version = SCHEMA_VERSION;
    if let Some(session) = state.cook_session.as_mut() {
        session.running = false;
    }
    if !state.target_flour_g.is_finite() {
        state.target_flour_g = 450.0;
    }
    state.target_flour_g = state.target_flour_g.round().clamp(250.0, 650.0);
    state.recent.truncate(10);
    prune_checklist(state);
}

pub fn prune_checklist(state: &mut UserState) {
    if state.checklist.len() <= 8 {
        return;
    }
    let mut keep_ids = Vec::new();
    for id in state.recent.iter().take(8) {
        if !keep_ids.iter().any(|existing| existing == id) {
            keep_ids.push(id.clone());
        }
    }
    if let Some(session) = &state.cook_session {
        if !keep_ids.iter().any(|id| id == &session.recipe_id) {
            keep_ids.push(session.recipe_id.clone());
        }
    }
    if let Some(selected) = &state.selected_recipe_id {
        if !keep_ids.iter().any(|id| id == selected) {
            keep_ids.push(selected.clone());
        }
    }
    let mut next = IndexMap::new();
    for (key, value) in &state.checklist {
        let recipe_id = key.split("::").next().unwrap_or("");
        if keep_ids.iter().any(|id| id == recipe_id) {
            next.insert(key.clone(), value.clone());
        }
    }
    if next.len() > 8 {
        let drop_count = next.len() - 8;
        let keys: Vec<String> = next.keys().take(drop_count).cloned().collect();
        for key in keys {
            next.shift_remove(&key);
        }
    }
    state.checklist = next;
}

pub fn is_breadlab_import(value: &Value) -> bool {
    let Some(object) = value.as_object() else {
        return false;
    };
    if object.get("app").and_then(Value::as_str) == Some("BreadLab") {
        return true;
    }
    IMPORT_KEYS.iter().any(|key| object.contains_key(*key))
}

pub fn read_import_file(path: &Path) -> Result<Value, AppError> {
    let file = fs::File::open(path)?;
    let meta = file.metadata()?;
    if !meta.is_file() {
        return Err(AppError::Invalid("ожидался файл".into()));
    }
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(AppError::TooLarge);
    }
    let mut limited = file.take(MAX_IMPORT_BYTES + 1);
    let mut bytes = Vec::new();
    limited.read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_IMPORT_BYTES {
        return Err(AppError::TooLarge);
    }
    if bytes.iter().all(u8::is_ascii_whitespace) {
        return Err(AppError::Empty);
    }
    let value: Value = serde_json::from_slice(&bytes)?;
    if !is_breadlab_import(&value) {
        return Err(AppError::NotBreadLab);
    }
    Ok(value)
}

pub fn merge_import(state: &mut UserState, value: &Value) -> Result<(), AppError> {
    let Some(data) = value.as_object() else {
        return Err(AppError::NotBreadLab);
    };
    if let Some(pantry) = data.get("pantry").and_then(Value::as_object) {
        state.pantry = bool_map(pantry);
    }
    if let Some(flag) = data.get("staplesOn").and_then(Value::as_bool) {
        state.staples_on = flag;
    }
    if let Some(flag) = data.get("nearMatchOn").and_then(Value::as_bool) {
        state.near_match_on = flag;
    }
    if let Some(list) = data.get("favorites").and_then(Value::as_array) {
        state.favorites = string_list(list, 200);
    }
    if let Some(list) = data.get("recent").and_then(Value::as_array) {
        state.recent = string_list(list, 10);
    }
    if let Some(list) = data.get("calibrations").and_then(Value::as_array) {
        state.calibrations = list
            .iter()
            .filter_map(|item| serde_json::from_value::<Calibration>(item.clone()).ok())
            .filter(|item| !item.recipe_id.is_empty() && item.actual_finished_weight_g.is_finite())
            .collect();
    }
    if let Some(map) = data.get("addinsByRecipe").and_then(Value::as_object) {
        state.addins_by_recipe = nested_bool_map(map);
    }
    if let Some(map) = data.get("enabledTasteAddins").and_then(Value::as_object) {
        state.enabled_taste_addins = bool_map(map);
        if data.get("addinsByRecipe").is_none() {
            if let Some(recipe_id) = state.selected_recipe_id.clone() {
                state
                    .addins_by_recipe
                    .insert(recipe_id, state.enabled_taste_addins.clone());
            }
        }
    }
    if let Some(session) = data.get("cookSession") {
        if session.is_null() {
            state.cook_session = None;
        } else if let Ok(mut parsed) = serde_json::from_value::<CookSession>(session.clone()) {
            if !parsed.recipe_id.is_empty() {
                parsed.running = false;
                state.cook_session = Some(parsed);
            }
        }
    }
    if let Some(id) = data.get("defaultMachineId").and_then(Value::as_str) {
        state.default_machine_id = id.to_string();
    }
    if let Some(flag) = data.get("largeSteps").and_then(Value::as_bool) {
        state.large_steps = flag;
    }
    if let Some(settings) = data.get("settings").and_then(Value::as_object) {
        if let Some(id) = settings.get("defaultMachineId").and_then(Value::as_str) {
            state.default_machine_id = id.to_string();
        }
        if let Some(flag) = settings.get("largeSteps").and_then(Value::as_bool) {
            state.large_steps = flag;
        }
    }
    if let Some(value) = data.get("catalogDifficulty").and_then(Value::as_str) {
        state.catalog_difficulty = value.to_string();
    }
    if let Some(flag) = data.get("catalogFavoritesOnly").and_then(Value::as_bool) {
        state.catalog_favorites_only = flag;
    }
    if let Some(flag) = data.get("catalogCanBake").and_then(Value::as_bool) {
        state.catalog_can_bake = flag;
    }
    if let Some(id) = data.get("selectedRecipeId").and_then(Value::as_str) {
        state.selected_recipe_id = Some(id.to_string());
    }
    if let Some(id) = data.get("selectedMachineId").and_then(Value::as_str) {
        state.selected_machine_id = Some(id.to_string());
    }
    if let Some(flour) = data.get("targetFlourG").and_then(Value::as_f64) {
        if flour.is_finite() {
            state.target_flour_g = flour.round().clamp(250.0, 650.0);
        }
    }
    if let Some(map) = data.get("checklist").and_then(Value::as_object) {
        state.checklist = nested_bool_map(map);
    }
    if let Some(flag) = data.get("catalogOpen").and_then(Value::as_bool) {
        state.catalog_open = flag;
    }
    state.schema_version = SCHEMA_VERSION;
    Ok(())
}

fn bool_map(object: &Map<String, Value>) -> IndexMap<String, bool> {
    object
        .iter()
        .filter_map(|(key, value)| value.as_bool().map(|flag| (key.clone(), flag)))
        .collect()
}

fn nested_bool_map(object: &Map<String, Value>) -> IndexMap<String, IndexMap<String, bool>> {
    object
        .iter()
        .filter_map(|(key, value)| {
            value
                .as_object()
                .map(|inner| (key.clone(), bool_map(inner)))
        })
        .collect()
}

fn string_list(list: &[Value], limit: usize) -> Vec<String> {
    list.iter()
        .filter_map(|item| item.as_str().map(str::to_string))
        .filter(|item| !item.is_empty())
        .take(limit)
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSettings<'a> {
    default_machine_id: &'a str,
    large_steps: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportPayload<'a> {
    app: &'static str,
    version: &'a str,
    exported_at: String,
    schema_version: u32,
    pantry: &'a IndexMap<String, bool>,
    staples_on: bool,
    near_match_on: bool,
    favorites: &'a [String],
    recent: &'a [String],
    calibrations: &'a [Calibration],
    enabled_taste_addins: &'a IndexMap<String, bool>,
    addins_by_recipe: &'a IndexMap<String, IndexMap<String, bool>>,
    cook_session: &'a Option<CookSession>,
    default_machine_id: &'a str,
    large_steps: bool,
    settings: ExportSettings<'a>,
    catalog_difficulty: &'a str,
    catalog_favorites_only: bool,
    catalog_can_bake: bool,
    selected_recipe_id: &'a Option<String>,
    selected_machine_id: &'a Option<String>,
    target_flour_g: f64,
    checklist: &'a IndexMap<String, IndexMap<String, bool>>,
    catalog_open: bool,
}

pub fn export_value(state: &UserState, version: &str) -> Result<Value, AppError> {
    let mut clean = state.clone();
    prepare_for_save(&mut clean);
    let payload = ExportPayload {
        app: "BreadLab",
        version,
        exported_at: iso_now(),
        schema_version: SCHEMA_VERSION,
        pantry: &clean.pantry,
        staples_on: clean.staples_on,
        near_match_on: clean.near_match_on,
        favorites: &clean.favorites,
        recent: &clean.recent,
        calibrations: &clean.calibrations,
        enabled_taste_addins: &clean.enabled_taste_addins,
        addins_by_recipe: &clean.addins_by_recipe,
        cook_session: &clean.cook_session,
        default_machine_id: &clean.default_machine_id,
        large_steps: clean.large_steps,
        settings: ExportSettings {
            default_machine_id: &clean.default_machine_id,
            large_steps: clean.large_steps,
        },
        catalog_difficulty: &clean.catalog_difficulty,
        catalog_favorites_only: clean.catalog_favorites_only,
        catalog_can_bake: clean.catalog_can_bake,
        selected_recipe_id: &clean.selected_recipe_id,
        selected_machine_id: &clean.selected_machine_id,
        target_flour_g: clean.target_flour_g,
        checklist: &clean.checklist,
        catalog_open: clean.catalog_open,
    };
    Ok(serde_json::to_value(payload)?)
}

pub fn write_export(path: &Path, state: &UserState, version: &str) -> Result<(), AppError> {
    let value = export_value(state, version)?;
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(AppError::Invalid("каталог для экспорта не найден".into()));
        }
    }
    let text = serde_json::to_string_pretty(&value)?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text + "\n")?;
    fs::rename(&tmp, path)?;
    Ok(())
}

pub fn validate_user_path(path: &str) -> Result<PathBuf, AppError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppError::Invalid("путь не указан".into()));
    }
    let buf = PathBuf::from(trimmed);
    if buf
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(AppError::Invalid("недопустимый путь".into()));
    }
    Ok(buf)
}

fn iso_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let days = secs / 86_400;
    let time = secs % 86_400;
    let hour = time / 3600;
    let minute = (time % 3600) / 60;
    let second = time % 60;
    let (year, month, day) = civil_from_days(days as i64);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    (year as i32, month as u32, day as u32)
}

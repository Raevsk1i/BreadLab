use crate::error::AppError;
use crate::models::*;
use crate::services::catalog::Catalog;
use chrono::Utc;
use serde_json::Value;
use std::fs;
use std::path::Path;

pub const MAX_IMPORT_BYTES: u64 = 2 * 1024 * 1024;

pub fn is_breadlab_import_payload(data: &Value) -> bool {
    if !data.is_object() {
        return false;
    }
    if data.get("app").and_then(|v| v.as_str()) == Some("BreadLab") {
        return true;
    }
    let keys = [
        "pantry",
        "favorites",
        "calibrations",
        "recent",
        "enabledTasteAddins",
        "checklist",
    ];
    keys.iter().any(|k| data.get(*k).is_some())
}

pub fn build_export(catalog: &Catalog, state: &PersistedState) -> ExportPayload {
    ExportPayload {
        app: "BreadLab".into(),
        version: catalog.meta.version.clone(),
        exported_at: Utc::now().to_rfc3339(),
        pantry: state.pantry.clone(),
        staples_on: state.staples_on,
        near_match_on: state.near_match_on,
        favorites: state.favorites.clone(),
        recent: state.recent.clone(),
        calibrations: state.calibrations.clone(),
        enabled_taste_addins: state.enabled_taste_addins.clone(),
        addins_by_recipe: state.addins_by_recipe.clone(),
        cook_session: state.cook_session.clone(),
        default_machine_id: state.default_machine_id.clone(),
        large_steps: state.large_steps,
        settings: ExportSettings {
            default_machine_id: state.default_machine_id.clone(),
            large_steps: state.large_steps,
        },
    }
}

pub fn merge_import(state: &mut PersistedState, data: &Value) -> Result<(), AppError> {
    if !is_breadlab_import_payload(data) {
        return Err(AppError::Import(
            "файл не похож на экспорт BreadLab".into(),
        ));
    }

    if let Some(p) = data.get("pantry") {
        state.pantry = serde_json::from_value(p.clone())?;
    }
    if let Some(v) = data.get("staplesOn").and_then(|x| x.as_bool()) {
        state.staples_on = v;
    }
    if let Some(v) = data.get("nearMatchOn").and_then(|x| x.as_bool()) {
        state.near_match_on = v;
    }
    if let Some(v) = data.get("favorites") {
        state.favorites = serde_json::from_value(v.clone())?;
    }
    if let Some(v) = data.get("recent") {
        state.recent = serde_json::from_value(v.clone())?;
    }
    if let Some(v) = data.get("calibrations") {
        state.calibrations = serde_json::from_value(v.clone())?;
    }
    if let Some(v) = data.get("addinsByRecipe") {
        state.addins_by_recipe = serde_json::from_value(v.clone())?;
    } else if let (Some(enabled), Some(rid)) = (
        data.get("enabledTasteAddins"),
        data.get("selectedRecipeId").and_then(|x| x.as_str()),
    ) {
        let map: std::collections::HashMap<String, bool> = serde_json::from_value(enabled.clone())?;
        state.addins_by_recipe.insert(rid.to_string(), map);
    }
    if let Some(v) = data.get("enabledTasteAddins") {
        state.enabled_taste_addins = serde_json::from_value(v.clone())?;
    }
    if let Some(v) = data.get("cookSession") {
        if v.get("recipeId").and_then(|x| x.as_str()).is_some() {
            let mut session: CookSession = serde_json::from_value(v.clone())?;
            session.running = false;
            state.cook_session = Some(session);
        }
    }
    if let Some(v) = data.get("defaultMachineId").and_then(|x| x.as_str()) {
        state.default_machine_id = v.to_string();
    } else if let Some(v) = data
        .get("settings")
        .and_then(|s| s.get("defaultMachineId"))
        .and_then(|x| x.as_str())
    {
        state.default_machine_id = v.to_string();
    }
    if let Some(v) = data.get("largeSteps").and_then(|x| x.as_bool()) {
        state.large_steps = v;
    } else if let Some(v) = data
        .get("settings")
        .and_then(|s| s.get("largeSteps"))
        .and_then(|x| x.as_bool())
    {
        state.large_steps = v;
    }
    // Match original: import accepts checklist key for validation but does not merge it.
    Ok(())
}

pub fn read_import_file(path: &Path) -> Result<Value, AppError> {
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_IMPORT_BYTES {
        return Err(AppError::Import("файл слишком большой (лимит 2 МБ)".into()));
    }
    let raw = fs::read_to_string(path)?;
    let data: Value = serde_json::from_str(&raw)
        .map_err(|e| AppError::Import(format!("повреждённый JSON: {e}")))?;
    if !is_breadlab_import_payload(&data) {
        return Err(AppError::Import(
            "файл не похож на экспорт BreadLab".into(),
        ));
    }
    Ok(data)
}

pub fn write_export_file(path: &Path, payload: &ExportPayload) -> Result<(), AppError> {
    let json = serde_json::to_string_pretty(payload)?;
    fs::write(path, json.as_bytes())?;
    Ok(())
}

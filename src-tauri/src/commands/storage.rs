use crate::error::AppError;
use crate::models::PersistedState;
use crate::services::{app_data_dir, load_state, save_state};
use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadStateResult {
    pub state: PersistedState,
    pub recovered_from_backup: bool,
}

fn data_dir(app: &AppHandle) -> Result<std::path::PathBuf, AppError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    Ok(app_data_dir(&base))
}

#[tauri::command(rename = "load_state")]
pub fn load_state_cmd(app: AppHandle) -> Result<LoadStateResult, AppError> {
    let dir = data_dir(&app)?;
    let (state, recovered) = load_state(&dir)?;
    Ok(LoadStateResult {
        state,
        recovered_from_backup: recovered,
    })
}

#[tauri::command(rename = "save_state")]
pub fn save_state_cmd(app: AppHandle, state: PersistedState) -> Result<(), AppError> {
    let dir = data_dir(&app)?;
    save_state(&dir, &state)
}

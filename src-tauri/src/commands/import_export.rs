use tauri::{AppHandle, State};

use crate::services::persistence::{self, LoadOutcome};
use crate::AppState;

use super::storage::{apply_loaded, LoadResponse};

#[tauri::command]
pub fn import_state(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<LoadResponse, String> {
    let path = persistence::validate_user_path(&path)?;
    if !path.is_file() {
        return Err("Файл не найден".into());
    }
    let value = persistence::read_import_file(&path)?;
    let mut session = state
        .session
        .lock()
        .unwrap_or_else(|err| err.into_inner())
        .clone();
    persistence::merge_import(&mut session, &value)?;
    persistence::prepare_for_save(&mut session);
    persistence::save_app(&app, &session)?;
    let outcome = LoadOutcome {
        state: session,
        notice: Some("Импорт выполнен".into()),
    };
    apply_loaded(&state, outcome.clone());
    Ok(LoadResponse {
        state: outcome.state,
        notice: outcome.notice,
    })
}

#[tauri::command]
pub fn export_state(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let path = persistence::validate_user_path(&path)?;
    let session = state
        .session
        .lock()
        .unwrap_or_else(|err| err.into_inner())
        .clone();
    let version = state.catalog.meta.version.clone();
    persistence::write_export(&path, &session, &version).map_err(|err| err.to_string())
}

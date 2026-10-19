use serde::Serialize;
use tauri::{AppHandle, State};

use crate::models::UserState;
use crate::services::persistence::{self, LoadOutcome};
use crate::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadResponse {
    pub state: UserState,
    pub notice: Option<String>,
}

fn lock_session(state: &AppState) -> std::sync::MutexGuard<'_, UserState> {
    state.session.lock().unwrap_or_else(|err| err.into_inner())
}

fn lock_notice(state: &AppState) -> std::sync::MutexGuard<'_, Option<String>> {
    state.notice.lock().unwrap_or_else(|err| err.into_inner())
}

#[tauri::command]
pub fn load_state(state: State<'_, AppState>) -> LoadResponse {
    let session = lock_session(&state).clone();
    let notice = lock_notice(&state).take();
    LoadResponse {
        state: session,
        notice,
    }
}

#[tauri::command]
pub fn save_state(
    app: AppHandle,
    state: State<'_, AppState>,
    incoming: UserState,
) -> Result<(), String> {
    let mut clean = incoming;
    persistence::prepare_for_save(&mut clean);
    persistence::save_app(&app, &clean).map_err(|err| err.to_string())?;
    *lock_session(&state) = clean;
    Ok(())
}

pub fn apply_loaded(state: &AppState, outcome: LoadOutcome) {
    *lock_session(state) = outcome.state;
    *lock_notice(state) = outcome.notice;
}

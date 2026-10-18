use crate::error::AppError;
use crate::models::{PersistedState, STATE_SCHEMA_VERSION};
use std::fs;
use std::path::{Path, PathBuf};

const STATE_FILE: &str = "state.json";
const BACKUP_FILE: &str = "state.backup.json";
const MAX_STATE_BYTES: u64 = 5 * 1024 * 1024;

pub fn app_data_dir(base: &Path) -> PathBuf {
    base.join("BreadLab")
}

pub fn ensure_dir(dir: &Path) -> Result<(), AppError> {
    fs::create_dir_all(dir).map_err(|e| AppError::Io(format!("create data dir: {e}")))
}

pub fn load_state(data_dir: &Path) -> Result<(PersistedState, bool), AppError> {
    ensure_dir(data_dir)?;
    let primary = data_dir.join(STATE_FILE);
    let backup = data_dir.join(BACKUP_FILE);

    if primary.exists() {
        match read_state_file(&primary) {
            Ok(state) => return Ok((migrate(state), false)),
            Err(_) => {
                if backup.exists() {
                    if let Ok(state) = read_state_file(&backup) {
                        let migrated = migrate(state);
                        let _ = save_state(data_dir, &migrated);
                        return Ok((migrated, true));
                    }
                }
                return Ok((PersistedState::default(), true));
            }
        }
    }

    if backup.exists() {
        if let Ok(state) = read_state_file(&backup) {
            let migrated = migrate(state);
            let _ = save_state(data_dir, &migrated);
            return Ok((migrated, true));
        }
    }

    Ok((PersistedState::default(), false))
}

fn read_state_file(path: &Path) -> Result<PersistedState, AppError> {
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_STATE_BYTES {
        return Err(AppError::Validation("state file too large".into()));
    }
    let raw = fs::read_to_string(path)?;
    let state: PersistedState = serde_json::from_str(&raw)?;
    Ok(state)
}

fn migrate(mut state: PersistedState) -> PersistedState {
    if state.schema_version == 0 {
        state.schema_version = STATE_SCHEMA_VERSION;
    }
    if state.schema_version < STATE_SCHEMA_VERSION {
        state.schema_version = STATE_SCHEMA_VERSION;
    }
    if let Some(session) = state.cook_session.as_mut() {
        session.running = false;
    }
    state
}

pub fn save_state(data_dir: &Path, state: &PersistedState) -> Result<(), AppError> {
    ensure_dir(data_dir)?;
    let primary = data_dir.join(STATE_FILE);
    let backup = data_dir.join(BACKUP_FILE);
    let tmp = data_dir.join("state.json.tmp");

    let mut to_save = state.clone();
    to_save.schema_version = STATE_SCHEMA_VERSION;
    if let Some(session) = to_save.cook_session.as_mut() {
        session.running = false;
    }

    let json = serde_json::to_string_pretty(&to_save)?;
    fs::write(&tmp, json.as_bytes())?;

    if primary.exists() {
        let _ = fs::copy(&primary, &backup);
    }
    fs::rename(&tmp, &primary)?;
    Ok(())
}

use crate::error::AppError;
use crate::models::PersistedState;
use crate::services::{
    app_data_dir, build_export, merge_import, read_import_file, save_state, write_export_file,
    SharedCatalog,
};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub state: PersistedState,
    pub cancelled: bool,
}

#[tauri::command]
pub async fn import_state(
    app: AppHandle,
    catalog: State<'_, SharedCatalog>,
    mut state: PersistedState,
) -> Result<ImportResult, AppError> {
    let _ = catalog;
    let file = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_title("Импорт BreadLab JSON")
        .blocking_pick_file();

    let Some(file) = file else {
        return Ok(ImportResult {
            state,
            cancelled: true,
        });
    };

    let path = file
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    let data = read_import_file(&path)?;
    merge_import(&mut state, &data)?;

    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(e.to_string()))?;
    save_state(&app_data_dir(&base), &state)?;

    Ok(ImportResult {
        state,
        cancelled: false,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub cancelled: bool,
    pub path: Option<String>,
}

#[tauri::command]
pub async fn export_state(
    app: AppHandle,
    catalog: State<'_, SharedCatalog>,
    state: PersistedState,
) -> Result<ExportResult, AppError> {
    let file = app
        .dialog()
        .file()
        .add_filter("JSON", &["json"])
        .set_file_name("breadlab-export.json")
        .set_title("Экспорт BreadLab JSON")
        .blocking_save_file();

    let Some(file) = file else {
        return Ok(ExportResult {
            cancelled: true,
            path: None,
        });
    };

    let path = file
        .into_path()
        .map_err(|e| AppError::Io(e.to_string()))?;
    let payload = build_export(&catalog, &state);
    write_export_file(&path, &payload)?;
    Ok(ExportResult {
        cancelled: false,
        path: Some(path.display().to_string()),
    })
}

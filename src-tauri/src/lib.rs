#![forbid(unsafe_code)]

mod commands;
mod error;
pub mod models;
pub mod services;

use std::sync::Mutex;

use tauri::Manager;

use crate::commands::storage::apply_loaded;
use crate::models::{Catalog, UserState};
use crate::services::persistence::load_app;

pub struct AppState {
    pub catalog: Catalog,
    pub session: Mutex<UserState>,
    pub notice: Mutex<Option<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let catalog = match services::load_catalog() {
        Ok(catalog) => catalog,
        Err(err) => {
            eprintln!("BreadLab: не удалось загрузить справочник: {err}");
            std::process::exit(1);
        }
    };

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            catalog,
            session: Mutex::new(UserState::default()),
            notice: Mutex::new(None),
        })
        .setup(|app| {
            let outcome = load_app(app.handle());
            let state = app.state::<AppState>();
            apply_loaded(&state, outcome);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::recipes::get_catalog,
            commands::recipes::get_recipe,
            commands::recipes::get_ingredients,
            commands::recipes::get_machines,
            commands::calculations::calculate_recipe,
            commands::calculations::search_recipes,
            commands::calculations::validate_machine_limits_cmd,
            commands::calculations::shopping_list,
            commands::storage::load_state,
            commands::storage::save_state,
            commands::import_export::import_state,
            commands::import_export::export_state,
        ]);

    if let Err(err) = builder.run(tauri::generate_context!()) {
        eprintln!("BreadLab: {err}");
        std::process::exit(1);
    }
}

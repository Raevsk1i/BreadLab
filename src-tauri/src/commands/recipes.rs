use tauri::State;

use crate::models::{Machine, Recipe};
use crate::services::{catalog_payload, CatalogPayload};
use crate::AppState;

#[tauri::command]
pub fn get_catalog(state: State<'_, AppState>) -> CatalogPayload {
    catalog_payload(&state.catalog)
}

#[tauri::command]
pub fn get_recipe(state: State<'_, AppState>, recipe_id: String) -> Result<Recipe, String> {
    state
        .catalog
        .recipe(&recipe_id)
        .cloned()
        .ok_or_else(|| format!("Рецепт не найден: {recipe_id}"))
}

#[tauri::command]
pub fn get_ingredients(
    state: State<'_, AppState>,
) -> indexmap::IndexMap<String, crate::models::Ingredient> {
    state.catalog.ingredients.clone()
}

#[tauri::command]
pub fn get_machines(state: State<'_, AppState>) -> indexmap::IndexMap<String, Machine> {
    state.catalog.machines.clone()
}

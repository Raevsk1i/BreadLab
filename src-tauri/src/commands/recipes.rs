use crate::error::AppError;
use crate::models::*;
use crate::services::{match_recipes, pantry_set_from_map, resolve_ingredient_id, SharedCatalog};
use serde::Deserialize;
use std::collections::HashMap;
use tauri::State;

#[tauri::command]
pub fn get_catalog(catalog: State<'_, SharedCatalog>) -> Result<Vec<CatalogEntry>, AppError> {
    Ok(catalog.catalog_entries())
}

#[tauri::command]
pub fn get_recipe(catalog: State<'_, SharedCatalog>, id: String) -> Result<Recipe, AppError> {
    catalog.get_recipe(&id).cloned()
}

#[tauri::command]
pub fn get_ingredients(
    catalog: State<'_, SharedCatalog>,
) -> Result<HashMap<String, Ingredient>, AppError> {
    Ok(catalog.ingredients.clone())
}

#[tauri::command]
pub fn get_machines(catalog: State<'_, SharedCatalog>) -> Result<HashMap<String, Machine>, AppError> {
    Ok(catalog.machines.clone())
}

#[tauri::command]
pub fn get_addins(
    catalog: State<'_, SharedCatalog>,
) -> Result<HashMap<String, TasteAddin>, AppError> {
    Ok(catalog.taste_addins.clone())
}

#[tauri::command]
pub fn get_meta(catalog: State<'_, SharedCatalog>) -> Result<Meta, AppError> {
    Ok(catalog.meta.clone())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchArgs {
    pub pantry: HashMap<String, bool>,
    #[serde(default = "default_true")]
    pub near_match: bool,
}

fn default_true() -> bool {
    true
}

#[tauri::command]
pub fn search_recipes(
    catalog: State<'_, SharedCatalog>,
    args: SearchArgs,
) -> Result<Vec<crate::services::MatchResult>, AppError> {
    let set = pantry_set_from_map(&args.pantry);
    Ok(match_recipes(&catalog, &set, args.near_match))
}

#[tauri::command]
pub fn resolve_ingredient(
    catalog: State<'_, SharedCatalog>,
    token: String,
) -> Result<Option<String>, AppError> {
    Ok(resolve_ingredient_id(&catalog, &token))
}

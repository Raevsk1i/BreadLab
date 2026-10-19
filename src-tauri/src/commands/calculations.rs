use std::collections::HashSet;

use serde::Deserialize;
use tauri::State;

use crate::models::CalibrationInput;
use crate::services::matcher::{build_shopping_list, match_recipes, SearchHit};
use crate::services::recipe_engine::{calculate, Calculation};
use crate::services::validation::{validate_machine_limits, Warning};
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculateRequest {
    pub recipe_id: String,
    pub machine_id: String,
    pub target_flour_g: f64,
    #[serde(default)]
    pub enabled_addins: Vec<String>,
    #[serde(default)]
    pub pantry: Vec<String>,
    #[serde(default)]
    pub calibration: Option<CalibrationInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    #[serde(default)]
    pub pantry: Vec<String>,
    #[serde(default = "default_near")]
    pub near_match: bool,
}

fn default_near() -> bool {
    true
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateRequest {
    pub recipe_id: String,
    pub machine_id: String,
    pub target_flour_g: f64,
    #[serde(default)]
    pub enabled_addins: Vec<String>,
}

#[tauri::command]
pub fn calculate_recipe(
    state: State<'_, AppState>,
    request: CalculateRequest,
) -> Result<Calculation, String> {
    calculate(
        &state.catalog,
        &request.recipe_id,
        &request.machine_id,
        request.target_flour_g,
        &request.enabled_addins,
        &request.pantry,
        request.calibration,
    )
    .map_err(Into::into)
}

#[tauri::command]
pub fn search_recipes(state: State<'_, AppState>, request: SearchRequest) -> Vec<SearchHit> {
    let pantry: HashSet<String> = request.pantry.into_iter().collect();
    match_recipes(&state.catalog, &pantry, request.near_match)
}

#[tauri::command(rename = "validate_machine_limits")]
pub fn validate_machine_limits_cmd(
    state: State<'_, AppState>,
    request: ValidateRequest,
) -> Result<Vec<Warning>, String> {
    let recipe = state
        .catalog
        .recipe(&request.recipe_id)
        .ok_or_else(|| format!("Рецепт не найден: {}", request.recipe_id))?;
    let flour = crate::services::calculator::clamp_flour(request.target_flour_g);
    let scaled = crate::services::calculator::scale_recipe(
        &state.catalog,
        recipe,
        flour,
        &request.enabled_addins,
    );
    Ok(validate_machine_limits(
        &state.catalog,
        &request.machine_id,
        recipe,
        &scaled,
    ))
}

#[tauri::command]
pub fn shopping_list(state: State<'_, AppState>, request: SearchRequest) -> Vec<String> {
    let pantry: HashSet<String> = request.pantry.into_iter().collect();
    let hits = match_recipes(&state.catalog, &pantry, request.near_match);
    build_shopping_list(&state.catalog, &hits)
}

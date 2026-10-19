use crate::error::AppError;
use crate::models::CalibrationEntry;
use crate::services::{
    calculate_recipe, enabled_addin_ids, validate_machine_limits, RecipeCalculation, SharedCatalog,
};
use serde::Deserialize;
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalculateArgs {
    pub recipe_id: String,
    pub machine_id: String,
    pub target_flour_g: f64,
    #[serde(default)]
    pub enabled_taste_addins: HashMap<String, bool>,
    #[serde(default)]
    pub calibration: Option<CalibrationEntry>,
}

#[tauri::command(rename = "calculate_recipe")]
pub fn calculate_recipe_cmd(
    catalog: State<'_, SharedCatalog>,
    args: CalculateArgs,
) -> Result<RecipeCalculation, AppError> {
    if !(100.0..=2000.0).contains(&args.target_flour_g) {
        return Err(AppError::Validation(
            "targetFlourG out of allowed range".into(),
        ));
    }
    let recipe = catalog.get_recipe(&args.recipe_id)?;
    if !catalog.machines.contains_key(&args.machine_id) {
        return Err(AppError::NotFound(format!("machine {}", args.machine_id)));
    }
    let addins = enabled_addin_ids(&args.enabled_taste_addins);
    Ok(calculate_recipe(
        &catalog,
        recipe,
        &args.machine_id,
        args.target_flour_g,
        &addins,
        args.calibration.as_ref(),
    ))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateArgs {
    pub recipe_id: String,
    pub machine_id: String,
    pub target_flour_g: f64,
    #[serde(default)]
    pub enabled_taste_addins: HashMap<String, bool>,
}

#[tauri::command(rename = "validate_machine_limits")]
pub fn validate_machine_limits_cmd(
    catalog: State<'_, SharedCatalog>,
    args: ValidateArgs,
) -> Result<Vec<crate::services::MachineWarning>, AppError> {
    let recipe = catalog.get_recipe(&args.recipe_id)?;
    let addins = enabled_addin_ids(&args.enabled_taste_addins);
    let scaled = crate::services::scale_recipe(&catalog, recipe, args.target_flour_g, &addins);
    Ok(validate_machine_limits(
        &catalog,
        &args.machine_id,
        recipe,
        &scaled,
    ))
}

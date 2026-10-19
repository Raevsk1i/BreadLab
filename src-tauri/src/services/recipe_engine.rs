use serde::Serialize;

use crate::error::AppError;
use crate::models::{CalibrationInput, Catalog};

use super::calculator::{
    calculate_dispenser_load, calculate_dough_mass, calculate_hydration, clamp_flour,
    estimate_finished_weight, estimate_proof_volume, format_grams, machine_key, placement_label,
    scale_recipe, stage_label, CalibrationBias, ScaledItem,
};
use super::steps::{cooking_steps, FilledStep};
use super::validation::{validate_machine_limits, Warning};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayRow {
    pub ingredient_id: String,
    pub name: String,
    pub grams: f64,
    pub grams_text: String,
    pub baker_pct: f64,
    pub baker_pct_text: String,
    pub role: String,
    pub stage: String,
    pub stage_label: String,
    pub placement_label: String,
    pub placement_panasonic: String,
    pub placement_redmond: String,
    pub detailed_role: String,
    pub increase_effect: String,
    pub decrease_effect: String,
    pub substitutions: Vec<String>,
    pub warnings: Vec<String>,
    pub is_addin: bool,
    pub effect: String,
    pub grams_range_text: Option<String>,
    pub pct_range: Option<[f64; 2]>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingRow {
    pub id: String,
    pub name: String,
    pub grams: f64,
    pub grams_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Calculation {
    pub recipe_id: String,
    pub machine_id: String,
    pub machine_key: String,
    pub target_flour_g: f64,
    pub base_flour_g: f64,
    pub factor: f64,
    pub hydration_pct: f64,
    pub dough_mass_g: f64,
    pub finished_min_g: f64,
    pub finished_max_g: f64,
    pub uncalibrated_mid_g: f64,
    pub initial_ml: f64,
    pub proofed_min_ml: f64,
    pub proofed_max_ml: f64,
    pub recommended_bowl_ml: f64,
    pub dispenser_g: f64,
    pub fill_pct: Option<f64>,
    pub fill_level: Option<String>,
    pub physics_confidence: String,
    pub headroom_factor: f64,
    pub bake_loss_min_pct: f64,
    pub bake_loss_max_pct: f64,
    pub calibrated: bool,
    pub warnings: Vec<Warning>,
    pub profile_warnings: Vec<String>,
    pub items: Vec<DisplayRow>,
    pub shopping: Vec<ShoppingRow>,
    pub cook_steps: Vec<FilledStep>,
    pub addin_previews: Vec<AddinPreview>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddinPreview {
    pub id: String,
    pub name: String,
    pub role: String,
    pub grams_text: String,
    pub min_text: String,
    pub max_text: String,
    pub pct_range: [f64; 2],
    pub warnings: Vec<String>,
}

pub fn calculate(
    catalog: &Catalog,
    recipe_id: &str,
    machine_id: &str,
    target_flour_g: f64,
    enabled_addins: &[String],
    pantry: &[String],
    calibration: Option<CalibrationInput>,
) -> Result<Calculation, AppError> {
    let recipe = catalog
        .recipe(recipe_id)
        .ok_or_else(|| AppError::RecipeNotFound(recipe_id.to_string()))?;
    if !catalog.machines.contains_key(machine_id) {
        return Err(AppError::Invalid(format!(
            "неизвестная машина {machine_id}"
        )));
    }
    let flour = clamp_flour(target_flour_g);
    let scaled = scale_recipe(catalog, recipe, flour, enabled_addins);
    let hydration = calculate_hydration(catalog, &scaled);
    let dough = calculate_dough_mass(&scaled);
    let plain = estimate_finished_weight(dough, recipe.physics.bake_loss_range, None);
    let uncalibrated_mid = (plain.min + plain.max) / 2.0;
    let bias = calibration.and_then(|item| {
        if item.actual_finished_weight_g.is_finite()
            && item.predicted_mid.is_finite()
            && item.actual_finished_weight_g != 0.0
            && item.predicted_mid != 0.0
        {
            Some(CalibrationBias {
                actual_finished_weight_g: item.actual_finished_weight_g,
                predicted_mid: item.predicted_mid,
            })
        } else {
            None
        }
    });
    let finished = estimate_finished_weight(dough, recipe.physics.bake_loss_range, bias);
    let volume = estimate_proof_volume(dough, recipe);
    let dispenser = calculate_dispenser_load(&scaled);
    let warnings = validate_machine_limits(catalog, machine_id, recipe, &scaled);
    let key = machine_key(machine_id);
    let (fill_pct, fill_level) = if machine_id == "redmond_rmc_m92s" {
        let bowl = catalog
            .machines
            .get(machine_id)
            .and_then(|machine| machine.bowl_volume_ml)
            .unwrap_or(5000.0);
        let pct = if bowl > 0.0 {
            (volume.proofed_max_ml / bowl * 100.0).min(100.0)
        } else {
            0.0
        };
        let level = if pct > 90.0 {
            "danger"
        } else if pct > 70.0 {
            "warn"
        } else {
            "ok"
        };
        (Some(pct), Some(level.to_string()))
    } else {
        (None, None)
    };
    let profile_warnings = if key == "redmond" {
        recipe.machine_profiles.redmond.warnings.clone()
    } else {
        recipe.machine_profiles.panasonic.warnings.clone()
    };
    let pantry_set: std::collections::HashSet<&str> = pantry.iter().map(String::as_str).collect();
    let mut shopping: Vec<ShoppingRow> = scaled
        .items
        .iter()
        .filter(|row| {
            !row.optional && !super::matcher::is_always_available(catalog, &row.ingredient_id)
        })
        .filter(|row| !pantry_set.contains(row.ingredient_id.as_str()))
        .map(|row| ShoppingRow {
            id: row.ingredient_id.clone(),
            name: row.name.clone(),
            grams: row.grams,
            grams_text: format_grams(catalog, &row.ingredient_id, row.grams),
        })
        .collect();
    shopping.sort_by(|a, b| super::matcher::ru_cmp(&a.name, &b.name));
    let headroom = if recipe.physics.headroom_factor == 0.0 {
        1.25
    } else {
        recipe.physics.headroom_factor
    };
    Ok(Calculation {
        recipe_id: recipe.id.clone(),
        machine_id: machine_id.to_string(),
        machine_key: key.to_string(),
        target_flour_g: flour,
        base_flour_g: recipe.base_total_flour_g,
        factor: scaled.factor,
        hydration_pct: hydration,
        dough_mass_g: dough,
        finished_min_g: finished.min,
        finished_max_g: finished.max,
        uncalibrated_mid_g: uncalibrated_mid,
        initial_ml: volume.initial_ml,
        proofed_min_ml: volume.proofed_min_ml,
        proofed_max_ml: volume.proofed_max_ml,
        recommended_bowl_ml: volume.recommended_bowl_ml,
        dispenser_g: dispenser,
        fill_pct,
        fill_level,
        physics_confidence: recipe.physics.confidence.clone(),
        headroom_factor: headroom,
        bake_loss_min_pct: recipe.physics.bake_loss_range[0] * 100.0,
        bake_loss_max_pct: recipe.physics.bake_loss_range[1] * 100.0,
        calibrated: bias.is_some(),
        warnings,
        profile_warnings,
        items: scaled
            .items
            .iter()
            .chain(scaled.addins.iter())
            .map(|row| display_row(catalog, key, row))
            .collect(),
        shopping,
        cook_steps: cooking_steps(catalog, recipe, machine_id, &scaled),
        addin_previews: addin_previews(catalog, recipe, flour),
    })
}

fn addin_previews(
    catalog: &Catalog,
    recipe: &crate::models::Recipe,
    flour: f64,
) -> Vec<AddinPreview> {
    recipe
        .taste_addin_ids
        .iter()
        .filter_map(|id| {
            let addin = catalog.addins.get(id)?;
            let grams = flour * addin.default_pct / 100.0;
            let min_g = flour * addin.suggested_baker_pct_range[0] / 100.0;
            let max_g = flour * addin.suggested_baker_pct_range[1] / 100.0;
            Some(AddinPreview {
                id: addin.id.clone(),
                name: addin.name.clone(),
                role: addin.role.clone(),
                grams_text: format_grams(catalog, &addin.ingredient_id, grams),
                min_text: format_grams(catalog, &addin.ingredient_id, min_g),
                max_text: format_grams(catalog, &addin.ingredient_id, max_g),
                pct_range: addin.suggested_baker_pct_range,
                warnings: addin.warnings.clone(),
            })
        })
        .collect()
}

fn display_row(catalog: &Catalog, machine_key: &str, row: &ScaledItem) -> DisplayRow {
    let code = if machine_key == "redmond" {
        row.placement_redmond.as_str()
    } else {
        row.placement_panasonic.as_str()
    };
    let grams_range_text = row.grams_range.map(|range| {
        format!(
            "{}–{}",
            format_grams(catalog, &row.ingredient_id, range[0]),
            format_grams(catalog, &row.ingredient_id, range[1])
        )
    });
    DisplayRow {
        ingredient_id: row.ingredient_id.clone(),
        name: if row.is_addin {
            format!("{} (по вкусу)", row.name)
        } else {
            row.name.clone()
        },
        grams: row.grams,
        grams_text: format_grams(catalog, &row.ingredient_id, row.grams),
        baker_pct: row.baker_pct,
        baker_pct_text: format!("{:.1}", row.baker_pct),
        role: if row.role.is_empty() {
            "—".into()
        } else {
            row.role.clone()
        },
        stage: row.stage.clone(),
        stage_label: stage_label(&row.stage),
        placement_label: placement_label(code, machine_key),
        placement_panasonic: row.placement_panasonic.clone(),
        placement_redmond: row.placement_redmond.clone(),
        detailed_role: row.detailed_role.clone(),
        increase_effect: row.increase_effect.clone(),
        decrease_effect: row.decrease_effect.clone(),
        substitutions: row.substitutions.clone(),
        warnings: row.warnings.clone(),
        is_addin: row.is_addin,
        effect: row.effect.clone(),
        grams_range_text,
        pct_range: row.pct_range,
    }
}

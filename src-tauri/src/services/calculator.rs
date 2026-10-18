use crate::models::*;
use crate::services::catalog::Catalog;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaledItem {
    pub ingredient_id: String,
    pub grams: f64,
    pub baker_pct: f64,
    pub is_flour: bool,
    pub stage: String,
    pub role: String,
    pub detailed_role: String,
    pub placement: Placement,
    pub scalable: bool,
    pub hydration_contributor: bool,
    pub increase_effect: String,
    pub decrease_effect: String,
    pub substitutions: Vec<String>,
    pub unit: String,
    pub optional: bool,
    pub scaled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub is_addin: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub addin_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pct_range: Option<[f64; 2]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub grams_range: Option<[f64; 2]>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warnings: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dry: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaledRecipe {
    pub target_flour_g: f64,
    pub factor: f64,
    pub items: Vec<ScaledItem>,
    pub addins: Vec<ScaledItem>,
    pub all: Vec<ScaledItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinishedWeight {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofVolume {
    pub initial_ml: f64,
    pub proofed_min_ml: f64,
    pub proofed_max_ml: f64,
    pub recommended_bowl_ml: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineWarning {
    pub level: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeCalculation {
    pub scaled: ScaledRecipe,
    pub hydration: f64,
    pub dough_mass: f64,
    pub finished: FinishedWeight,
    pub volume: ProofVolume,
    pub dispenser_load: f64,
    pub warnings: Vec<MachineWarning>,
}

pub fn get_total_flour_g(recipe: &Recipe) -> f64 {
    let sum: f64 = recipe.flour_components.iter().map(|f| f.grams).sum();
    if sum > 0.0 {
        sum
    } else {
        recipe.base_total_flour_g
    }
}

pub fn round_present(catalog: &Catalog, ingredient_id: &str, value: f64) -> f64 {
    let fine = matches!(
        ingredient_id,
        "salt"
            | "yeast"
            | "coriander"
            | "caraway"
            | "garlic_dry"
            | "vanilla"
            | "soda"
            | "rosemary"
    );
    let fine_addin = catalog
        .taste_addins
        .get(ingredient_id)
        .map(|a| a.suggested_baker_pct_range[1] < 2.0)
        .unwrap_or(false);
    if fine || fine_addin {
        (value * 10.0).round() / 10.0
    } else {
        value.round()
    }
}

pub fn format_grams(catalog: &Catalog, ingredient_id: &str, value: f64) -> String {
    let r = round_present(catalog, ingredient_id, value);
    if (r - r.round()).abs() < 1e-9 {
        format!("{}", r.round() as i64)
    } else {
        format!("{r:.1}")
    }
}

pub fn scale_recipe(
    catalog: &Catalog,
    recipe: &Recipe,
    target_flour_g: f64,
    enabled_addins: &[String],
) -> ScaledRecipe {
    let base = get_total_flour_g(recipe);
    let factor = target_flour_g / base;
    let items: Vec<ScaledItem> = recipe
        .ingredients
        .iter()
        .map(|row| {
            let grams = if !row.scalable {
                row.grams
            } else {
                row.grams * factor
            };
            ScaledItem {
                ingredient_id: row.ingredient_id.clone(),
                grams,
                baker_pct: (grams / target_flour_g) * 100.0,
                is_flour: row.is_flour,
                stage: row.stage.clone(),
                role: row.role.clone(),
                detailed_role: row.detailed_role.clone(),
                placement: row.placement.clone(),
                scalable: row.scalable,
                hydration_contributor: row.hydration_contributor,
                increase_effect: row.increase_effect.clone(),
                decrease_effect: row.decrease_effect.clone(),
                substitutions: row.substitutions.clone(),
                unit: row.unit.clone(),
                optional: row.optional,
                scaled: true,
                name: catalog
                    .ingredients
                    .get(&row.ingredient_id)
                    .map(|i| i.name.clone()),
                is_addin: false,
                addin_id: None,
                pct_range: None,
                grams_range: None,
                effect: None,
                warnings: None,
                dry: None,
            }
        })
        .collect();

    let mut addins = Vec::new();
    for aid in enabled_addins {
        let Some(a) = catalog.taste_addins.get(aid) else {
            continue;
        };
        let pct = a.default_pct;
        let grams = target_flour_g * (pct / 100.0);
        addins.push(ScaledItem {
            ingredient_id: a.ingredient_id.clone(),
            grams,
            baker_pct: pct,
            is_flour: false,
            stage: "addins".to_string(),
            role: a.role.clone(),
            detailed_role: a.effect.clone(),
            placement: a.placement.clone(),
            scalable: true,
            hydration_contributor: false,
            increase_effect: String::new(),
            decrease_effect: String::new(),
            substitutions: Vec::new(),
            unit: "g".to_string(),
            optional: true,
            scaled: true,
            name: Some(a.name.clone()),
            is_addin: true,
            addin_id: Some(aid.clone()),
            pct_range: Some(a.suggested_baker_pct_range),
            grams_range: Some([
                target_flour_g * a.suggested_baker_pct_range[0] / 100.0,
                target_flour_g * a.suggested_baker_pct_range[1] / 100.0,
            ]),
            effect: Some(a.effect.clone()),
            warnings: Some(a.warnings.clone()),
            dry: Some(a.dry),
        });
    }

    let mut all = items.clone();
    all.extend(addins.clone());

    ScaledRecipe {
        target_flour_g,
        factor,
        items,
        addins,
        all,
    }
}

pub fn calculate_hydration(catalog: &Catalog, scaled: &ScaledRecipe) -> f64 {
    let mut water = 0.0;
    for row in &scaled.items {
        let meta = catalog.ingredients.get(&row.ingredient_id);
        let frac = meta.map(|m| m.hydration_fraction).unwrap_or(0.0);
        if row.hydration_contributor || frac > 0.0 {
            if meta.map(|m| m.category.as_str()) == Some("fat") && frac == 0.0 {
                continue;
            }
            water += row.grams * frac;
        }
    }
    (water / scaled.target_flour_g) * 100.0
}

pub fn calculate_dough_mass(scaled: &ScaledRecipe) -> f64 {
    scaled.all.iter().map(|r| r.grams).sum()
}

pub fn estimate_finished_weight(
    dough_mass: f64,
    bake_loss_range: [f64; 2],
    calibration: Option<&CalibrationEntry>,
) -> FinishedWeight {
    let min_l = bake_loss_range[0];
    let max_l = bake_loss_range[1];
    let mut finished_min = dough_mass * (1.0 - max_l);
    let mut finished_max = dough_mass * (1.0 - min_l);
    if let Some(cal) = calibration {
        if cal.actual_finished_weight_g > 0.0 && cal.predicted_mid > 0.0 {
            let bias = cal.actual_finished_weight_g / cal.predicted_mid;
            finished_min *= bias;
            finished_max *= bias;
        }
    }
    FinishedWeight {
        min: finished_min,
        max: finished_max,
    }
}

pub fn estimate_proof_volume(dough_mass: f64, physics: &Physics) -> ProofVolume {
    let dens = if physics.dough_density_g_per_ml > 0.0 {
        physics.dough_density_g_per_ml
    } else {
        1.05
    };
    let initial = dough_mass / dens;
    let p_min = initial * physics.proof_expansion_range[0];
    let p_max = initial * physics.proof_expansion_range[1];
    let headroom = if physics.headroom_factor > 0.0 {
        physics.headroom_factor
    } else {
        1.25
    };
    ProofVolume {
        initial_ml: initial,
        proofed_min_ml: p_min,
        proofed_max_ml: p_max,
        recommended_bowl_ml: p_max * headroom,
    }
}

pub fn calculate_dispenser_load(scaled: &ScaledRecipe) -> f64 {
    scaled
        .all
        .iter()
        .filter(|row| row.placement.panasonic == "raisinNutDispenser")
        .map(|row| row.grams)
        .sum()
}

pub fn enabled_addin_ids(map: &HashMap<String, bool>) -> Vec<String> {
    let mut ids: Vec<String> = map
        .iter()
        .filter(|(_, v)| **v)
        .map(|(k, _)| k.clone())
        .collect();
    ids.sort();
    ids
}

pub fn calculate_recipe(
    catalog: &Catalog,
    recipe: &Recipe,
    machine_id: &str,
    target_flour_g: f64,
    enabled_addins: &[String],
    calibration: Option<&CalibrationEntry>,
) -> RecipeCalculation {
    let scaled = scale_recipe(catalog, recipe, target_flour_g, enabled_addins);
    let hydration = calculate_hydration(catalog, &scaled);
    let dough_mass = calculate_dough_mass(&scaled);
    let finished =
        estimate_finished_weight(dough_mass, recipe.physics.bake_loss_range, calibration);
    let volume = estimate_proof_volume(dough_mass, &recipe.physics);
    let dispenser_load = calculate_dispenser_load(&scaled);
    let warnings =
        crate::services::validation::validate_machine_limits(catalog, machine_id, recipe, &scaled);
    RecipeCalculation {
        scaled,
        hydration,
        dough_mass,
        finished,
        volume,
        dispenser_load,
        warnings,
    }
}

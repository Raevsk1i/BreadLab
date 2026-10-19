use crate::models::{Catalog, IngredientRow, Recipe, TasteAddin};

const FINE_IDS: [&str; 8] = [
    "salt",
    "yeast",
    "coriander",
    "caraway",
    "garlic_dry",
    "vanilla",
    "soda",
    "rosemary",
];

#[derive(Debug, Clone)]
pub struct ScaledItem {
    pub ingredient_id: String,
    pub grams: f64,
    pub baker_pct: f64,
    pub hydration_contributor: bool,
    pub placement_panasonic: String,
    pub placement_redmond: String,
    pub is_addin: bool,
    pub addin_id: Option<String>,
    pub name: String,
    pub role: String,
    pub stage: String,
    pub detailed_role: String,
    pub increase_effect: String,
    pub decrease_effect: String,
    pub substitutions: Vec<String>,
    pub warnings: Vec<String>,
    pub effect: String,
    pub grams_range: Option<[f64; 2]>,
    pub pct_range: Option<[f64; 2]>,
    pub optional: bool,
}

#[derive(Debug, Clone)]
pub struct ScaledRecipe {
    pub target_flour_g: f64,
    pub factor: f64,
    pub items: Vec<ScaledItem>,
    pub addins: Vec<ScaledItem>,
}

impl ScaledRecipe {
    pub fn all(&self) -> impl Iterator<Item = &ScaledItem> {
        self.items.iter().chain(self.addins.iter())
    }
}

#[derive(Debug, Clone, Copy)]
pub struct WeightRange {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct ProofVolume {
    pub initial_ml: f64,
    pub proofed_min_ml: f64,
    pub proofed_max_ml: f64,
    pub recommended_bowl_ml: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct CalibrationBias {
    pub actual_finished_weight_g: f64,
    pub predicted_mid: f64,
}

pub fn total_flour_g(recipe: &Recipe) -> f64 {
    recipe.flour_components.iter().map(|f| f.grams).sum()
}

pub fn round_present(catalog: &Catalog, ingredient_id: &str, value: f64) -> f64 {
    let fine = FINE_IDS.contains(&ingredient_id)
        || catalog
            .addins
            .get(ingredient_id)
            .is_some_and(|addin| addin.suggested_baker_pct_range[1] < 2.0);
    if fine {
        (value * 10.0).round() / 10.0
    } else {
        value.round()
    }
}

pub fn format_grams(catalog: &Catalog, ingredient_id: &str, value: f64) -> String {
    let rounded = round_present(catalog, ingredient_id, value);
    if (rounded - rounded.round()).abs() < 1e-9 {
        format!("{}", rounded.round() as i64)
    } else {
        format!("{rounded:.1}")
    }
}

pub fn js_number(n: f64) -> String {
    if n.is_finite() && n.fract() == 0.0 && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        let text = format!("{n}");
        text
    }
}

pub fn scale_recipe(
    catalog: &Catalog,
    recipe: &Recipe,
    target_flour_g: f64,
    enabled_addins: &[String],
) -> ScaledRecipe {
    let summed = total_flour_g(recipe);
    let base = if summed > 0.0 {
        summed
    } else {
        recipe.base_total_flour_g
    };
    let factor = if base == 0.0 {
        0.0
    } else {
        target_flour_g / base
    };
    let items = recipe
        .ingredients
        .iter()
        .map(|row| scale_row(catalog, row, factor, target_flour_g))
        .collect();
    let mut addins = Vec::new();
    for aid in enabled_addins {
        if let Some(addin) = catalog.addins.get(aid) {
            addins.push(scale_addin(addin, target_flour_g));
        }
    }
    ScaledRecipe {
        target_flour_g,
        factor,
        items,
        addins,
    }
}

fn scale_row(
    catalog: &Catalog,
    row: &IngredientRow,
    factor: f64,
    target_flour_g: f64,
) -> ScaledItem {
    let grams = if row.scalable {
        row.grams * factor
    } else {
        row.grams
    };
    let baker_pct = if target_flour_g == 0.0 {
        0.0
    } else {
        grams / target_flour_g * 100.0
    };
    let meta = catalog.ingredients.get(&row.ingredient_id);
    let (pan, red) = placement_of(row);
    ScaledItem {
        ingredient_id: row.ingredient_id.clone(),
        grams,
        baker_pct,
        hydration_contributor: row.hydration_contributor,
        placement_panasonic: pan,
        placement_redmond: red,
        is_addin: false,
        addin_id: None,
        name: meta
            .map(|m| m.name.clone())
            .unwrap_or_else(|| row.ingredient_id.clone()),
        role: row.role.clone(),
        stage: row.stage.clone(),
        detailed_role: row.detailed_role.clone(),
        increase_effect: row.increase_effect.clone(),
        decrease_effect: row.decrease_effect.clone(),
        substitutions: row.substitutions.clone(),
        warnings: Vec::new(),
        effect: String::new(),
        grams_range: None,
        pct_range: None,
        optional: row.optional,
    }
}

fn placement_of(row: &IngredientRow) -> (String, String) {
    match &row.placement {
        Some(place) => (place.panasonic.clone(), place.redmond.clone()),
        None => (String::new(), String::new()),
    }
}

fn scale_addin(addin: &TasteAddin, target_flour_g: f64) -> ScaledItem {
    let pct = addin.default_pct;
    let grams = target_flour_g * (pct / 100.0);
    ScaledItem {
        ingredient_id: addin.ingredient_id.clone(),
        grams,
        baker_pct: pct,
        hydration_contributor: false,
        placement_panasonic: addin.placement.panasonic.clone(),
        placement_redmond: addin.placement.redmond.clone(),
        is_addin: true,
        addin_id: Some(addin.id.clone()),
        name: addin.name.clone(),
        role: addin.role.clone(),
        stage: String::new(),
        detailed_role: String::new(),
        increase_effect: String::new(),
        decrease_effect: String::new(),
        substitutions: Vec::new(),
        warnings: addin.warnings.clone(),
        effect: addin.effect.clone(),
        grams_range: Some([
            target_flour_g * addin.suggested_baker_pct_range[0] / 100.0,
            target_flour_g * addin.suggested_baker_pct_range[1] / 100.0,
        ]),
        pct_range: Some(addin.suggested_baker_pct_range),
        optional: false,
    }
}

pub fn calculate_hydration(catalog: &Catalog, scaled: &ScaledRecipe) -> f64 {
    if scaled.target_flour_g == 0.0 {
        return 0.0;
    }
    let mut water = 0.0;
    for row in &scaled.items {
        let meta = catalog.ingredients.get(&row.ingredient_id);
        let frac = meta.map(|m| m.hydration_fraction).unwrap_or(0.0);
        if row.hydration_contributor || frac > 0.0 {
            if meta.is_some_and(|m| m.category == "fat" && frac == 0.0) {
                continue;
            }
            water += row.grams * frac;
        }
    }
    water / scaled.target_flour_g * 100.0
}

pub fn calculate_dough_mass(scaled: &ScaledRecipe) -> f64 {
    scaled.all().map(|row| row.grams).sum()
}

pub fn estimate_finished_weight(
    dough_mass: f64,
    bake_loss_range: [f64; 2],
    calibration: Option<CalibrationBias>,
) -> WeightRange {
    let min_l = bake_loss_range[0];
    let max_l = bake_loss_range[1];
    let mut finished_min = dough_mass * (1.0 - max_l);
    let mut finished_max = dough_mass * (1.0 - min_l);
    if let Some(calibration) = calibration {
        if calibration.actual_finished_weight_g != 0.0 && calibration.predicted_mid != 0.0 {
            let bias = calibration.actual_finished_weight_g / calibration.predicted_mid;
            finished_min *= bias;
            finished_max *= bias;
        }
    }
    WeightRange {
        min: finished_min,
        max: finished_max,
    }
}

pub fn estimate_proof_volume(dough_mass: f64, recipe: &Recipe) -> ProofVolume {
    let dens = if recipe.physics.dough_density_g_per_ml == 0.0 {
        1.05
    } else {
        recipe.physics.dough_density_g_per_ml
    };
    let initial = dough_mass / dens;
    let p_min = initial * recipe.physics.proof_expansion_range[0];
    let p_max = initial * recipe.physics.proof_expansion_range[1];
    let headroom = if recipe.physics.headroom_factor == 0.0 {
        1.25
    } else {
        recipe.physics.headroom_factor
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
        .all()
        .filter(|row| row.placement_panasonic == "raisinNutDispenser")
        .map(|row| row.grams)
        .sum()
}

pub fn placement_label(code: &str, machine_key: &str) -> String {
    if machine_key == "redmond" {
        match code {
            "bowl" => "В чашу".to_string(),
            "manual" => "Вручную при замесе".to_string(),
            "" => "Вручную".to_string(),
            other => other.to_string(),
        }
    } else {
        match code {
            "pan" => "В чашу".to_string(),
            "yeastDispenser" => "Диспенсер дрожжей".to_string(),
            "raisinNutDispenser" => "Диспенсер добавок".to_string(),
            "manualAdd" => "Вручную / по сигналу".to_string(),
            "notApplicable" => "—".to_string(),
            "" => "—".to_string(),
            other => other.to_string(),
        }
    }
}

pub fn stage_label(stage: &str) -> String {
    match stage {
        "preferment" => "Опара".to_string(),
        "scald" => "Заварка".to_string(),
        "mainMix" => "Основной замес".to_string(),
        "dispenser" => "Диспенсер".to_string(),
        "manual" => "Вручную".to_string(),
        "topping" => "Посыпка".to_string(),
        "" => "—".to_string(),
        other => other.to_string(),
    }
}

pub fn machine_key(machine_id: &str) -> &'static str {
    if machine_id == "redmond_rmc_m92s" {
        "redmond"
    } else {
        "panasonic"
    }
}

pub fn clamp_flour(value: f64) -> f64 {
    if !value.is_finite() {
        return 450.0;
    }
    value.round().clamp(250.0, 650.0)
}

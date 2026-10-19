use serde::{Deserialize, Serialize};

use crate::models::{Catalog, Recipe};

use super::calculator::{
    calculate_dispenser_load, calculate_dough_mass, estimate_proof_volume, format_grams, js_number,
    ScaledRecipe,
};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Warning {
    pub level: String,
    pub code: String,
    pub message: String,
}

pub fn validate_machine_limits(
    catalog: &Catalog,
    machine_id: &str,
    recipe: &Recipe,
    scaled: &ScaledRecipe,
) -> Vec<Warning> {
    let Some(machine) = catalog.machines.get(machine_id) else {
        return Vec::new();
    };
    let mut warnings = Vec::new();
    let flour = scaled.target_flour_g;
    let yeast_g = scaled
        .items
        .iter()
        .find(|row| row.ingredient_id == "yeast")
        .map(|row| row.grams)
        .unwrap_or(0.0);

    if machine_id == "panasonic_sd_yr2540hts" {
        if let Some(constraints) = &machine.constraints {
            let mode = if recipe.machine_profiles.panasonic.program_no == "13" {
                "bake"
            } else {
                "bread"
            };
            if mode == "bread" {
                let bf = constraints.bread_flour;
                if flour < bf[0] {
                    warnings.push(Warning {
                        level: "warn".into(),
                        code: "flour_low".into(),
                        message: format!(
                            "Мука {} г ниже рекомендованного для хлеба ({}–{} г).",
                            js_round_i(flour),
                            js_number(bf[0]),
                            js_number(bf[1])
                        ),
                    });
                }
                if flour > bf[1] {
                    warnings.push(Warning {
                        level: "danger".into(),
                        code: "flour_high".into(),
                        message: format!(
                            "Мука {} г выше лимита хлеба Panasonic ({} г).",
                            js_round_i(flour),
                            js_number(bf[1])
                        ),
                    });
                }
            } else {
                let df = constraints.dough_flour;
                if flour < df[0] {
                    warnings.push(Warning {
                        level: "warn".into(),
                        code: "flour_low_dough".into(),
                        message: format!(
                            "Мука ниже диапазона для теста ({}–{} г).",
                            js_number(df[0]),
                            js_number(df[1])
                        ),
                    });
                }
                if flour > df[1] {
                    warnings.push(Warning {
                        level: "danger".into(),
                        code: "flour_high_dough".into(),
                        message: format!("Мука выше лимита для теста ({} г).", js_number(df[1])),
                    });
                }
            }
            let y = constraints.yeast_g;
            if yeast_g > 0.0 && yeast_g < y[0] {
                warnings.push(Warning {
                    level: "warn".into(),
                    code: "yeast_low".into(),
                    message: format!(
                        "Дрожжи {} г ниже обычного диапазона ({}–{} г).",
                        format_grams(catalog, "yeast", yeast_g),
                        js_number(y[0]),
                        js_number(y[1])
                    ),
                });
            }
            if yeast_g > y[1] {
                warnings.push(Warning {
                    level: "danger".into(),
                    code: "yeast_high".into(),
                    message: format!(
                        "Дрожжи {} г выше лимита ({} г).",
                        format_grams(catalog, "yeast", yeast_g),
                        js_number(y[1])
                    ),
                });
            }
            let disp = calculate_dispenser_load(scaled);
            if disp > constraints.dispenser_addins_max_g {
                warnings.push(Warning {
                    level: "danger".into(),
                    code: "dispenser".into(),
                    message: format!(
                        "Добавки в диспенсер ≈{} г > лимита {} г. Уменьшите добавки или кладите часть вручную.",
                        js_round_i(disp),
                        js_number(constraints.dispenser_addins_max_g)
                    ),
                });
            } else if disp > constraints.dispenser_addins_max_g * 0.9 {
                warnings.push(Warning {
                    level: "warn".into(),
                    code: "dispenser_near".into(),
                    message: format!(
                        "Добавки в диспенсер ≈{} г — близко к лимиту 150 г.",
                        js_round_i(disp)
                    ),
                });
            }
        }
    }

    if machine_id == "redmond_rmc_m92s" {
        if let Some(bowl) = machine.bowl_volume_ml {
            if bowl > 0.0 {
                let vol = estimate_proof_volume(calculate_dough_mass(scaled), recipe);
                let fill = vol.proofed_max_ml / bowl;
                if fill > 0.9 {
                    warnings.push(Warning {
                        level: "danger".into(),
                        code: "bowl_red".into(),
                        message: "Риск побега теста: расчётный пик >90% объёма чаши (~5 л). Уменьшите муку.".into(),
                    });
                } else if fill > 0.7 {
                    warnings.push(Warning {
                        level: "warn".into(),
                        code: "bowl_yellow".into(),
                        message:
                            "Заполнение чаши впритык (70–90% расчётного пика). Следите за подъёмом."
                                .into(),
                    });
                } else {
                    warnings.push(Warning {
                        level: "ok".into(),
                        code: "bowl_green".into(),
                        message: "Комфортный запас объёма чаши REDMOND.".into(),
                    });
                }
            }
        }
    }
    warnings
}

fn js_round_i(value: f64) -> i64 {
    value.round() as i64
}

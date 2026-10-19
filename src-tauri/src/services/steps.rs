use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::models::{Catalog, Recipe};

use super::calculator::{format_grams, machine_key, ScaledRecipe};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilledStep {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub is_addin: bool,
}

pub fn cooking_steps(
    catalog: &Catalog,
    recipe: &Recipe,
    machine_id: &str,
    scaled: &ScaledRecipe,
) -> Vec<FilledStep> {
    let key = machine_key(machine_id);
    let base = match key {
        "redmond" => &recipe.machine_profiles.redmond.steps,
        _ => &recipe.machine_profiles.panasonic.steps,
    };
    let addins = addin_steps(catalog, key, scaled);
    let combined: Vec<(String, String, bool)> = if addins.is_empty() {
        base.iter()
            .map(|step| (step.id.clone(), step.text.clone(), false))
            .collect()
    } else {
        let insert_at = if key == "panasonic" {
            3.min(base.len())
        } else {
            3.min(2.max(base.len().saturating_sub(3)))
        };
        let mut rows = Vec::new();
        for step in base.iter().take(insert_at) {
            rows.push((step.id.clone(), step.text.clone(), false));
        }
        rows.extend(addins);
        for step in base.iter().skip(insert_at) {
            rows.push((step.id.clone(), step.text.clone(), false));
        }
        rows
    };
    let map = gram_map(catalog, scaled);
    combined
        .into_iter()
        .map(|(id, text, is_addin)| FilledStep {
            id,
            text: fill_step_text(&text, &map),
            is_addin,
        })
        .collect()
}

fn addin_steps(
    catalog: &Catalog,
    machine_key: &str,
    scaled: &ScaledRecipe,
) -> Vec<(String, String, bool)> {
    let mut steps = Vec::new();
    for row in &scaled.addins {
        let Some(addin_id) = row.addin_id.as_deref() else {
            continue;
        };
        let Some(addin) = catalog.addins.get(addin_id) else {
            continue;
        };
        let grams = format!("{} г", format_grams(catalog, &row.ingredient_id, row.grams));
        let place = if machine_key == "redmond" {
            if addin.placement.redmond.is_empty() {
                "manual"
            } else {
                addin.placement.redmond.as_str()
            }
        } else if addin.placement.panasonic.is_empty() {
            "manual"
        } else {
            addin.placement.panasonic.as_str()
        };
        let prep = if !addin.prep.is_empty() {
            addin.prep.as_str()
        } else {
            addin.effect.as_str()
        };
        let when_where = if machine_key == "panasonic" {
            if place == "raisinNutDispenser" {
                "Перед запуском программы засыпьте в диспенсер добавок (не в дрожжевой). Автомат внесёт их ближе к концу замеса."
            } else if place == "pan" {
                if !addin.dry {
                    "Положите прямо в чашу с основными ингредиентами (влажные/плавящиеся добавки — не в диспенсер)."
                } else {
                    "Добавьте в чашу вместе с сухими ингредиентами до старта программы."
                }
            } else {
                "Внесите вручную по сигналу программы или в конце замеса."
            }
        } else if place == "pan" || !addin.dry {
            if !addin.dry {
                "Вмешайте в тесто в самом конце замеса, равномерно распределяя, затем уложите в чашу."
            } else {
                "Добавьте к сухим ингредиентам при замесе или вмешайте в конце замеса перед расстойкой."
            }
        } else {
            "Вмешайте вручную в конце замеса (последние 1–2 минуты), затем сформируйте шар и уложите в чашу."
        };
        let mut text = format!("Добавка по вкусу — {} ({}). ", addin.name, grams);
        if !prep.is_empty() {
            text.push_str("Подготовка: ");
            text.push_str(prep);
            text.push(' ');
        }
        text.push_str(when_where);
        if !addin.warnings.is_empty() {
            text.push_str(" Важно: ");
            text.push_str(&addin.warnings.join(" "));
        }
        steps.push((format!("addin-{addin_id}"), text, true));
    }
    steps
}

fn gram_map(catalog: &Catalog, scaled: &ScaledRecipe) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for row in scaled.all() {
        map.insert(
            row.ingredient_id.clone(),
            format!("{} г", format_grams(catalog, &row.ingredient_id, row.grams)),
        );
    }
    map.insert(
        "flour_total".to_string(),
        format!("{} г", scaled.target_flour_g.round() as i64),
    );
    map
}

pub fn fill_step_text(text: &str, map: &HashMap<String, String>) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '{' {
            if let Some(rel) = chars[i + 1..].iter().position(|ch| *ch == '}') {
                let key: String = chars[i + 1..i + 1 + rel].iter().collect();
                let valid = !key.is_empty()
                    && key
                        .chars()
                        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_');
                if valid {
                    if let Some(value) = map.get(&key) {
                        out.push_str(value);
                    } else {
                        out.push('{');
                        out.push_str(&key);
                        out.push('}');
                    }
                    i += rel + 2;
                    continue;
                }
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

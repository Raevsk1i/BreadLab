use crate::services::catalog::Catalog;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchResult {
    pub recipe_id: String,
    pub machine_key: String,
    pub machine_id: String,
    pub status: String,
    pub missing: Vec<String>,
    pub missing_names: Vec<String>,
    pub score: i32,
    pub program_label: String,
    pub time_min: u32,
    pub title: String,
    pub category: String,
    pub difficulty: String,
    pub description: String,
}

fn normalize_name(s: &str) -> String {
    s.to_lowercase().replace('ё', "е").trim().to_string()
}

pub fn resolve_ingredient_id(catalog: &Catalog, token: &str) -> Option<String> {
    let t = normalize_name(token);
    if catalog.ingredients.contains_key(&t) {
        return Some(t);
    }
    for (id, ingr) in &catalog.ingredients {
        if normalize_name(&ingr.name) == t {
            return Some(id.clone());
        }
        if ingr
            .aliases
            .iter()
            .any(|a| normalize_name(a) == t)
        {
            return Some(id.clone());
        }
    }
    None
}

pub fn is_always_available(catalog: &Catalog, id: &str) -> bool {
    if let Some(ingr) = catalog.ingredients.get(id) {
        if ingr.hide_from_pantry {
            return true;
        }
    }
    catalog.meta.always_available.iter().any(|x| x == id)
}

pub fn recipe_required_ids(catalog: &Catalog, recipe_id: &str) -> Vec<String> {
    let Some(recipe) = catalog.recipes.get(recipe_id) else {
        return Vec::new();
    };
    let mut req = Vec::new();
    for row in &recipe.ingredients {
        if row.optional {
            continue;
        }
        if is_always_available(catalog, &row.ingredient_id) {
            continue;
        }
        if !req.contains(&row.ingredient_id) {
            req.push(row.ingredient_id.clone());
        }
    }
    req
}

pub fn match_recipes(
    catalog: &Catalog,
    pantry: &HashSet<String>,
    near_match: bool,
) -> Vec<MatchResult> {
    let mut results = Vec::new();
    for (rid, recipe) in &catalog.recipes {
        let req = recipe_required_ids(catalog, rid);
        let missing: Vec<String> = req
            .iter()
            .filter(|id| !pantry.contains(id.as_str()))
            .cloned()
            .collect();
        let status = if missing.is_empty() {
            "exact"
        } else if near_match && missing.len() <= 2 {
            "near"
        } else {
            "unavailable"
        };
        if status == "unavailable" {
            continue;
        }
        let score = if status == "exact" {
            1000 - req.len() as i32
        } else {
            500 - (missing.len() as i32) * 10
        };
        let missing_names: Vec<String> = missing
            .iter()
            .map(|id| {
                catalog
                    .ingredients
                    .get(id)
                    .map(|i| i.name.clone())
                    .unwrap_or_else(|| id.clone())
            })
            .collect();

        for mkey in ["panasonic", "redmond"] {
            let (compatible, program_label, time_min, machine_id) = if mkey == "panasonic" {
                let mp = &recipe.machine_profiles.panasonic;
                if !mp.compatible {
                    continue;
                }
                (
                    true,
                    format!("№{} «{}»", mp.program_no, mp.program_name),
                    mp.total_time_min,
                    "panasonic_sd_yr2540hts".to_string(),
                )
            } else {
                let mp = &recipe.machine_profiles.redmond;
                if !mp.compatible {
                    continue;
                }
                let label = if mp.workflow == "bake-only" {
                    "BAKE".to_string()
                } else if mp.workflow == "bread-auto" {
                    "BREAD".to_string()
                } else {
                    "MULTI COOK + BAKE".to_string()
                };
                let time = mp.proof.as_ref().map(|p| p.time_min).unwrap_or(0)
                    + mp.bake.time_min
                    + mp.bake.second_bake_min.unwrap_or(0);
                (true, label, time, "redmond_rmc_m92s".to_string())
            };
            let _ = compatible;
            results.push(MatchResult {
                recipe_id: rid.clone(),
                machine_key: mkey.to_string(),
                machine_id,
                status: status.to_string(),
                missing: missing.clone(),
                missing_names: missing_names.clone(),
                score,
                program_label,
                time_min,
                title: recipe.title.clone(),
                category: recipe.category.clone(),
                difficulty: recipe.difficulty.clone(),
                description: recipe.description.clone(),
            });
        }
    }

    results.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| a.title.cmp(&b.title))
    });
    // localeCompare("ru") approx: Rust Ord on UTF-8 is close enough for Cyrillic; keep stable by title
    results
}

#[allow(dead_code)]
pub fn build_shopping_list(catalog: &Catalog, matches: &[MatchResult]) -> Vec<String> {
    let mut set: HashMap<String, String> = HashMap::new();
    for m in matches {
        for id in &m.missing {
            let name = catalog
                .ingredients
                .get(id)
                .map(|i| i.name.clone())
                .unwrap_or_else(|| id.clone());
            set.insert(id.clone(), name);
        }
    }
    let mut names: Vec<String> = set.into_values().collect();
    names.sort();
    names
}

pub fn pantry_set_from_map(pantry: &HashMap<String, bool>) -> HashSet<String> {
    pantry
        .iter()
        .filter(|(_, v)| **v)
        .map(|(k, _)| k.clone())
        .collect()
}

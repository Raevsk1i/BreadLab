use std::collections::HashSet;

use serde::Serialize;

use crate::models::{Catalog, Recipe};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub recipe_id: String,
    pub title: String,
    pub specialty: String,
    pub description: String,
    pub difficulty: String,
    pub source_confidence: String,
    pub category: String,
    pub machine_key: String,
    pub machine_id: String,
    pub status: String,
    pub missing: Vec<String>,
    pub missing_names: Vec<String>,
    pub score: i32,
    pub program_label: String,
    pub time_min: f64,
}

pub fn normalize_name(value: &str) -> String {
    value.to_lowercase().replace('ё', "е").trim().to_string()
}

pub fn resolve_ingredient_id(catalog: &Catalog, token: &str) -> Option<String> {
    let normalized = normalize_name(token);
    if catalog.ingredients.contains_key(&normalized) {
        return Some(normalized);
    }
    for (id, ingredient) in &catalog.ingredients {
        if normalize_name(&ingredient.name) == normalized {
            return Some(id.clone());
        }
        if ingredient
            .aliases
            .iter()
            .any(|alias| normalize_name(alias) == normalized)
        {
            return Some(id.clone());
        }
    }
    None
}

pub fn is_always_available(catalog: &Catalog, id: &str) -> bool {
    if catalog
        .ingredients
        .get(id)
        .is_some_and(|ingredient| ingredient.hide_from_pantry)
    {
        return true;
    }
    catalog.meta.always_available.iter().any(|item| item == id)
}

pub fn recipe_required_ids(catalog: &Catalog, recipe: &Recipe) -> Vec<String> {
    let mut required = Vec::new();
    for row in &recipe.ingredients {
        if row.optional || is_always_available(catalog, &row.ingredient_id) {
            continue;
        }
        if !required.iter().any(|id| id == &row.ingredient_id) {
            required.push(row.ingredient_id.clone());
        }
    }
    required
}

pub fn match_recipes(
    catalog: &Catalog,
    pantry: &HashSet<String>,
    near_match: bool,
) -> Vec<SearchHit> {
    let mut results = Vec::new();
    for (rid, recipe) in &catalog.recipes {
        let required = recipe_required_ids(catalog, recipe);
        let missing: Vec<String> = required
            .iter()
            .filter(|id| !pantry.contains(*id))
            .cloned()
            .collect();
        let status = if missing.is_empty() {
            "exact"
        } else if near_match && missing.len() <= 2 {
            "near"
        } else {
            continue;
        };
        let score = if status == "exact" {
            1000 - required.len() as i32
        } else {
            500 - missing.len() as i32 * 10
        };
        let missing_names: Vec<String> = missing
            .iter()
            .map(|id| {
                catalog
                    .ingredients
                    .get(id)
                    .map(|ingredient| ingredient.name.clone())
                    .unwrap_or_else(|| id.clone())
            })
            .collect();
        for machine_key in ["panasonic", "redmond"] {
            let compatible = match machine_key {
                "panasonic" => recipe.machine_profiles.panasonic.compatible,
                _ => recipe.machine_profiles.redmond.compatible,
            };
            if !compatible {
                continue;
            }
            let (machine_id, program_label, time_min) = if machine_key == "panasonic" {
                let profile = &recipe.machine_profiles.panasonic;
                (
                    "panasonic_sd_yr2540hts",
                    format!("№{} «{}»", profile.program_no, profile.program_name),
                    profile.total_time_min,
                )
            } else {
                let profile = &recipe.machine_profiles.redmond;
                let label = if profile.workflow == "bake-only" {
                    "BAKE"
                } else if profile.workflow == "bread-auto" {
                    "BREAD"
                } else {
                    "MULTI COOK + BAKE"
                };
                let proof = profile.proof.as_ref().map(|p| p.time_min).unwrap_or(0.0);
                let bake = profile.bake.as_ref().map(|b| b.time_min).unwrap_or(0.0);
                let second = profile
                    .bake
                    .as_ref()
                    .and_then(|b| b.second_bake_min)
                    .unwrap_or(0.0);
                ("redmond_rmc_m92s", label.to_string(), proof + bake + second)
            };
            results.push(SearchHit {
                recipe_id: rid.clone(),
                title: recipe.title.clone(),
                specialty: recipe.specialty.clone(),
                description: recipe.description.clone(),
                difficulty: recipe.difficulty.clone(),
                source_confidence: recipe.source_confidence.clone(),
                category: recipe.category.clone(),
                machine_key: machine_key.to_string(),
                machine_id: machine_id.to_string(),
                status: status.to_string(),
                missing: missing.clone(),
                missing_names: missing_names.clone(),
                score,
                program_label,
                time_min,
            });
        }
    }
    results.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| ru_cmp(&a.title, &b.title))
    });
    results
}

pub fn build_shopping_list(catalog: &Catalog, hits: &[SearchHit]) -> Vec<String> {
    let mut names = Vec::new();
    for hit in hits {
        for id in &hit.missing {
            let name = catalog
                .ingredients
                .get(id)
                .map(|ingredient| ingredient.name.clone())
                .unwrap_or_else(|| id.clone());
            if !names.iter().any(|existing| existing == &name) {
                names.push(name);
            }
        }
    }
    names.sort_by(|a, b| ru_cmp(a, b));
    names
}

pub fn ru_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    fn fold(value: &str) -> String {
        value
            .chars()
            .map(|ch| match ch {
                'ё' => 'е',
                'Ё' => 'Е',
                other => other,
            })
            .collect()
    }
    fold(a).cmp(&fold(b)).then_with(|| a.cmp(b))
}

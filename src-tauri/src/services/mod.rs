pub mod calculator;
pub mod matcher;
pub mod persistence;
pub mod recipe_engine;
pub mod steps;
pub mod validation;

use serde::Serialize;

use crate::error::AppError;
use crate::models::{Catalog, Meta, Recipe, TasteAddin};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeCard {
    pub id: String,
    pub title: String,
    pub category: String,
    pub specialty: String,
    pub description: String,
    pub tags: Vec<String>,
    pub difficulty: String,
    pub source_confidence: String,
    pub source_notes: String,
    pub base_total_flour_g: f64,
    pub taste_addin_ids: Vec<String>,
    pub panasonic: ProfileCard,
    pub redmond: ProfileCard,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileCard {
    pub compatible: bool,
    pub program_no: String,
    pub program_name: String,
    pub total_time_min: f64,
    pub workflow: String,
    pub flip_optional: bool,
    pub warnings: Vec<String>,
    pub timers: Vec<crate::models::TimerSpec>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPayload {
    pub meta: Meta,
    pub recipes: Vec<RecipeCard>,
    pub addins: Vec<TasteAddin>,
}

pub fn load_catalog() -> Result<Catalog, AppError> {
    Catalog::load_embedded()
}

pub fn catalog_payload(catalog: &Catalog) -> CatalogPayload {
    CatalogPayload {
        meta: catalog.meta.clone(),
        recipes: catalog.recipes.values().map(recipe_card).collect(),
        addins: catalog.addins.values().cloned().collect(),
    }
}

pub fn recipe_card(recipe: &Recipe) -> RecipeCard {
    RecipeCard {
        id: recipe.id.clone(),
        title: recipe.title.clone(),
        category: recipe.category.clone(),
        specialty: recipe.specialty.clone(),
        description: recipe.description.clone(),
        tags: recipe.tags.clone(),
        difficulty: recipe.difficulty.clone(),
        source_confidence: recipe.source_confidence.clone(),
        source_notes: recipe.source_notes.clone(),
        base_total_flour_g: recipe.base_total_flour_g,
        taste_addin_ids: recipe.taste_addin_ids.clone(),
        panasonic: ProfileCard {
            compatible: recipe.machine_profiles.panasonic.compatible,
            program_no: recipe.machine_profiles.panasonic.program_no.clone(),
            program_name: recipe.machine_profiles.panasonic.program_name.clone(),
            total_time_min: recipe.machine_profiles.panasonic.total_time_min,
            workflow: String::new(),
            flip_optional: false,
            warnings: recipe.machine_profiles.panasonic.warnings.clone(),
            timers: recipe.machine_profiles.panasonic.timers.clone(),
        },
        redmond: ProfileCard {
            compatible: recipe.machine_profiles.redmond.compatible,
            program_no: String::new(),
            program_name: String::new(),
            total_time_min: 0.0,
            workflow: recipe.machine_profiles.redmond.workflow.clone(),
            flip_optional: recipe
                .machine_profiles
                .redmond
                .flip
                .as_ref()
                .is_some_and(|flip| flip.optional),
            warnings: recipe.machine_profiles.redmond.warnings.clone(),
            timers: recipe.machine_profiles.redmond.timers.clone(),
        },
    }
}

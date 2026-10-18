use crate::error::AppError;
use crate::models::*;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct Catalog {
    pub meta: Meta,
    pub ingredients: HashMap<String, Ingredient>,
    pub machines: HashMap<String, Machine>,
    pub recipes: HashMap<String, Recipe>,
    pub taste_addins: HashMap<String, TasteAddin>,
}

impl Catalog {
    pub fn load_embedded() -> Result<Self, AppError> {
        let meta: Meta = serde_json::from_str(include_str!("../data/meta.json"))
            .map_err(|e| AppError::Data(format!("meta.json: {e}")))?;
        let ingredients: HashMap<String, Ingredient> =
            serde_json::from_str(include_str!("../data/ingredients.json"))
                .map_err(|e| AppError::Data(format!("ingredients.json: {e}")))?;
        let machines: HashMap<String, Machine> =
            serde_json::from_str(include_str!("../data/machines.json"))
                .map_err(|e| AppError::Data(format!("machines.json: {e}")))?;
        let recipes: HashMap<String, Recipe> =
            serde_json::from_str(include_str!("../data/recipes.json"))
                .map_err(|e| AppError::Data(format!("recipes.json: {e}")))?;
        let taste_addins: HashMap<String, TasteAddin> =
            serde_json::from_str(include_str!("../data/addins.json"))
                .map_err(|e| AppError::Data(format!("addins.json: {e}")))?;

        let catalog = Self {
            meta,
            ingredients,
            machines,
            recipes,
            taste_addins,
        };
        catalog.validate_integrity()?;
        Ok(catalog)
    }

    pub fn validate_integrity(&self) -> Result<(), AppError> {
        if self.recipes.len() != 35 {
            return Err(AppError::Data(format!(
                "expected 35 recipes, got {}",
                self.recipes.len()
            )));
        }
        for i in 1..=35 {
            let id = format!("p{i:02}");
            if !self.recipes.contains_key(&id) {
                return Err(AppError::Data(format!("missing recipe {id}")));
            }
        }
        if self.machines.len() != 2 {
            return Err(AppError::Data(format!(
                "expected 2 machines, got {}",
                self.machines.len()
            )));
        }
        if self.taste_addins.len() != 9 {
            return Err(AppError::Data(format!(
                "expected 9 taste addins, got {}",
                self.taste_addins.len()
            )));
        }
        Ok(())
    }

    pub fn catalog_entries(&self) -> Vec<CatalogEntry> {
        let mut entries: Vec<CatalogEntry> = self
            .recipes
            .values()
            .map(|r| CatalogEntry {
                id: r.id.clone(),
                title: r.title.clone(),
                category: r.category.clone(),
                specialty: r.specialty.clone(),
                description: r.description.clone(),
                tags: r.tags.clone(),
                difficulty: r.difficulty.clone(),
                base_total_flour_g: r.base_total_flour_g,
                taste_addin_ids: r.taste_addin_ids.clone(),
                panasonic_program_no: r.machine_profiles.panasonic.program_no.clone(),
                panasonic_program_name: r.machine_profiles.panasonic.program_name.clone(),
                redmond_workflow: r.machine_profiles.redmond.workflow.clone(),
            })
            .collect();
        entries.sort_by(|a, b| a.id.cmp(&b.id));
        entries
    }

    pub fn get_recipe(&self, id: &str) -> Result<&Recipe, AppError> {
        self.recipes
            .get(id)
            .ok_or_else(|| AppError::NotFound(format!("recipe {id}")))
    }
}

pub type SharedCatalog = Arc<Catalog>;

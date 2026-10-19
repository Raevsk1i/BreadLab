mod app_state;
mod ingredient;
mod machine;
mod recipe;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

pub use app_state::*;
pub use ingredient::*;
pub use machine::*;
pub use recipe::*;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub version: String,
    #[serde(default)]
    pub always_available: Vec<String>,
    #[serde(default)]
    pub staples: Vec<String>,
    pub categories: Vec<Category>,
    pub catalog_category_order: Vec<String>,
    pub recipe_count: usize,
    pub ingredient_count: usize,
    pub recipe_ids: Vec<String>,
    pub ingredient_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct Catalog {
    pub meta: Meta,
    pub ingredients: IndexMap<String, Ingredient>,
    pub machines: IndexMap<String, Machine>,
    pub recipes: IndexMap<String, Recipe>,
    pub addins: IndexMap<String, TasteAddin>,
}

impl Catalog {
    pub fn load_embedded() -> Result<Self, AppError> {
        let meta: Meta = serde_json::from_str(include_str!("../../data/meta.json"))?;
        let ingredients = serde_json::from_str(include_str!("../../data/ingredients.json"))?;
        let machines = serde_json::from_str(include_str!("../../data/machines.json"))?;
        let recipes = serde_json::from_str(include_str!("../../data/recipes.json"))?;
        let addins = serde_json::from_str(include_str!("../../data/addins.json"))?;
        let catalog = Self {
            meta,
            ingredients,
            machines,
            recipes,
            addins,
        };
        catalog.validate()?;
        Ok(catalog)
    }

    pub fn validate(&self) -> Result<(), AppError> {
        if self.recipes.len() != 35 {
            return Err(AppError::Invalid(format!(
                "ожидалось 35 рецептов, получено {}",
                self.recipes.len()
            )));
        }
        for n in 1..=35 {
            let id = format!("p{n:02}");
            let recipe = self
                .recipes
                .get(&id)
                .ok_or_else(|| AppError::Invalid(format!("нет рецепта {id}")))?;
            if recipe.specialty.chars().count() <= 20 || recipe.category.is_empty() {
                return Err(AppError::Invalid(format!("{id}: неполное описание")));
            }
            if recipe.ingredients.is_empty() {
                return Err(AppError::Invalid(format!("{id}: нет ингредиентов")));
            }
            if recipe.machine_profiles.panasonic.program_no.is_empty() {
                return Err(AppError::Invalid(format!("{id}: нет номера программы")));
            }
            for row in &recipe.ingredients {
                if row.ingredient_id.is_empty() || !row.grams.is_finite() {
                    return Err(AppError::Invalid(format!("{id}: неполная строка")));
                }
            }
        }
        Ok(())
    }

    pub fn recipe(&self, id: &str) -> Option<&Recipe> {
        self.recipes.get(id)
    }
}

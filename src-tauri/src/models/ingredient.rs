use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub id: String,
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub role_default: String,
    #[serde(default)]
    pub increase_effect: String,
    #[serde(default)]
    pub decrease_effect: String,
    #[serde(default)]
    pub substitutions: Vec<String>,
    #[serde(default)]
    pub hydration_fraction: f64,
    #[serde(default = "default_density")]
    pub density_g_per_ml: f64,
    #[serde(default = "default_unit")]
    pub unit_default: String,
    #[serde(default)]
    pub default_pantry_staple: bool,
    #[serde(default)]
    pub hide_from_pantry: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category_note: Option<String>,
}

fn default_density() -> f64 {
    1.0
}

fn default_unit() -> String {
    "g".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TasteAddin {
    pub id: String,
    pub ingredient_id: String,
    pub name: String,
    pub category: String,
    pub suggested_baker_pct_range: [f64; 2],
    pub default_pct: f64,
    pub role: String,
    pub effect: String,
    pub prep: String,
    #[serde(default)]
    pub warnings: Vec<String>,
    pub placement: Placement,
    pub dry: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Placement {
    pub panasonic: String,
    pub redmond: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub version: String,
    pub always_available: Vec<String>,
    pub categories: Vec<Category>,
    #[serde(default)]
    pub staples: Vec<String>,
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const STATE_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(default)]
    pub pantry: HashMap<String, bool>,
    #[serde(default = "default_true")]
    pub staples_on: bool,
    #[serde(default = "default_true")]
    pub near_match_on: bool,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub recent: Vec<String>,
    #[serde(default)]
    pub calibrations: Vec<CalibrationEntry>,
    #[serde(default)]
    pub enabled_taste_addins: HashMap<String, bool>,
    #[serde(default)]
    pub addins_by_recipe: HashMap<String, HashMap<String, bool>>,
    #[serde(default)]
    pub cook_session: Option<CookSession>,
    #[serde(default = "default_machine")]
    pub default_machine_id: String,
    #[serde(default)]
    pub large_steps: bool,
    #[serde(default = "default_difficulty")]
    pub catalog_difficulty: String,
    #[serde(default)]
    pub catalog_favorites_only: bool,
    #[serde(default)]
    pub catalog_can_bake: bool,
    #[serde(default)]
    pub selected_recipe_id: Option<String>,
    #[serde(default)]
    pub selected_machine_id: Option<String>,
    #[serde(default = "default_flour")]
    pub target_flour_g: f64,
    #[serde(default)]
    pub checklist: HashMap<String, HashMap<String, bool>>,
    #[serde(default)]
    pub catalog_open: Option<bool>,
}

fn default_schema_version() -> u32 {
    STATE_SCHEMA_VERSION
}
fn default_true() -> bool {
    true
}
fn default_machine() -> String {
    "panasonic_sd_yr2540hts".to_string()
}
fn default_difficulty() -> String {
    "all".to_string()
}
fn default_flour() -> f64 {
    450.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationEntry {
    pub recipe_id: String,
    pub machine_id: String,
    pub target_flour_g: f64,
    pub actual_finished_weight_g: f64,
    #[serde(default)]
    pub peak_fill_percent: Option<f64>,
    pub predicted_mid: f64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CookSession {
    pub recipe_id: String,
    pub machine_id: String,
    pub step_index: u32,
    #[serde(default)]
    pub timer_id: Option<String>,
    pub ck_key: String,
    pub remaining_ms: f64,
    /// Always persisted as false (paused) — matches original BreadLab.
    #[serde(default)]
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPayload {
    pub app: String,
    pub version: String,
    pub exported_at: String,
    pub pantry: HashMap<String, bool>,
    pub staples_on: bool,
    pub near_match_on: bool,
    pub favorites: Vec<String>,
    pub recent: Vec<String>,
    pub calibrations: Vec<CalibrationEntry>,
    pub enabled_taste_addins: HashMap<String, bool>,
    pub addins_by_recipe: HashMap<String, HashMap<String, bool>>,
    pub cook_session: Option<CookSession>,
    pub default_machine_id: String,
    pub large_steps: bool,
    pub settings: ExportSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSettings {
    pub default_machine_id: String,
    pub large_steps: bool,
}

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;
pub const DEFAULT_MACHINE: &str = "panasonic_sd_yr2540hts";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserState {
    #[serde(default = "default_schema")]
    pub schema_version: u32,
    #[serde(default)]
    pub pantry: IndexMap<String, bool>,
    #[serde(default = "default_true")]
    pub staples_on: bool,
    #[serde(default = "default_true")]
    pub near_match_on: bool,
    #[serde(default)]
    pub favorites: Vec<String>,
    #[serde(default)]
    pub recent: Vec<String>,
    #[serde(default)]
    pub calibrations: Vec<Calibration>,
    #[serde(default)]
    pub enabled_taste_addins: IndexMap<String, bool>,
    #[serde(default)]
    pub addins_by_recipe: IndexMap<String, IndexMap<String, bool>>,
    #[serde(default)]
    pub cook_session: Option<CookSession>,
    #[serde(default = "default_machine")]
    pub default_machine_id: String,
    #[serde(default)]
    pub large_steps: bool,
    #[serde(default = "default_all")]
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
    pub checklist: IndexMap<String, IndexMap<String, bool>>,
    #[serde(default = "default_true")]
    pub catalog_open: bool,
}

fn default_schema() -> u32 {
    SCHEMA_VERSION
}
fn default_true() -> bool {
    true
}
fn default_machine() -> String {
    DEFAULT_MACHINE.to_string()
}
fn default_all() -> String {
    "all".to_string()
}
fn default_flour() -> f64 {
    450.0
}

impl Default for UserState {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            pantry: IndexMap::new(),
            staples_on: true,
            near_match_on: true,
            favorites: Vec::new(),
            recent: Vec::new(),
            calibrations: Vec::new(),
            enabled_taste_addins: IndexMap::new(),
            addins_by_recipe: IndexMap::new(),
            cook_session: None,
            default_machine_id: DEFAULT_MACHINE.to_string(),
            large_steps: false,
            catalog_difficulty: "all".to_string(),
            catalog_favorites_only: false,
            catalog_can_bake: false,
            selected_recipe_id: None,
            selected_machine_id: None,
            target_flour_g: 450.0,
            checklist: IndexMap::new(),
            catalog_open: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Calibration {
    pub recipe_id: String,
    #[serde(default)]
    pub machine_id: Option<String>,
    #[serde(default)]
    pub target_flour_g: Option<f64>,
    pub actual_finished_weight_g: f64,
    #[serde(default)]
    pub peak_fill_percent: Option<f64>,
    #[serde(default)]
    pub predicted_mid: f64,
    #[serde(default)]
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CookSession {
    pub recipe_id: String,
    #[serde(default)]
    pub machine_id: Option<String>,
    #[serde(default)]
    pub step_index: u32,
    #[serde(default)]
    pub timer_id: Option<String>,
    #[serde(default)]
    pub ck_key: Option<String>,
    #[serde(default)]
    pub remaining_ms: Option<f64>,
    /// Always persisted as false. Closing cook mode pauses the timer,
    /// and restoring a session must not resume the countdown.
    #[serde(default)]
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalibrationInput {
    pub actual_finished_weight_g: f64,
    pub predicted_mid: f64,
}

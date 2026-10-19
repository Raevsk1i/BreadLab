use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    pub id: String,
    pub short_name: String,
    pub name: String,
    #[serde(default)]
    pub programs: IndexMap<String, String>,
    #[serde(default)]
    pub constraints: Option<MachineConstraints>,
    #[serde(default)]
    pub bowl_volume_ml: Option<f64>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub modes: Vec<String>,
    #[serde(default)]
    pub multi_cook_temp_c: Option<[f64; 2]>,
    #[serde(default)]
    pub bread_default_min: Option<f64>,
    #[serde(default)]
    pub bread_range_min: Option<[f64; 2]>,
    #[serde(default)]
    pub flip_default: Option<FlipSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineConstraints {
    pub bread_flour: [f64; 2],
    pub dough_flour: [f64; 2],
    pub yeast_g: [f64; 2],
    pub dispenser_addins_max_g: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlipSpec {
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub optional: bool,
    #[serde(default)]
    pub suggested_at_min: Option<f64>,
    #[serde(default)]
    pub reason: String,
}

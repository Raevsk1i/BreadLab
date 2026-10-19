use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    pub id: String,
    pub short_name: String,
    pub name: String,
    pub notes: String,
    #[serde(default)]
    pub bowl_volume_ml: Option<f64>,
    #[serde(default)]
    pub programs: Option<HashMap<String, String>>,
    #[serde(default)]
    pub constraints: Option<PanasonicConstraints>,
    #[serde(default)]
    pub modes: Option<Vec<String>>,
    #[serde(default)]
    pub multi_cook_temp_c: Option<[f64; 2]>,
    #[serde(default)]
    pub bread_default_min: Option<u32>,
    #[serde(default)]
    pub bread_range_min: Option<[u32; 2]>,
    #[serde(default)]
    pub flip_default: Option<FlipDefault>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanasonicConstraints {
    pub bread_flour: [f64; 2],
    pub dough_flour: [f64; 2],
    pub yeast_g: [f64; 2],
    pub dispenser_addins_max_g: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlipDefault {
    pub required: bool,
    pub optional: bool,
    pub reason: String,
}

use serde::{Deserialize, Serialize};

use super::ingredient::Placement;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: String,
    pub title: String,
    pub category: String,
    #[serde(default)]
    pub specialty: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub difficulty: String,
    #[serde(default)]
    pub source_confidence: String,
    #[serde(default)]
    pub source_notes: String,
    pub base_total_flour_g: f64,
    #[serde(default)]
    pub flour_components: Vec<FlourComponent>,
    pub ingredients: Vec<IngredientRow>,
    #[serde(default)]
    pub taste_addin_ids: Vec<String>,
    pub physics: Physics,
    pub machine_profiles: MachineProfiles,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlourComponent {
    pub ingredient_id: String,
    pub grams: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientRow {
    pub ingredient_id: String,
    pub grams: f64,
    #[serde(default)]
    pub is_flour: bool,
    #[serde(default)]
    pub stage: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub detailed_role: String,
    #[serde(default)]
    pub placement: Option<Placement>,
    #[serde(default = "default_true")]
    pub scalable: bool,
    #[serde(default)]
    pub hydration_contributor: bool,
    #[serde(default)]
    pub increase_effect: String,
    #[serde(default)]
    pub decrease_effect: String,
    #[serde(default)]
    pub substitutions: Vec<String>,
    #[serde(default = "default_unit")]
    pub unit: String,
    #[serde(default)]
    pub optional: bool,
}

fn default_true() -> bool {
    true
}

fn default_unit() -> String {
    "g".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Physics {
    pub bake_loss_range: [f64; 2],
    #[serde(default = "default_density")]
    pub dough_density_g_per_ml: f64,
    pub proof_expansion_range: [f64; 2],
    #[serde(default = "default_headroom")]
    pub headroom_factor: f64,
    #[serde(default)]
    pub confidence: String,
}

fn default_density() -> f64 {
    1.05
}

fn default_headroom() -> f64 {
    1.25
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineProfiles {
    pub panasonic: PanasonicProfile,
    pub redmond: RedmondProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PanasonicProfile {
    pub compatible: bool,
    #[serde(default)]
    pub program_no: String,
    #[serde(default)]
    pub program_name: String,
    #[serde(default)]
    pub crust: Option<String>,
    #[serde(default)]
    pub loaf_size: Option<String>,
    #[serde(default)]
    pub total_time_min: f64,
    #[serde(default)]
    pub steps: Vec<StepText>,
    #[serde(default)]
    pub timers: Vec<TimerSpec>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedmondProfile {
    pub compatible: bool,
    #[serde(default)]
    pub workflow: String,
    #[serde(default)]
    pub proof: Option<ProofSpec>,
    #[serde(default)]
    pub bake: Option<BakeSpec>,
    #[serde(default)]
    pub flip: Option<super::machine::FlipSpec>,
    #[serde(default)]
    pub steps: Vec<StepText>,
    #[serde(default)]
    pub timers: Vec<TimerSpec>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofSpec {
    #[serde(default)]
    pub program: String,
    #[serde(default)]
    pub temperature_c: Option<f64>,
    #[serde(default)]
    pub time_min: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BakeSpec {
    #[serde(default)]
    pub program: String,
    #[serde(default)]
    pub time_min: f64,
    #[serde(default)]
    pub second_bake_min: Option<f64>,
    #[serde(default)]
    pub temperature_c: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepText {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub timer_min: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerSpec {
    pub id: String,
    pub label: String,
    pub minutes: f64,
}

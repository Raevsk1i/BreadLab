use super::ingredient::Placement;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: String,
    pub title: String,
    pub category: String,
    pub specialty: String,
    pub description: String,
    pub tags: Vec<String>,
    pub difficulty: String,
    #[serde(default)]
    pub source_confidence: String,
    #[serde(default)]
    pub source_notes: String,
    pub base_total_flour_g: f64,
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
    pub is_flour: bool,
    pub stage: String,
    pub role: String,
    #[serde(default)]
    pub detailed_role: String,
    pub placement: Placement,
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
    pub dough_density_g_per_ml: f64,
    pub proof_expansion_range: [f64; 2],
    pub headroom_factor: f64,
    pub confidence: String,
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
    pub program_no: String,
    pub program_name: String,
    #[serde(default)]
    pub crust: String,
    #[serde(default)]
    pub loaf_size: String,
    pub total_time_min: u32,
    pub steps: Vec<Step>,
    pub timers: Vec<TimerSpec>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedmondProfile {
    pub compatible: bool,
    pub workflow: String,
    #[serde(default)]
    pub proof: Option<ProofSpec>,
    pub bake: BakeSpec,
    pub flip: FlipSpec,
    pub steps: Vec<Step>,
    pub timers: Vec<TimerSpec>,
    #[serde(default)]
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Step {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub timer_min: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerSpec {
    pub id: String,
    pub label: String,
    pub minutes: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BakeSpec {
    pub program: String,
    pub time_min: u32,
    #[serde(default)]
    pub second_bake_min: Option<u32>,
    #[serde(default)]
    pub temperature_c: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofSpec {
    pub program: String,
    pub temperature_c: u32,
    pub time_min: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FlipSpec {
    pub required: bool,
    pub optional: bool,
    #[serde(default)]
    pub suggested_at_min: Option<u32>,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub title: String,
    pub category: String,
    pub specialty: String,
    pub description: String,
    pub tags: Vec<String>,
    pub difficulty: String,
    pub base_total_flour_g: f64,
    pub taste_addin_ids: Vec<String>,
    pub panasonic_program_no: String,
    pub panasonic_program_name: String,
    pub redmond_workflow: String,
}

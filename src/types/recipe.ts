export interface Placement {
  panasonic: string;
  redmond: string;
}

export interface FlourComponent {
  ingredientId: string;
  grams: number;
}

export interface IngredientRow {
  ingredientId: string;
  grams: number;
  isFlour: boolean;
  stage: string;
  role: string;
  detailedRole: string;
  placement: Placement;
  scalable: boolean;
  hydrationContributor: boolean;
  increaseEffect: string;
  decreaseEffect: string;
  substitutions: string[];
  unit: string;
  optional?: boolean;
}

export interface Physics {
  bakeLossRange: [number, number];
  doughDensityGPerMl: number;
  proofExpansionRange: [number, number];
  headroomFactor: number;
  confidence: string;
}

export interface Step {
  id: string;
  text: string;
  timerMin: number | null;
}

export interface TimerSpec {
  id: string;
  label: string;
  minutes: number;
}

export interface PanasonicProfile {
  compatible: boolean;
  programNo: string;
  programName: string;
  crust: string;
  loafSize: string;
  totalTimeMin: number;
  steps: Step[];
  timers: TimerSpec[];
  warnings: string[];
}

export interface BakeSpec {
  program: string;
  timeMin: number;
  secondBakeMin?: number | null;
  temperatureC?: number | null;
}

export interface ProofSpec {
  program: string;
  temperatureC: number;
  timeMin: number;
}

export interface FlipSpec {
  required: boolean;
  optional: boolean;
  suggestedAtMin?: number | null;
  reason: string;
}

export interface RedmondProfile {
  compatible: boolean;
  workflow: string;
  proof: ProofSpec | null;
  bake: BakeSpec;
  flip: FlipSpec;
  steps: Step[];
  timers: TimerSpec[];
  warnings: string[];
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  specialty: string;
  description: string;
  tags: string[];
  difficulty: string;
  sourceConfidence: string;
  sourceNotes: string;
  baseTotalFlourG: number;
  flourComponents: FlourComponent[];
  ingredients: IngredientRow[];
  tasteAddinIds: string[];
  physics: Physics;
  machineProfiles: {
    panasonic: PanasonicProfile;
    redmond: RedmondProfile;
  };
}

export interface CatalogEntry {
  id: string;
  title: string;
  category: string;
  specialty: string;
  description: string;
  tags: string[];
  difficulty: string;
  baseTotalFlourG: number;
  tasteAddinIds: string[];
  panasonicProgramNo: string;
  panasonicProgramName: string;
  redmondWorkflow: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  description: string;
  roleDefault: string;
  increaseEffect: string;
  decreaseEffect: string;
  substitutions: string[];
  hydrationFraction: number;
  densityGPerMl: number;
  unitDefault: string;
  defaultPantryStaple: boolean;
  hideFromPantry?: boolean;
}

export interface TasteAddin {
  id: string;
  ingredientId: string;
  name: string;
  category: string;
  suggestedBakerPctRange: [number, number];
  defaultPct: number;
  role: string;
  effect: string;
  prep: string;
  warnings: string[];
  placement: Placement;
  dry: boolean;
}

export interface Machine {
  id: string;
  shortName: string;
  name: string;
  notes: string;
  bowlVolumeMl?: number | null;
  programs?: Record<string, string>;
  constraints?: {
    breadFlour: [number, number];
    doughFlour: [number, number];
    yeastG: [number, number];
    dispenserAddinsMaxG: number;
  };
  modes?: string[];
}

export interface Meta {
  version: string;
  alwaysAvailable: string[];
  categories: { id: string; name: string }[];
  staples: string[];
}

export interface ScaledItem {
  ingredientId: string;
  grams: number;
  bakerPct: number;
  isFlour: boolean;
  stage: string;
  role: string;
  detailedRole: string;
  placement: Placement;
  scalable: boolean;
  hydrationContributor: boolean;
  increaseEffect: string;
  decreaseEffect: string;
  substitutions: string[];
  unit: string;
  optional: boolean;
  scaled: boolean;
  name?: string | null;
  isAddin?: boolean;
  addinId?: string | null;
  pctRange?: [number, number] | null;
  gramsRange?: [number, number] | null;
  effect?: string | null;
  warnings?: string[] | null;
  dry?: boolean | null;
}

export interface RecipeCalculation {
  scaled: {
    targetFlourG: number;
    factor: number;
    items: ScaledItem[];
    addins: ScaledItem[];
    all: ScaledItem[];
  };
  hydration: number;
  doughMass: number;
  finished: { min: number; max: number };
  volume: {
    initialMl: number;
    proofedMinMl: number;
    proofedMaxMl: number;
    recommendedBowlMl: number;
  };
  dispenserLoad: number;
  warnings: { level: string; code: string; message: string }[];
}

export interface MatchResult {
  recipeId: string;
  machineKey: string;
  machineId: string;
  status: string;
  missing: string[];
  missingNames: string[];
  score: number;
  programLabel: string;
  timeMin: number;
  title: string;
  category: string;
  difficulty: string;
  description: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Meta {
  version: string;
  alwaysAvailable: string[];
  staples: string[];
  categories: Category[];
  catalogCategoryOrder: string[];
  recipeCount: number;
  ingredientCount: number;
  recipeIds: string[];
  ingredientIds: string[];
}

export interface TimerSpec {
  id: string;
  label: string;
  minutes: number;
}

export interface ProfileCard {
  compatible: boolean;
  programNo: string;
  programName: string;
  totalTimeMin: number;
  workflow: string;
  flipOptional: boolean;
  warnings: string[];
  timers: TimerSpec[];
}

export interface RecipeCard {
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
  tasteAddinIds: string[];
  panasonic: ProfileCard;
  redmond: ProfileCard;
}

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  hideFromPantry: boolean;
  description: string;
  roleDefault: string;
  increaseEffect: string;
  decreaseEffect: string;
  substitutions: string[];
}

export interface Machine {
  id: string;
  shortName: string;
  name: string;
  notes: string;
  bowlVolumeMl: number | null;
}

export interface CatalogPayload {
  meta: Meta;
  recipes: RecipeCard[];
  addins: TasteAddin[];
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
  dry: boolean;
}

export interface Warning {
  level: string;
  code: string;
  message: string;
}

export interface DisplayRow {
  ingredientId: string;
  name: string;
  grams: number;
  gramsText: string;
  bakerPct: number;
  bakerPctText: string;
  role: string;
  stage: string;
  stageLabel: string;
  placementLabel: string;
  placementPanasonic: string;
  placementRedmond: string;
  detailedRole: string;
  increaseEffect: string;
  decreaseEffect: string;
  substitutions: string[];
  warnings: string[];
  isAddin: boolean;
  effect: string;
  gramsRangeText: string | null;
  pctRange: [number, number] | null;
}

export interface ShoppingRow {
  id: string;
  name: string;
  grams: number;
  gramsText: string;
}

export interface FilledStep {
  id: string;
  text: string;
  isAddin: boolean;
}

export interface AddinPreview {
  id: string;
  name: string;
  role: string;
  gramsText: string;
  minText: string;
  maxText: string;
  pctRange: [number, number];
  warnings: string[];
}

export interface Calculation {
  recipeId: string;
  machineId: string;
  machineKey: string;
  targetFlourG: number;
  baseFlourG: number;
  factor: number;
  hydrationPct: number;
  doughMassG: number;
  finishedMinG: number;
  finishedMaxG: number;
  uncalibratedMidG: number;
  initialMl: number;
  proofedMinMl: number;
  proofedMaxMl: number;
  recommendedBowlMl: number;
  dispenserG: number;
  fillPct: number | null;
  fillLevel: string | null;
  physicsConfidence: string;
  headroomFactor: number;
  bakeLossMinPct: number;
  bakeLossMaxPct: number;
  calibrated: boolean;
  warnings: Warning[];
  profileWarnings: string[];
  items: DisplayRow[];
  shopping: ShoppingRow[];
  cookSteps: FilledStep[];
  addinPreviews: AddinPreview[];
}

export interface SearchHit {
  recipeId: string;
  title: string;
  specialty: string;
  description: string;
  difficulty: string;
  sourceConfidence: string;
  category: string;
  machineKey: string;
  machineId: string;
  status: string;
  missing: string[];
  missingNames: string[];
  score: number;
  programLabel: string;
  timeMin: number;
}

export interface Calibration {
  recipeId: string;
  machineId: string | null;
  targetFlourG: number | null;
  actualFinishedWeightG: number;
  peakFillPercent: number | null;
  predictedMid: number;
  timestamp: string;
}

export interface CookSession {
  recipeId: string;
  machineId: string | null;
  stepIndex: number;
  timerId: string | null;
  ckKey: string | null;
  remainingMs: number | null;
  running: boolean;
}

export interface PersistedState {
  schemaVersion: number;
  pantry: Record<string, boolean>;
  staplesOn: boolean;
  nearMatchOn: boolean;
  favorites: string[];
  recent: string[];
  calibrations: Calibration[];
  enabledTasteAddins: Record<string, boolean>;
  addinsByRecipe: Record<string, Record<string, boolean>>;
  cookSession: CookSession | null;
  defaultMachineId: string;
  largeSteps: boolean;
  catalogDifficulty: string;
  catalogFavoritesOnly: boolean;
  catalogCanBake: boolean;
  selectedRecipeId: string | null;
  selectedMachineId: string | null;
  targetFlourG: number;
  checklist: Record<string, Record<string, boolean>>;
  catalogOpen: boolean;
}

export interface CalculateRequest {
  recipeId: string;
  machineId: string;
  targetFlourG: number;
  enabledAddins: string[];
  pantry: string[];
  calibration: { actualFinishedWeightG: number; predictedMid: number } | null;
}

export interface LoadResponse {
  state: PersistedState;
  notice: string | null;
}

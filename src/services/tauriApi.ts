import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type {
  CatalogEntry,
  Ingredient,
  Machine,
  MatchResult,
  Meta,
  Recipe,
  RecipeCalculation,
  TasteAddin,
} from "../types/recipe";
import type { CalibrationEntry, PersistedState } from "../types/state";

export async function getCatalog(): Promise<CatalogEntry[]> {
  return invoke("get_catalog");
}

export async function getRecipe(id: string): Promise<Recipe> {
  return invoke("get_recipe", { id });
}

export async function getIngredients(): Promise<Record<string, Ingredient>> {
  return invoke("get_ingredients");
}

export async function getMachines(): Promise<Record<string, Machine>> {
  return invoke("get_machines");
}

export async function getAddins(): Promise<Record<string, TasteAddin>> {
  return invoke("get_addins");
}

export async function getMeta(): Promise<Meta> {
  return invoke("get_meta");
}

export async function searchRecipes(
  pantry: Record<string, boolean>,
  nearMatch: boolean,
): Promise<MatchResult[]> {
  return invoke("search_recipes", { args: { pantry, nearMatch } });
}

export async function calculateRecipe(args: {
  recipeId: string;
  machineId: string;
  targetFlourG: number;
  enabledTasteAddins: Record<string, boolean>;
  calibration?: CalibrationEntry | null;
}): Promise<RecipeCalculation> {
  return invoke("calculate_recipe", { args });
}

export async function loadState(): Promise<{
  state: PersistedState;
  recoveredFromBackup: boolean;
}> {
  return invoke("load_state");
}

export async function saveState(state: PersistedState): Promise<void> {
  return invoke("save_state", { state });
}

export async function importState(state: PersistedState): Promise<{
  state: PersistedState;
  cancelled: boolean;
}> {
  return invoke("import_state", { state });
}

export async function exportState(state: PersistedState): Promise<{
  cancelled: boolean;
  path?: string | null;
}> {
  return invoke("export_state", { state });
}

export async function copyText(text: string): Promise<void> {
  await writeText(text);
}

/** Request-version helper to ignore stale calculate_recipe responses. */
export function createRequestGate() {
  let version = 0;
  return {
    next(): number {
      version += 1;
      return version;
    },
    isCurrent(v: number): boolean {
      return v === version;
    },
  };
}

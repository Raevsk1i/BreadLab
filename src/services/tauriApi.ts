import { invoke } from "@tauri-apps/api/core";
import type {
  CalculateRequest,
  Calculation,
  CatalogPayload,
  Ingredient,
  LoadResponse,
  Machine,
  PersistedState,
  RecipeCard,
  SearchHit,
} from "../types/models";

export interface BreadApi {
  loadState(): Promise<LoadResponse>;
  saveState(state: PersistedState): Promise<void>;
  getCatalog(): Promise<CatalogPayload>;
  getRecipe(recipeId: string): Promise<RecipeCard>;
  getIngredients(): Promise<Record<string, Ingredient>>;
  getMachines(): Promise<Record<string, Machine>>;
  searchRecipes(pantry: string[], nearMatch: boolean): Promise<SearchHit[]>;
  calculateRecipe(request: CalculateRequest): Promise<Calculation>;
  importState(path: string): Promise<LoadResponse>;
  exportState(path: string): Promise<void>;
}

export function createTauriApi(): BreadApi {
  return {
    loadState: () => invoke<LoadResponse>("load_state"),
    saveState: (state) => invoke("save_state", { incoming: state }),
    getCatalog: () => invoke<CatalogPayload>("get_catalog"),
    getRecipe: (recipeId) => invoke<RecipeCard>("get_recipe", { recipeId }),
    getIngredients: () => invoke<Record<string, Ingredient>>("get_ingredients"),
    getMachines: () => invoke<Record<string, Machine>>("get_machines"),
    searchRecipes: (pantry, nearMatch) => invoke<SearchHit[]>("search_recipes", { request: { pantry, nearMatch } }),
    calculateRecipe: (request) => invoke<Calculation>("calculate_recipe", { request }),
    importState: (path) => invoke<LoadResponse>("import_state", { path }),
    exportState: (path) => invoke("export_state", { path }),
  };
}

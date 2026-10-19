import type { PersistedState, RecipeCard } from "../types/models";
import { normalizeName } from "../utils/formatting";

export function defaultState(): PersistedState {
  return {
    schemaVersion: 1,
    pantry: {},
    staplesOn: true,
    nearMatchOn: true,
    favorites: [],
    recent: [],
    calibrations: [],
    enabledTasteAddins: {},
    addinsByRecipe: {},
    cookSession: null,
    defaultMachineId: "panasonic_sd_yr2540hts",
    largeSteps: false,
    catalogDifficulty: "all",
    catalogFavoritesOnly: false,
    catalogCanBake: false,
    selectedRecipeId: null,
    selectedMachineId: null,
    targetFlourG: 450,
    checklist: {},
    catalogOpen: true,
  };
}

export function selectedPantry(pantry: Record<string, boolean>): string[] {
  return Object.keys(pantry).filter((id) => pantry[id]);
}

export function syncAddins(state: PersistedState, recipeId: string | null): void {
  if (!recipeId) return;
  if (!state.addinsByRecipe[recipeId]) state.addinsByRecipe[recipeId] = {};
  state.enabledTasteAddins = state.addinsByRecipe[recipeId];
}

export function enabledAddinIds(state: PersistedState, recipeId: string | null): string[] {
  const bag = recipeId && state.addinsByRecipe[recipeId]
    ? state.addinsByRecipe[recipeId]
    : state.enabledTasteAddins;
  return Object.keys(bag).filter((id) => bag[id]).sort();
}

export function toggleFavorite(favorites: string[], id: string): string[] {
  const index = favorites.indexOf(id);
  if (index === -1) return [...favorites, id];
  return favorites.filter((item) => item !== id);
}

export function pushRecent(recent: string[], id: string): string[] {
  if (recent.includes(id)) return recent.slice(0, 10);
  return [id, ...recent].slice(0, 10);
}

export function recipePassesCatalogFilters(
  recipe: RecipeCard,
  id: string,
  state: Pick<PersistedState, "catalogDifficulty" | "catalogFavoritesOnly" | "catalogCanBake" | "favorites">,
  category: string,
  bakeSet: Set<string> | null,
): boolean {
  if (category !== "all" && recipe.category !== category) return false;
  if (state.catalogDifficulty !== "all" && recipe.difficulty !== state.catalogDifficulty) return false;
  if (state.catalogFavoritesOnly && !state.favorites.includes(id)) return false;
  if (state.catalogCanBake && (!bakeSet || !bakeSet.has(id))) return false;
  return true;
}

export function ingredientVisible(
  ingredient: { name: string; aliases: string[]; category: string; hideFromPantry: boolean },
  category: string,
  query: string,
): boolean {
  if (ingredient.hideFromPantry) return false;
  if (category !== "all" && ingredient.category !== category) return false;
  const needle = normalizeName(query);
  if (!needle) return true;
  const hay = normalizeName(`${ingredient.name} ${ingredient.aliases.join(" ")}`);
  return hay.includes(needle);
}

export function currentCalibration(state: PersistedState) {
  const list = state.calibrations.filter(
    (item) => item.recipeId === state.selectedRecipeId && item.machineId === state.selectedMachineId,
  );
  return list.length ? list[list.length - 1] : null;
}

export function clampFlour(value: number): number {
  if (!Number.isFinite(value)) return 450;
  return Math.max(250, Math.min(650, Math.round(value)));
}

export { normalizeName };

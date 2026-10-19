import { describe, expect, it } from "vitest";
import {
  defaultState,
  enabledAddinIds,
  pushRecent,
  recipePassesCatalogFilters,
  syncAddins,
  toggleFavorite,
} from "./stateManager";
import type { RecipeCard } from "../types/models";

function card(id: string, category = "Базовые", difficulty = "лёгкий"): RecipeCard {
  return {
    id,
    title: id,
    category,
    specialty: "Описание рецепта достаточно длинное для карточки каталога.",
    description: "",
    tags: [],
    difficulty,
    sourceConfidence: "verified-adaptation",
    sourceNotes: "",
    baseTotalFlourG: 400,
    tasteAddinIds: [],
    panasonic: { compatible: true, programNo: "01", programName: "Основной", totalTimeMin: 240, workflow: "", flipOptional: false, warnings: [], timers: [] },
    redmond: { compatible: true, programNo: "", programName: "", totalTimeMin: 0, workflow: "bread-3h", flipOptional: true, warnings: [], timers: [] },
  };
}

describe("state", () => {
  it("keeps favorites filter and per-recipe add-ins", () => {
    const state = defaultState();
    state.favorites = toggleFavorite([], "p16");
    expect(recipePassesCatalogFilters(card("p16"), "p16", { ...state, catalogFavoritesOnly: true }, "all", null)).toBe(true);
    expect(recipePassesCatalogFilters(card("p01"), "p01", { ...state, catalogFavoritesOnly: true }, "all", null)).toBe(false);
    state.addinsByRecipe = { p01: { walnut: true }, p27: { cheese_add: true } };
    syncAddins(state, "p01");
    const a1 = enabledAddinIds(state, "p01");
    syncAddins(state, "p27");
    const a2 = enabledAddinIds(state, "p27");
    expect(a1).toEqual(["walnut"]);
    expect(a2).toEqual(["cheese_add"]);
    expect(toggleFavorite(["p16"], "p16")).toEqual([]);
  });

  it("does not reshuffle an already recent recipe", () => {
    expect(pushRecent(["p02", "p01"], "p01")).toEqual(["p02", "p01"]);
    expect(pushRecent(["p01"], "p03")).toEqual(["p03", "p01"]);
  });
});

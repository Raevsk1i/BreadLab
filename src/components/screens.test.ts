import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderCatalog } from "./BreadCatalog";
import { renderCookSteps } from "./CookMode";
import type { RecipeCard } from "../types/models";

function card(index: number): RecipeCard {
  const id = `p${String(index).padStart(2, "0")}`;
  return {
    id,
    title: `Хлеб ${id}`,
    category: index % 2 ? "Базовые" : "Ржаные",
    specialty: "Длинное описание вида хлеба для карточки каталога и проверки экрана.",
    description: "",
    tags: ["тест"],
    difficulty: index % 3 ? "лёгкий" : "средний",
    sourceConfidence: "verified-adaptation",
    sourceNotes: "",
    baseTotalFlourG: 400,
    tasteAddinIds: [],
    panasonic: { compatible: true, programNo: "01", programName: "Основной", totalTimeMin: 240, workflow: "", flipOptional: false, warnings: [], timers: [] },
    redmond: { compatible: true, programNo: "", programName: "", totalTimeMin: 0, workflow: "bread-3h", flipOptional: true, warnings: [], timers: [] },
  };
}

describe("screens", () => {
  it("keeps the original sections and renders all catalog cards", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    document.body.innerHTML = html.match(/<body>([\s\S]*)<script/i)?.[1] ?? "";
    for (const id of ["pantry", "catalog", "search-results", "recipe-workspace", "calibration", "cook-overlay", "sources"]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
    const recipes = Array.from({ length: 35 }, (_, i) => card(i + 1));
    const shown = renderCatalog({
      recipes,
      category: "all",
      categories: ["Базовые", "Ржаные"],
      difficulty: "all",
      favoritesOnly: false,
      canBake: false,
      favorites: [],
      query: "",
      bakeSet: null,
      recent: [],
      onOpen: () => {},
      onCategory: () => {},
      onDifficulty: () => {},
    }, {
      cats: document.getElementById("catalog-cats")!,
      diff: document.getElementById("catalog-diff")!,
      shortcuts: document.getElementById("catalog-shortcuts")!,
      grid: document.getElementById("catalog-grid")!,
      stat: document.getElementById("catalog-stat")!,
      count: document.getElementById("catalog-count")!,
    });
    expect(shown).toBe(35);
    expect(document.querySelectorAll(".catalog-card")).toHaveLength(35);
    expect(document.getElementById("btn-print")).not.toBeNull();
    expect(document.getElementById("btn-cook")).not.toBeNull();

    const progress = document.getElementById("cook-progress") as HTMLElement;
    const label = document.getElementById("cook-progress-label") as HTMLElement;
    const prev = document.getElementById("cook-prev") as HTMLButtonElement;
    renderCookSteps(document.getElementById("cook-steps")!, progress, label, prev, [
      { id: "s1", text: "Замесите", isAddin: false },
      { id: "s2", text: "Выпекайте", isAddin: false },
    ], { s1: true }, 1, 400, 700, () => {});
    expect(document.querySelectorAll(".cook-step")).toHaveLength(2);
    expect(label.textContent).toContain("Шаг 2 из 2");
    expect(prev.textContent).toContain("Назад");
  });
});

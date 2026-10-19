import type { RecipeCard } from "../types/models";
import { recipePassesCatalogFilters } from "../services/stateManager";
import { el } from "../utils/dom";
import { normalizeName } from "../utils/formatting";

export interface CatalogView {
  recipes: RecipeCard[];
  category: string;
  categories: string[];
  difficulty: string;
  favoritesOnly: boolean;
  canBake: boolean;
  favorites: string[];
  query: string;
  bakeSet: Set<string> | null;
  recent: string[];
  onOpen: (id: string) => void;
  onCategory: (id: string) => void;
  onDifficulty: (id: string) => void;
}

export function renderCatalogCategories(root: HTMLElement, view: CatalogView): void {
  root.replaceChildren();
  const cats = [{ id: "all", name: "Все" }, ...view.categories.map((name) => ({ id: name, name }))];
  for (const category of cats) {
    const on = view.category === category.id;
    const button = el("button", {
      type: "button",
      className: `chip${on ? " active" : ""}`,
      text: category.name,
      role: "tab",
      "aria-selected": on ? "true" : "false",
    });
    button.addEventListener("click", () => view.onCategory(category.id));
    root.append(button);
  }
}

export function renderDifficultyChips(root: HTMLElement, view: CatalogView): void {
  root.replaceChildren();
  const items = [
    { id: "all", name: "Любая сложность" },
    { id: "лёгкий", name: "Лёгкий" },
    { id: "средний", name: "Средний" },
  ];
  for (const item of items) {
    const on = view.difficulty === item.id;
    const button = el("button", {
      type: "button",
      className: `chip${on ? " active" : ""}`,
      text: item.name,
      "data-diff": item.id,
      "aria-pressed": on ? "true" : "false",
    });
    button.addEventListener("click", () => view.onDifficulty(item.id));
    root.append(button);
  }
}

function shortcutRow(title: string, ids: string[], recipes: Map<string, RecipeCard>, onOpen: (id: string) => void): HTMLElement {
  const row = el("div", { className: "shortcut-row chips" });
  row.append(el("span", { className: "label", text: title }));
  for (const id of ids) {
    const recipe = recipes.get(id);
    if (!recipe) continue;
    const button = el("button", { type: "button", className: "chip", text: recipe.title });
    button.addEventListener("click", () => onOpen(id));
    row.append(button);
  }
  return row;
}

export function renderCatalog(view: CatalogView, nodes: {
  cats: HTMLElement;
  diff: HTMLElement;
  shortcuts: HTMLElement;
  grid: HTMLElement;
  stat: HTMLElement;
  count: HTMLElement;
}): number {
  renderCatalogCategories(nodes.cats, view);
  renderDifficultyChips(nodes.diff, view);
  const byId = new Map(view.recipes.map((recipe) => [recipe.id, recipe]));
  nodes.shortcuts.replaceChildren();
  const recent = view.recent.filter((id) => byId.has(id)).slice(0, 6);
  if (recent.length) nodes.shortcuts.append(shortcutRow("Недавние", recent, byId, view.onOpen));
  const favs = view.favorites.filter((id) => byId.has(id));
  if (favs.length) nodes.shortcuts.append(shortcutRow("Избранное", favs, byId, view.onOpen));

  const needle = normalizeName(view.query);
  const sorted = [...view.recipes].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  const state = {
    catalogDifficulty: view.difficulty,
    catalogFavoritesOnly: view.favoritesOnly,
    catalogCanBake: view.canBake,
    favorites: view.favorites,
  };
  nodes.grid.replaceChildren();
  let shown = 0;
  for (const recipe of sorted) {
    if (!recipePassesCatalogFilters(recipe, recipe.id, state, view.category, view.bakeSet)) continue;
    if (needle) {
      const hay = normalizeName(`${recipe.title} ${recipe.specialty} ${recipe.category} ${recipe.tags.join(" ")}`);
      if (!hay.includes(needle)) continue;
    }
    const card = el("article", { className: "catalog-card", role: "listitem" });
    const meta = el("div", { className: "catalog-meta" });
    if (recipe.category) meta.append(el("span", { className: "badge badge-gold", text: recipe.category }));
    meta.append(el("span", { className: "badge badge-green", text: recipe.difficulty }));
    const open = el("button", { type: "button", className: "btn btn-primary", text: "Открыть рецепт" });
    open.addEventListener("click", () => view.onOpen(recipe.id));
    card.append(
      el("h3", { text: recipe.title }),
      meta,
      el("p", { className: "specialty", text: recipe.specialty || recipe.description }),
      open,
    );
    nodes.grid.append(card);
    shown += 1;
  }
  if (!shown) {
    nodes.grid.append(el("p", {
      className: "pantry-empty",
      text: view.query
        ? `Ничего не найдено по запросу «${view.query}».`
        : "В этой категории пока нет рецептов.",
    }));
  }
  nodes.stat.textContent = `Показано: ${shown} из ${view.recipes.length}`;
  nodes.count.textContent = `${view.recipes.length} видов`;
  return shown;
}

import type { Category, Ingredient } from "../types/models";
import { el } from "../utils/dom";
import { ingredientVisible } from "../services/stateManager";

export function renderPantryCategories(
  root: HTMLElement,
  categories: Category[],
  selected: string,
  onSelect: (id: string) => void,
): void {
  root.replaceChildren();
  for (const category of categories) {
    const on = category.id === selected;
    const button = el("button", {
      type: "button",
      className: `chip${on ? " active" : ""}`,
      text: category.name,
      role: "tab",
      "aria-selected": on ? "true" : "false",
    });
    button.addEventListener("click", () => onSelect(category.id));
    root.append(button);
  }
}

export function renderPantryList(
  root: HTMLElement,
  ingredients: Ingredient[],
  pantry: Record<string, boolean>,
  category: string,
  query: string,
  categoryName: (id: string) => string,
): number {
  root.replaceChildren();
  let shown = 0;
  for (const ingredient of ingredients) {
    if (!ingredientVisible(ingredient, category, query)) continue;
    const checked = !!pantry[ingredient.id];
    const row = el("label", { className: `check-row${checked ? " checked" : ""}` });
    const box = el("input", { type: "checkbox", "data-ing-id": ingredient.id });
    box.checked = checked;
    row.append(
      box,
      el("span", {}, [
        el("span", { className: "name", text: ingredient.name }),
        el("span", { className: "meta", text: ` · ${categoryName(ingredient.category)}` }),
      ]),
    );
    root.append(row);
    shown += 1;
  }
  if (!shown) {
    root.append(el("p", {
      className: "pantry-empty",
      text: query
        ? `Ничего не найдено по запросу «${query}». Сбросьте фильтр или измените поиск.`
        : "В этой категории пока нет продуктов.",
    }));
  }
  return shown;
}

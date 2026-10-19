import type { SearchHit } from "../types/models";
import { el } from "../utils/dom";

function confidenceBadge(value: string): HTMLElement {
  if (value === "official") return el("span", { className: "badge badge-green", text: "🟢 Официально" });
  if (value === "verified-adaptation") return el("span", { className: "badge badge-green", text: "🟢 Проверенная адаптация" });
  return el("span", { className: "badge badge-gold", text: "🟠 Экспериментально" });
}

export function renderResults(
  summary: HTMLElement,
  panasonic: HTMLElement,
  redmond: HTMLElement,
  tabs: HTMLElement[],
  hits: SearchHit[],
  tab: "panasonic" | "redmond",
  onOpen: (recipeId: string, machineId: string) => void,
): void {
  const pan = hits.filter((hit) => hit.machineKey === "panasonic");
  const red = hits.filter((hit) => hit.machineKey === "redmond");
  summary.textContent = `Найдено: ${pan.length} для Panasonic, ${red.length} для REDMOND`;
  fill(panasonic, pan, onOpen);
  fill(redmond, red, onOpen);
  panasonic.classList.toggle("hidden", tab !== "panasonic");
  redmond.classList.toggle("hidden", tab !== "redmond");
  for (const button of tabs) {
    const on = button.getAttribute("data-tab") === tab;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.setAttribute("role", "tab");
  }
}

function fill(root: HTMLElement, items: SearchHit[], onOpen: (recipeId: string, machineId: string) => void): void {
  root.replaceChildren();
  if (!items.length) {
    root.append(el("div", {
      className: "alert alert-info",
      text: "Нет подходящих рецептов для этой техники. Добавьте продукты или включите «не хватает ≤2».",
    }));
    return;
  }
  for (const hit of items) {
    const card = el("div", { className: "recipe-card" });
    const meta = el("div", { className: "recipe-meta" });
    meta.append(
      el("span", {
        className: `badge ${hit.status === "exact" ? "badge-green" : "badge-gold"}`,
        text: hit.status === "exact" ? "Точное совпадение" : `Не хватает ${hit.missing.length}`,
      }),
      confidenceBadge(hit.sourceConfidence),
      el("span", { className: "badge badge-muted", text: hit.programLabel }),
      el("span", { className: "badge badge-muted", text: `~${hit.timeMin} мин` }),
      el("span", { className: "badge badge-muted", text: hit.difficulty }),
    );
    card.append(el("h3", { text: hit.title }), meta);
    if (hit.missing.length) {
      card.append(el("div", { className: "missing", text: `Не хватает: ${hit.missingNames.join(", ")}` }));
    }
    const about = el("p", { text: hit.specialty || hit.description });
    about.style.fontSize = "0.85rem";
    about.style.color = "var(--text-muted)";
    about.style.margin = "0";
    const open = el("button", { type: "button", className: "btn btn-primary", text: "Открыть рецепт" });
    open.addEventListener("click", () => onOpen(hit.recipeId, hit.machineId));
    card.append(about, open);
    root.append(card);
  }
}

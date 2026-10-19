import type { FilledStep, ShoppingRow } from "../types/models";
import { el } from "../utils/dom";

export function renderScale(flour: number): void {
  const range = document.getElementById("flour-range") as HTMLInputElement | null;
  const input = document.getElementById("flour-input") as HTMLInputElement | null;
  const display = document.getElementById("flour-display");
  if (range) range.value = String(flour);
  if (input) input.value = String(flour);
  if (display) display.textContent = String(flour);
}

export function renderSteps(list: HTMLOListElement, steps: FilledStep[], warnings: string[]): void {
  list.replaceChildren();
  for (const step of steps) {
    const item = el("li", { text: step.text });
    item.style.marginBottom = "0.55rem";
    if (step.isAddin) item.style.color = "var(--green-dark)";
    list.append(item);
  }
  for (const warning of warnings) {
    const item = el("li", { text: `⚠ ${warning}` });
    item.style.color = "var(--warn)";
    item.style.marginBottom = "0.55rem";
    list.append(item);
  }
}

export function renderShopping(panel: HTMLElement, rows: ShoppingRow[], onCheck: (id: string) => void): void {
  panel.replaceChildren();
  if (!rows.length) {
    panel.append(el("p", { className: "stat-line", text: "Для этого рецепта всё есть дома." }));
    return;
  }
  panel.append(el("p", { className: "stat-line", text: "Не хватает — отметьте, когда купите:" }));
  for (const row of rows) {
    const line = el("label", { className: "shopping-row" });
    const box = el("input", { type: "checkbox" });
    box.addEventListener("change", () => {
      if (box.checked) onCheck(row.id);
    });
    line.append(box, el("span", { text: `${row.name} — ${row.gramsText} г` }));
    panel.append(line);
  }
}

export function copyName(name: string, isAddin: boolean): string {
  return isAddin ? name.replace(/ \(по вкусу\)$/, "") : name;
}

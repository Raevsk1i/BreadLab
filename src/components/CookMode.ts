import type { FilledStep } from "../types/models";
import { el } from "../utils/dom";
import { roundInt } from "../utils/formatting";

export function renderCookSteps(
  root: HTMLElement,
  progress: HTMLElement,
  label: HTMLElement,
  prev: HTMLButtonElement,
  steps: FilledStep[],
  done: Record<string, boolean>,
  index: number,
  flour: number,
  dough: number,
  onToggle: (id: string, checked: boolean) => void,
): void {
  root.replaceChildren();
  let doneCount = 0;
  steps.forEach((step, i) => {
    const checked = !!done[step.id];
    if (checked) doneCount += 1;
    const row = el("div", {
      className: `cook-step${checked ? " done" : ""}${i === index ? " current" : ""}`,
    });
    const box = el("input", { type: "checkbox" });
    box.checked = checked;
    box.addEventListener("change", () => onToggle(step.id, box.checked));
    const body = el("div");
    body.append(el("strong", { text: `Шаг ${i + 1}. ` }), document.createTextNode(step.text));
    if (i === 0) {
      const meta = el("div", {
        className: "meta",
        text: `Текущий масштаб: ${flour} г муки, масса теста ≈ ${roundInt(dough)} г.`,
      });
      meta.style.fontSize = "0.8rem";
      meta.style.color = "var(--text-soft)";
      meta.style.marginTop = "0.35rem";
      body.append(meta);
    }
    row.append(box, body);
    root.append(row);
  });
  const pct = steps.length ? (doneCount / steps.length) * 100 : 0;
  progress.style.width = `${pct}%`;
  label.textContent = `Шаг ${Math.min(index + 1, steps.length)} из ${steps.length} · выполнено ${doneCount}`;
  prev.textContent = index <= 0 ? "← К рецепту" : "← Назад";
}

export function cookFocusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
    .filter((node) => !(node as HTMLButtonElement).disabled && node.offsetParent !== null);
}

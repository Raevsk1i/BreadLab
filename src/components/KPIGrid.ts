import type { Calculation, Warning } from "../types/models";
import { el } from "../utils/dom";
import { roundInt } from "../utils/formatting";

export function renderWarnings(root: HTMLElement, warnings: Warning[]): void {
  root.replaceChildren();
  for (const warning of warnings) {
    if (warning.code.startsWith("bowl_") && warning.level === "ok") continue;
    const cls = warning.level === "danger" ? "alert-danger" : warning.level === "ok" ? "alert-ok" : "alert-warn";
    root.append(el("div", { className: `alert ${cls}`, text: warning.message }));
  }
}

export function renderKpis(root: HTMLElement, calc: Calculation): void {
  root.replaceChildren();
  const kpi = (label: string, value: string, hint: string, level = "") => {
    const card = el("div", { className: `kpi${level ? ` ${level}` : ""}` });
    card.append(
      el("div", { className: "label", text: label }),
      el("div", { className: "value", text: value }),
      el("div", { className: "hint", text: hint }),
    );
    root.append(card);
    return card;
  };
  kpi("Масса муки", `${roundInt(calc.targetFlourG)} г`, `База рецепта ${roundInt(calc.baseFlourG)} г`);
  kpi("Гидратация", `${calc.hydrationPct.toFixed(1)} %`, "Без учёта масел · оценка");
  kpi("Вес теста", `${roundInt(calc.doughMassG)} г`, "Включая добавки по вкусу");
  kpi(
    "Пиковый объём",
    `${roundInt(calc.proofedMinMl)}–${roundInt(calc.proofedMaxMl)} мл`,
    `Расчётный · ${calc.physicsConfidence}`,
  );
  kpi("Мин. объём чаши", `≥ ${roundInt(calc.recommendedBowlMl)} мл`, `Пик × ${calc.headroomFactor}`);
  kpi(
    "Вес буханки",
    `≈ ${roundInt(calc.finishedMinG)}–${roundInt(calc.finishedMaxG)} г`,
    `Упёк ${roundInt(calc.bakeLossMinPct)}–${roundInt(calc.bakeLossMaxPct)}%`,
    calc.calibrated ? "ok" : "",
  );
  if (calc.machineId === "redmond_rmc_m92s" && calc.fillPct != null && calc.fillLevel) {
    const hint = calc.fillLevel === "ok" ? "Комфортно" : calc.fillLevel === "warn" ? "Впритык" : "Риск побега";
    const card = kpi("Заполнение чаши", `${roundInt(calc.fillPct)} %`, hint, calc.fillLevel);
    const bar = el("div", { className: "fill-bar" });
    const span = el("span");
    span.style.width = `${calc.fillPct}%`;
    span.style.background = calc.fillLevel === "danger" ? "var(--danger)" : calc.fillLevel === "warn" ? "var(--gold)" : "var(--green)";
    bar.append(span);
    card.append(bar);
  } else {
    const disp = calc.dispenserG;
    const level = disp > 150 ? "danger" : disp > 135 ? "warn" : "ok";
    kpi("Диспенсер добавок", `${roundInt(disp)} / 150 г`, disp > 150 ? "Превышен лимит" : "Сухие добавки", level);
  }
}

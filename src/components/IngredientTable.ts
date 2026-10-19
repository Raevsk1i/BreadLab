import type { DisplayRow } from "../types/models";
import { el } from "../utils/dom";

export function renderIngredientTable(
  body: HTMLElement,
  mobile: HTMLElement,
  rows: DisplayRow[],
  expanded: string | null,
  onToggle: (id: string) => void,
): void {
  body.replaceChildren();
  mobile.replaceChildren();
  rows.forEach((row, index) => {
    const detailId = `d-${index}`;
    const tr = el("tr", { className: "expandable" });
    tr.append(
      el("td", { text: row.name }),
      el("td", { text: `${row.gramsText} г` }),
      el("td", { text: `${row.bakerPctText}%` }),
      el("td", { text: row.role || "—" }),
      el("td", { text: row.placementLabel }),
      el("td", { text: row.stageLabel }),
    );
    tr.addEventListener("click", () => onToggle(detailId));
    body.append(tr);
    if (expanded === detailId) {
      const extra = el("tr");
      const cell = el("td");
      cell.colSpan = 6;
      cell.append(detail(row));
      extra.append(cell);
      body.append(extra);
    }
    const card = el("div", { className: "ing-card" });
    const meta = el("div", { className: "row-meta" }, [
      el("span", { text: `${row.gramsText} г` }),
      el("span", { text: `${row.bakerPctText}%` }),
      el("span", { text: row.placementLabel }),
    ]);
    const button = el("button", { type: "button", className: "btn btn-ghost", text: "Подробнее" });
    const wrap = el("div", { className: "hidden" });
    wrap.append(detail(row));
    button.addEventListener("click", () => wrap.classList.toggle("hidden"));
    card.append(el("h4", { text: row.name }), meta, button, wrap);
    mobile.append(card);
  });
}

function placeText(code: string, machine: "panasonic" | "redmond"): string {
  if (machine === "redmond") {
    if (code === "bowl") return "В чашу";
    if (code === "manual") return "Вручную при замесе";
    return code || "Вручную";
  }
  const labels: Record<string, string> = {
    pan: "В чашу",
    yeastDispenser: "Диспенсер дрожжей",
    raisinNutDispenser: "Диспенсер добавок",
    manualAdd: "Вручную / по сигналу",
    notApplicable: "—",
  };
  return labels[code] || code || "—";
}

function detail(row: DisplayRow): HTMLElement {
  const dl = el("dl", { className: "ing-detail" });
  const item = (title: string, text: string) => {
    dl.append(el("dt", { text: title }), el("dd", { text }));
  };
  item("Зачем добавляется?", row.detailedRole || row.effect || "—");
  item("Что даёт хлебу?", row.role || "—");
  item("Если уменьшить?", row.decreaseEffect || "—");
  item("Если увеличить?", row.increaseEffect || "—");
  item("Чем заменить?", row.substitutions.length ? row.substitutions.join("; ") : "Прямой замены нет / не рекомендуется");
  item("Куда в Panasonic?", placeText(row.placementPanasonic, "panasonic"));
  item("Как в REDMOND?", placeText(row.placementRedmond, "redmond"));
  if (row.gramsRangeText && row.pctRange) {
    item("Рекомендуемый диапазон", `${row.gramsRangeText} г (${row.pctRange[0]}–${row.pctRange[1]}% от муки)`);
  }
  if (row.warnings.length) item("Предупреждения", row.warnings.join(" "));
  return dl;
}

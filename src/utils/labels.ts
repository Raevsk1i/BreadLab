export function placementLabel(code: string | undefined, machineKey: string): string {
  const mapP: Record<string, string> = {
    pan: "В чашу",
    yeastDispenser: "Диспенсер дрожжей",
    raisinNutDispenser: "Диспенсер добавок",
    manualAdd: "Вручную / по сигналу",
    notApplicable: "—",
  };
  const mapR: Record<string, string> = {
    bowl: "В чашу",
    manual: "Вручную при замесе",
  };
  if (machineKey === "redmond") return mapR[code ?? ""] || code || "Вручную";
  return mapP[code ?? ""] || code || "—";
}

export function stageLabel(stage: string | undefined): string {
  const m: Record<string, string> = {
    mainMix: "Замес",
    dispenser: "Диспенсер",
    scald: "Заварка",
    addins: "Добавки",
    manual: "Вручную",
    topping: "Посыпка",
  };
  return m[stage ?? ""] || stage || "—";
}

export const CATALOG_CATEGORY_ORDER = [
  "Базовые",
  "Европейские",
  "Цельнозерновые",
  "Смесовые",
  "Ржаные",
  "Добавки",
  "Кисломолочные",
  "Сладкие",
  "Семена",
  "Без дрожжей",
  "Без глютена",
];

export function confidenceBadgeText(c: string): { cls: string; text: string } {
  if (c === "official") return { cls: "badge badge-green", text: "🟢 Официально" };
  if (c === "verified-adaptation")
    return { cls: "badge badge-green", text: "🟢 Проверенная адаптация" };
  return { cls: "badge badge-gold", text: "🟠 Экспериментально" };
}

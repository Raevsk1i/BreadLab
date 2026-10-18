const FINE = new Set([
  "salt",
  "yeast",
  "coriander",
  "caraway",
  "garlic_dry",
  "vanilla",
  "soda",
  "rosemary",
]);

export function roundPresent(
  ingredientId: string,
  value: number,
  fineAddin = false,
): number {
  if (FINE.has(ingredientId) || fineAddin) {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value);
}

export function formatGrams(
  ingredientId: string,
  value: number,
  fineAddin = false,
): string {
  const r = roundPresent(ingredientId, value, fineAddin);
  return Math.abs(r - Math.round(r)) < 1e-9 ? String(Math.round(r)) : r.toFixed(1);
}

export function formatTimer(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  wait: number,
): (...args: Args) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
}

export function confidenceBadgeClass(conf: string): string {
  if (conf === "high") return "badge-green";
  if (conf === "low") return "badge-gold";
  return "badge-muted";
}

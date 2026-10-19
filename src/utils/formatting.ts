export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

export function formatClock(ms: number): string {
  const sec = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function roundInt(value: number): string {
  return String(Math.round(value));
}

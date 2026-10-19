/** Frontend-side import shape guard (mirrors Rust is_breadlab_import_payload). */
export function isBreadLabImportPayload(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (obj.app === "BreadLab") return true;
  const keys = [
    "pantry",
    "favorites",
    "calibrations",
    "recent",
    "enabledTasteAddins",
    "checklist",
  ];
  return keys.some((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

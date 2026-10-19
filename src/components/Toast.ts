import { el } from "../utils/dom";

export type ToastKind = "ok" | "err" | "warn";

export function toast(message: string, kind?: ToastKind): void {
  const wrap = document.getElementById("toasts");
  if (!wrap) return;
  const cls = kind === "ok" ? "toast toast--ok" : kind === "err" ? "toast toast--err" : kind === "warn" ? "toast toast--warn" : "toast";
  const node = el("div", { className: cls, text: message, role: "status" });
  wrap.append(node);
  window.setTimeout(() => node.remove(), 3200);
}

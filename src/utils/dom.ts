export function $(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel);
}

export function $all(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel));
}

type Attrs = Record<string, string | boolean | number | null | undefined | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: (Node | string | null | undefined)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className" && v != null) node.className = String(v);
      else if (k === "text" && v != null) node.textContent = String(v);
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "checked" || k === "disabled" || k === "selected") {
        (node as unknown as Record<string, boolean>)[k] = !!v;
        if (v) node.setAttribute(k, "");
      } else if (v != null && typeof v !== "function") {
        node.setAttribute(k, String(v));
      }
    }
  }
  if (children) {
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return node;
}

export function toast(message: string, kind: "ok" | "err" | "warn" = "ok"): void {
  const wrap = $("#toasts");
  if (!wrap) return;
  const cls =
    kind === "ok" ? "toast toast--ok" : kind === "err" ? "toast toast--err" : "toast toast--warn";
  const node = el("div", { className: cls, text: message, role: "status" });
  wrap.appendChild(node);
  setTimeout(() => {
    if (node.parentNode) node.parentNode.removeChild(node);
  }, 3200);
}

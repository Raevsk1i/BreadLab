import type { AddinPreview } from "../types/models";
import { el } from "../utils/dom";

export function renderAddins(
  root: HTMLElement,
  previews: AddinPreview[],
  enabled: Record<string, boolean>,
  flour: number,
  onToggle: (id: string, on: boolean) => void,
): void {
  root.replaceChildren();
  for (const addin of previews) {
    const on = !!enabled[addin.id];
    const card = el("div", { className: `addin-card${on ? " enabled" : ""}` });
    const label = el("label");
    const box = el("input", { type: "checkbox" });
    box.checked = on;
    box.addEventListener("change", () => onToggle(addin.id, box.checked));
    const body = el("span");
    body.append(
      el("span", { className: "name", text: addin.name }),
      document.createElement("br"),
      el("span", {
        className: "meta",
        text: `${addin.role} · ${addin.pctRange[0]}–${addin.pctRange[1]}% · для ${flour} г: ${addin.minText}–${addin.maxText} г (по умолч. ${addin.gramsText} г)`,
      }),
    );
    if (addin.warnings.length) {
      body.append(document.createElement("br"), el("span", { className: "meta", text: `⚠ ${addin.warnings.join(" ")}` }));
    }
    label.append(box, body);
    card.append(label);
    root.append(card);
  }
}

import type { Machine, RecipeCard } from "../types/models";
import { el } from "../utils/dom";

export function renderMachinePicker(
  root: HTMLElement,
  recipe: RecipeCard,
  machines: Record<string, Machine>,
  selectedId: string,
  onSelect: (id: string) => void,
): void {
  root.replaceChildren();
  const options = [
    { key: "panasonic" as const, id: "panasonic_sd_yr2540hts" },
    { key: "redmond" as const, id: "redmond_rmc_m92s" },
  ];
  for (const option of options) {
    const profile = recipe[option.key];
    const machine = machines[option.id];
    const button = el("button", {
      type: "button",
      className: `machine-pick${selectedId === option.id ? " selected" : ""}`,
    });
    if (!profile.compatible) button.disabled = true;
    let line = "Несовместим";
    if (profile.compatible && option.key === "panasonic") {
      line = `Программа №${profile.programNo} «${profile.programName}» · ${profile.totalTimeMin || "?"} мин`;
    } else if (profile.compatible) {
      line = `${profile.workflow}${profile.flipOptional ? " · переворот по желанию" : ""}`;
    }
    button.append(
      el("strong", { text: machine?.name ?? option.id }),
      el("small", { text: line }),
    );
    if (profile.compatible) button.addEventListener("click", () => onSelect(option.id));
    root.append(button);
  }
}

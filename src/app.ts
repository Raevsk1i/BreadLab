import type {
  CatalogEntry,
  Ingredient,
  Machine,
  Meta,
  Recipe,
  RecipeCalculation,
  TasteAddin,
} from "./types/recipe";
import { stateManager } from "./services/stateManager";
import * as api from "./services/tauriApi";
import { timerService, type CookRuntime } from "./services/timerService";
import { $, $all, el, toast } from "./utils/dom";
import { debounce, formatGrams } from "./utils/formatting";
import {
  CATALOG_CATEGORY_ORDER,
  confidenceBadgeText,
  placementLabel,
  stageLabel,
} from "./utils/labels";

const sm = stateManager;
const calcGate = api.createRequestGate();

let meta: Meta;
let ingredients: Record<string, Ingredient> = {};
let machines: Record<string, Machine> = {};
let addins: Record<string, TasteAddin> = {};
let catalog: CatalogEntry[] = [];
let recipesCache: Record<string, Recipe> = {};
let lastCalc: RecipeCalculation | null = null;
let cookRuntime: CookRuntime | null = null;
let cookReturnFocus: HTMLElement | null = null;
let sortedIngredientIds: string[] | null = null;

function pantrySet(): Set<string> {
  return new Set(Object.keys(sm.state.pantry).filter((id) => sm.state.pantry[id]));
}

function isAlwaysAvailable(id: string): boolean {
  const ing = ingredients[id];
  if (ing?.hideFromPantry) return true;
  return meta.alwaysAvailable.includes(id);
}

function getSortedIngredientIds(): string[] {
  if (!sortedIngredientIds) {
    sortedIngredientIds = Object.keys(ingredients).sort((a, b) =>
      ingredients[a].name.localeCompare(ingredients[b].name, "ru"),
    );
  }
  return sortedIngredientIds;
}

async function ensureRecipe(id: string): Promise<Recipe> {
  if (!recipesCache[id]) recipesCache[id] = await api.getRecipe(id);
  return recipesCache[id];
}

function enabledAddinMap(): Record<string, boolean> {
  const rid = sm.state.selectedRecipeId;
  if (rid && sm.state.addinsByRecipe[rid]) return sm.state.addinsByRecipe[rid];
  return sm.state.enabledTasteAddins;
}

function getCalibrationForCurrent() {
  const list = sm.state.calibrations.filter(
    (c) => c.recipeId === sm.state.selectedRecipeId && c.machineId === sm.state.selectedMachineId,
  );
  return list.length ? list[list.length - 1] : null;
}

function fineAddin(id: string): boolean {
  const a = addins[id];
  return !!a && a.suggestedBakerPctRange[1] < 2;
}

/* ---------- Pantry ---------- */
function renderPantryCats(): void {
  const wrap = $("#pantry-cats");
  if (!wrap) return;
  wrap.textContent = "";
  for (const c of meta.categories) {
    const selected = sm.state.pantryCategory === c.id;
    const b = el("button", {
      type: "button",
      className: "chip" + (selected ? " active" : ""),
      text: c.name,
      role: "tab",
      "aria-selected": selected ? "true" : "false",
    });
    b.addEventListener("click", () => {
      sm.state.pantryCategory = c.id;
      renderPantry();
    });
    wrap.appendChild(b);
  }
}

function renderPantry(): void {
  const list = $("#pantry-list");
  if (!list) return;
  list.textContent = "";
  const q = sm.state.pantryQuery.trim().toLowerCase().replace(/ё/g, "е");
  for (const id of getSortedIngredientIds()) {
    const ing = ingredients[id];
    if (ing.hideFromPantry) continue;
    if (sm.state.pantryCategory !== "all" && ing.category !== sm.state.pantryCategory) continue;
    if (q) {
      const hay = [ing.name, ...(ing.aliases || [])].join(" ").toLowerCase().replace(/ё/g, "е");
      if (!hay.includes(q)) continue;
    }
    const checked = !!sm.state.pantry[id];
    const label = el("label", { className: "check-row" + (checked ? " on" : "") });
    const cb = el("input", { type: "checkbox" }) as HTMLInputElement;
    cb.checked = checked;
    cb.dataset.id = id;
    cb.addEventListener("change", () => {
      sm.state.pantry[id] = cb.checked;
      sm.schedulePersist();
      label.classList.toggle("on", cb.checked);
      updatePantryStat();
      if (sm.state.catalogCanBake) void renderCatalog();
    });
    label.appendChild(cb);
    const span = el("span");
    span.appendChild(el("span", { className: "name", text: ing.name }));
    label.appendChild(span);
    list.appendChild(label);
  }
  updatePantryStat();
}

function updatePantryStat(): void {
  const n = Object.values(sm.state.pantry).filter(Boolean).length;
  const elStat = $("#pantry-stat");
  if (elStat) elStat.textContent = `Выбрано: ${n}`;
}

/* ---------- Catalog ---------- */
function setCatalogOpen(open: boolean): void {
  const d = $("#catalog-details") as HTMLDetailsElement | null;
  if (d) d.open = open;
  sm.state.catalogOpen = open;
  sm.schedulePersist();
}

function renderCatalogCats(cats: string[]): void {
  const wrap = $("#catalog-cats");
  if (!wrap) return;
  wrap.textContent = "";
  for (const name of ["all", ...cats]) {
    const label = name === "all" ? "Все" : name;
    const selected = sm.state.catalogCategory === name;
    const b = el("button", {
      type: "button",
      className: "chip" + (selected ? " active" : ""),
      text: label,
      role: "tab",
      "aria-selected": selected ? "true" : "false",
    });
    b.addEventListener("click", () => {
      sm.state.catalogCategory = name;
      void renderCatalog();
    });
    wrap.appendChild(b);
  }
}

function renderDifficultyChips(): void {
  const wrap = $("#catalog-diff");
  if (!wrap) return;
  wrap.textContent = "";
  for (const d of ["all", "лёгкий", "средний", "сложный"]) {
    const label = d === "all" ? "Любая сложность" : d;
    const selected = sm.state.catalogDifficulty === d;
    const b = el("button", {
      type: "button",
      className: "chip" + (selected ? " active" : ""),
      text: label,
    });
    b.addEventListener("click", () => {
      sm.state.catalogDifficulty = d;
      sm.schedulePersist();
      void renderCatalog();
    });
    wrap.appendChild(b);
  }
}

async function renderCatalogShortcuts(): Promise<void> {
  const wrap = $("#catalog-shortcuts");
  if (!wrap) return;
  wrap.textContent = "";
  if (!sm.state.recent.length) return;
  wrap.appendChild(el("p", { className: "stat-line", text: "Недавно:" }));
  const row = el("div", { className: "chips" });
  for (const id of sm.state.recent.slice(0, 6)) {
    const entry = catalog.find((c) => c.id === id);
    if (!entry) continue;
    const b = el("button", { type: "button", className: "chip", text: entry.title });
    b.addEventListener("click", () => {
      void openRecipe(id, sm.state.defaultMachineId);
    });
    row.appendChild(b);
  }
  wrap.appendChild(row);
}

async function renderCatalog(): Promise<void> {
  const grid = $("#catalog-grid");
  if (!grid) return;
  grid.textContent = "";
  const q = sm.state.catalogQuery.trim().toLowerCase().replace(/ё/g, "е");
  let items = catalog.slice();

  if (sm.state.catalogCategory !== "all") {
    items = items.filter((c) => c.category === sm.state.catalogCategory);
  }
  if (sm.state.catalogDifficulty !== "all") {
    items = items.filter((c) => c.difficulty === sm.state.catalogDifficulty);
  }
  if (sm.state.catalogFavoritesOnly) {
    items = items.filter((c) => sm.state.favorites.includes(c.id));
  }
  if (q) {
    items = items.filter((c) => {
      const hay = `${c.title} ${c.specialty} ${c.description} ${c.tags.join(" ")}`
        .toLowerCase()
        .replace(/ё/g, "е");
      return hay.includes(q);
    });
  }

  if (sm.state.catalogCanBake) {
    const matches = await api.searchRecipes(sm.state.pantry, sm.state.nearMatchOn);
    const ok = new Set(matches.filter((m) => m.status === "exact").map((m) => m.recipeId));
    items = items.filter((c) => ok.has(c.id));
  }

  items.sort((a, b) => {
    const ai = CATALOG_CATEGORY_ORDER.indexOf(a.category);
    const bi = CATALOG_CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    return a.title.localeCompare(b.title, "ru");
  });

  const count = $("#catalog-count");
  if (count) count.textContent = `${catalog.length} видов`;
  const stat = $("#catalog-stat");
  if (stat) stat.textContent = `Показано: ${items.length}`;

  for (const c of items) {
    const card = el("article", { className: "catalog-card", role: "listitem" });
    const head = el("div", { className: "catalog-card-head" });
    head.appendChild(el("h3", { text: c.title }));
    const fav = sm.state.favorites.includes(c.id);
    const favBtn = el("button", {
      type: "button",
      className: "btn btn-ghost",
      text: fav ? "★" : "☆",
      title: "Избранное",
    });
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(c.id);
      void renderCatalog();
    });
    head.appendChild(favBtn);
    card.appendChild(head);
    const metaRow = el("div", { className: "meta-row" });
    metaRow.appendChild(el("span", { className: "badge badge-muted", text: c.category }));
    metaRow.appendChild(el("span", { className: "badge badge-muted", text: c.difficulty }));
    metaRow.appendChild(
      el("span", {
        className: "badge badge-muted",
        text: `№${c.panasonicProgramNo}`,
      }),
    );
    card.appendChild(metaRow);
    card.appendChild(
      el("p", {
        text: c.specialty || c.description,
      }),
    );
    const btn = el("button", { type: "button", className: "btn btn-primary", text: "Открыть" });
    btn.addEventListener("click", () => {
      void openRecipe(c.id, sm.state.defaultMachineId, { fromCatalog: true });
    });
    card.appendChild(btn);
    grid.appendChild(card);
  }
  await renderCatalogShortcuts();
}

function toggleFavorite(id: string): void {
  const i = sm.state.favorites.indexOf(id);
  if (i >= 0) sm.state.favorites.splice(i, 1);
  else sm.state.favorites.push(id);
  sm.schedulePersist();
  updateFavoriteBtn();
}

/* ---------- Search results ---------- */
async function runSearch(): Promise<void> {
  const nearEl = $("#opt-near") as HTMLInputElement | null;
  if (nearEl) sm.state.nearMatchOn = nearEl.checked;
  sm.state.results = await api.searchRecipes(sm.state.pantry, sm.state.nearMatchOn);
  sm.state.searchRan = true;
  sm.schedulePersist();
  renderResults();
  $("#search-results")?.classList.remove("hidden");
  $("#search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderResults(): void {
  const summary = $("#results-summary");
  const exact = sm.state.results.filter((m) => m.status === "exact").length;
  const near = sm.state.results.filter((m) => m.status === "near").length;
  if (summary) {
    summary.textContent = `Найдено: ${exact} точных · ${near} близких (по машинам)`;
  }
  fillResults("panasonic");
  fillResults("redmond");
  $all(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === sm.state.resultsTab);
  });
  $("#results-panasonic")?.classList.toggle("hidden", sm.state.resultsTab !== "panasonic");
  $("#results-redmond")?.classList.toggle("hidden", sm.state.resultsTab !== "redmond");
}

function fillResults(machineKey: string): void {
  const container = $(`#results-${machineKey}`);
  if (!container) return;
  container.textContent = "";
  const list = sm.state.results.filter((m) => m.machineKey === machineKey);
  if (!list.length) {
    container.appendChild(el("p", { className: "stat-line", text: "Нет подходящих рецептов." }));
    return;
  }
  for (const m of list) {
    const card = el("article", { className: "result-card" });
    card.appendChild(el("h3", { text: m.title }));
    const metaRow = el("div", { className: "meta-row" });
    metaRow.appendChild(
      el("span", {
        className: "badge " + (m.status === "exact" ? "badge-green" : "badge-gold"),
        text: m.status === "exact" ? "Точное совпадение" : `Не хватает ${m.missing.length}`,
      }),
    );
    metaRow.appendChild(el("span", { className: "badge badge-muted", text: m.programLabel }));
    metaRow.appendChild(el("span", { className: "badge badge-muted", text: `~${m.timeMin} мин` }));
    metaRow.appendChild(el("span", { className: "badge badge-muted", text: m.difficulty }));
    card.appendChild(metaRow);
    if (m.missing.length) {
      card.appendChild(
        el("div", {
          className: "missing",
          text: "Не хватает: " + m.missingNames.join(", "),
        }),
      );
    }
    const p = el("p", { text: m.description });
    p.style.fontSize = "0.85rem";
    p.style.color = "var(--text-muted)";
    card.appendChild(p);
    const btn = el("button", { type: "button", className: "btn btn-primary", text: "Открыть рецепт" });
    btn.addEventListener("click", () => {
      void openRecipe(m.recipeId, m.machineId);
    });
    card.appendChild(btn);
    container.appendChild(card);
  }
}

/* ---------- Workspace ---------- */
async function openRecipe(
  recipeId: string,
  machineId?: string | null,
  opts: { keepFlour?: boolean; fromCatalog?: boolean } = {},
): Promise<void> {
  const recipe = await ensureRecipe(recipeId);
  sm.state.selectedRecipeId = recipeId;
  sm.state.selectedMachineId =
    machineId || sm.state.defaultMachineId || "panasonic_sd_yr2540hts";
  if (!opts.keepFlour) {
    sm.state.targetFlourG = Math.min(600, Math.max(300, recipe.baseTotalFlourG));
  }
  sm.syncAddinsFor(recipeId);
  sm.state.expandedIng = null;
  sm.state.recent = [recipeId, ...sm.state.recent.filter((x) => x !== recipeId)].slice(0, 10);
  sm.schedulePersist();
  if (opts.fromCatalog) setCatalogOpen(false);
  $("#recipe-workspace")?.classList.remove("hidden");
  $("#calibration")?.classList.remove("hidden");
  await renderWorkspace();
  $("#recipe-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function fetchCalc(): Promise<RecipeCalculation | null> {
  if (!sm.state.selectedRecipeId || !sm.state.selectedMachineId) return null;
  const v = calcGate.next();
  const cal = getCalibrationForCurrent();
  const result = await api.calculateRecipe({
    recipeId: sm.state.selectedRecipeId,
    machineId: sm.state.selectedMachineId,
    targetFlourG: sm.state.targetFlourG,
    enabledTasteAddins: enabledAddinMap(),
    calibration: cal,
  });
  if (!calcGate.isCurrent(v)) return lastCalc;
  lastCalc = result;
  return result;
}

async function renderWorkspace(): Promise<void> {
  if (!sm.state.selectedRecipeId) return;
  const recipe = await ensureRecipe(sm.state.selectedRecipeId);
  sm.syncAddinsFor(recipe.id);
  const title = $("#ws-title");
  const desc = $("#ws-desc");
  if (title) title.textContent = recipe.title;
  if (desc) {
    desc.textContent =
      (recipe.specialty || recipe.description || "") +
      (recipe.category ? ` · ${recipe.category}` : "") +
      (recipe.sourceNotes ? ` · ${recipe.sourceNotes}` : "");
  }
  renderMachinePicker(recipe);
  renderScaleControls();
  const calc = await fetchCalc();
  if (!calc) return;
  renderKPIs(recipe, calc);
  renderIngredientTable(recipe, calc);
  renderAddins(recipe, calc);
  renderSteps(recipe, calc);
  renderShoppingPanel(calc);
  updateFavoriteBtn();
}

function renderMachinePicker(recipe: Recipe): void {
  const wrap = $("#machine-picker");
  if (!wrap) return;
  wrap.textContent = "";
  const picks: { id: string; compatible: boolean; line2: string }[] = [
    {
      id: "panasonic_sd_yr2540hts",
      compatible: recipe.machineProfiles.panasonic.compatible,
      line2: `Программа №${recipe.machineProfiles.panasonic.programNo} «${recipe.machineProfiles.panasonic.programName}» · ${recipe.machineProfiles.panasonic.totalTimeMin || "?"} мин`,
    },
    {
      id: "redmond_rmc_m92s",
      compatible: recipe.machineProfiles.redmond.compatible,
      line2:
        (recipe.machineProfiles.redmond.workflow || "") +
        (recipe.machineProfiles.redmond.flip?.optional ? " · переворот по желанию" : ""),
    },
  ];
  for (const m of picks) {
    const machine = machines[m.id];
    const btn = el("button", {
      type: "button",
      className: "machine-pick" + (sm.state.selectedMachineId === m.id ? " selected" : ""),
      disabled: !m.compatible,
    });
    btn.appendChild(el("strong", { text: machine?.name || m.id }));
    btn.appendChild(el("small", { text: m.compatible ? m.line2 : "Несовместим" }));
    if (m.compatible) {
      btn.addEventListener("click", () => {
        sm.state.selectedMachineId = m.id;
        sm.schedulePersist();
        void renderWorkspace();
      });
    }
    wrap.appendChild(btn);
  }
}

function renderScaleControls(): void {
  const range = $("#flour-range") as HTMLInputElement | null;
  const input = $("#flour-input") as HTMLInputElement | null;
  const display = $("#flour-display");
  if (range) range.value = String(sm.state.targetFlourG);
  if (input) input.value = String(sm.state.targetFlourG);
  if (display) display.textContent = String(sm.state.targetFlourG);
}

function setFlour(v: number): void {
  sm.state.targetFlourG = Math.max(250, Math.min(650, Math.round(v)));
  renderScaleControls();
  sm.schedulePersist();
  void refreshFlourViews();
}

const refreshFlourViews = debounce(() => {
  void renderWorkspace();
}, 180);

function renderKPIs(recipe: Recipe, calc: RecipeCalculation): void {
  const grid = $("#kpi-grid");
  const warnBox = $("#scale-warnings");
  if (!grid) return;
  grid.textContent = "";
  const items: [string, string, string?][] = [
    ["Гидратация", `${calc.hydration.toFixed(1)}%`],
    ["Масса теста", `${Math.round(calc.doughMass)} г`],
    [
      "Буханка (оценка)",
      `${Math.round(calc.finished.min)}–${Math.round(calc.finished.max)} г`,
    ],
    [
      "Пик объёма",
      `${Math.round(calc.volume.proofedMinMl)}–${Math.round(calc.volume.proofedMaxMl)} мл`,
    ],
  ];
  if (sm.state.selectedMachineId === "panasonic_sd_yr2540hts") {
    const load = calc.dispenserLoad;
    let cls = "";
    if (load > 150) cls = "kpi-danger";
    else if (load > 135) cls = "kpi-warn";
    items.push(["Диспенсер добавок", `${Math.round(load)} г`, cls]);
  }
  for (const [label, value, cls] of items) {
    const card = el("div", { className: "kpi" + (cls ? ` ${cls}` : "") });
    card.appendChild(el("div", { className: "kpi-label", text: label }));
    card.appendChild(el("div", { className: "kpi-value", text: value }));
    grid.appendChild(card);
  }
  if (warnBox) {
    warnBox.textContent = "";
    for (const w of calc.warnings) {
      if (w.level === "ok") continue;
      warnBox.appendChild(
        el("div", {
          className: "warn-line warn-" + w.level,
          text: w.message,
        }),
      );
    }
  }
  void recipe;
}

function renderIngredientTable(recipe: Recipe, calc: RecipeCalculation): void {
  const tbody = $("#ing-tbody");
  const mobile = $("#ing-mobile");
  if (!tbody || !mobile) return;
  tbody.textContent = "";
  mobile.textContent = "";
  const machineKey =
    sm.state.selectedMachineId === "redmond_rmc_m92s" ? "redmond" : "panasonic";
  for (const row of calc.scaled.all) {
    const name =
      row.name ||
      ingredients[row.ingredientId]?.name ||
      row.ingredientId;
    const place =
      machineKey === "redmond" ? row.placement.redmond : row.placement.panasonic;
    const tr = el("tr");
    tr.appendChild(el("td", { text: name + (row.isAddin ? " (добавка)" : "") }));
    tr.appendChild(
      el("td", {
        text: formatGrams(row.ingredientId, row.grams, fineAddin(row.ingredientId)) + " г",
      }),
    );
    tr.appendChild(el("td", { text: row.bakerPct.toFixed(1) + "%" }));
    tr.appendChild(el("td", { text: row.role || "—" }));
    tr.appendChild(el("td", { text: placementLabel(place, machineKey) }));
    tr.appendChild(el("td", { text: stageLabel(row.stage) }));
    tbody.appendChild(tr);

    const card = el("div", { className: "ing-card" });
    card.appendChild(el("strong", { text: name }));
    card.appendChild(
      el("div", {
        text: `${formatGrams(row.ingredientId, row.grams, fineAddin(row.ingredientId))} г · ${row.bakerPct.toFixed(1)}% · ${placementLabel(place, machineKey)}`,
      }),
    );
    if (row.detailedRole) card.appendChild(el("p", { text: row.detailedRole }));
    mobile.appendChild(card);
  }
  void recipe;
}

function renderAddins(recipe: Recipe, calc: RecipeCalculation): void {
  const grid = $("#addins-grid");
  if (!grid) return;
  grid.textContent = "";
  const ids = recipe.tasteAddinIds || [];
  if (!ids.length) {
    grid.appendChild(el("p", { className: "stat-line", text: "Для этого рецепта добавки не предложены." }));
    return;
  }
  const bag = enabledAddinMap();
  for (const aid of ids) {
    const a = addins[aid];
    if (!a) continue;
    const on = !!bag[aid];
    const card = el("label", { className: "check-row addin-card" + (on ? " on" : "") });
    const cb = el("input", { type: "checkbox" }) as HTMLInputElement;
    cb.checked = on;
    cb.addEventListener("change", () => {
      bag[aid] = cb.checked;
      sm.state.addinsByRecipe[recipe.id] = bag;
      sm.state.enabledTasteAddins = bag;
      sm.schedulePersist();
      void renderWorkspace();
    });
    card.appendChild(cb);
    const body = el("span");
    body.appendChild(el("span", { className: "name", text: a.name }));
    const scaled = calc.scaled.addins.find((x) => x.addinId === aid);
    const grams = scaled
      ? formatGrams(a.ingredientId, scaled.grams, fineAddin(aid))
      : formatGrams(a.ingredientId, (sm.state.targetFlourG * a.defaultPct) / 100, fineAddin(aid));
    body.appendChild(
      el("span", {
        className: "muted",
        text: `${a.defaultPct}% · ≈${grams} г · ${a.role}`,
      }),
    );
    card.appendChild(body);
    grid.appendChild(card);
  }
}

function substituteTokens(text: string, calc: RecipeCalculation): string {
  return text.replace(/\{([a-z0-9_]+)\}/gi, (_, id: string) => {
    const row = calc.scaled.all.find((r) => r.ingredientId === id || r.addinId === id);
    if (!row) return id;
    return formatGrams(id, row.grams, fineAddin(id)) + " г";
  });
}

function renderSteps(recipe: Recipe, calc: RecipeCalculation): void {
  const list = $("#steps-list");
  if (!list) return;
  list.textContent = "";
  const key =
    sm.state.selectedMachineId === "redmond_rmc_m92s" ? "redmond" : "panasonic";
  const steps = recipe.machineProfiles[key].steps;
  for (const s of steps) {
    list.appendChild(el("li", { text: substituteTokens(s.text, calc) }));
  }
  if (sm.state.largeSteps) list.classList.add("large-steps");
  else list.classList.remove("large-steps");
}

function missingRows(calc: RecipeCalculation) {
  const pantry = pantrySet();
  return calc.scaled.items
    .filter((row) => {
      if (row.optional || isAlwaysAvailable(row.ingredientId)) return false;
      return !pantry.has(row.ingredientId);
    })
    .map((row) => ({
      id: row.ingredientId,
      name: ingredients[row.ingredientId]?.name || row.ingredientId,
      grams: row.grams,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function renderShoppingPanel(calc: RecipeCalculation): void {
  const panel = $("#shopping-panel");
  if (!panel) return;
  panel.textContent = "";
  const rows = missingRows(calc);
  if (!rows.length) {
    panel.appendChild(el("p", { className: "stat-line", text: "Для этого рецепта всё есть дома." }));
    return;
  }
  panel.appendChild(el("p", { className: "stat-line", text: "Не хватает — отметьте, когда купите:" }));
  for (const row of rows) {
    const line = el("label", { className: "shopping-row" });
    const cb = el("input", { type: "checkbox" }) as HTMLInputElement;
    cb.addEventListener("change", () => {
      if (!cb.checked) return;
      sm.state.pantry[row.id] = true;
      sm.schedulePersist();
      renderPantry();
      void renderWorkspace();
      if (sm.state.catalogCanBake) void renderCatalog();
    });
    line.appendChild(cb);
    line.appendChild(
      el("span", {
        text: `${row.name} — ${formatGrams(row.id, row.grams)} г`,
      }),
    );
    panel.appendChild(line);
  }
}

function updateFavoriteBtn(): void {
  const btn = $("#btn-favorite");
  if (!btn || !sm.state.selectedRecipeId) return;
  const on = sm.state.favorites.includes(sm.state.selectedRecipeId);
  btn.textContent = on ? "★ В избранном" : "☆ В избранное";
}

/* ---------- Cook mode ---------- */
function ckKeyFor(recipeId: string, machineId: string): string {
  const addinIds = Object.keys(enabledAddinMap())
    .filter((k) => enabledAddinMap()[k])
    .sort();
  return `${recipeId}::${machineId}::addins:${addinIds.join(",")}`;
}

function saveCookSession(): void {
  if (!sm.state.selectedRecipeId || !sm.state.selectedMachineId || !cookRuntime) return;
  const activeKey = sm.state.activeTimerId;
  const timer = activeKey ? sm.state.timers[activeKey] : null;
  if (timer?.running) timerService.pause(timer);
  sm.state.cookSession = {
    recipeId: sm.state.selectedRecipeId,
    machineId: sm.state.selectedMachineId,
    stepIndex: sm.state.cookStepIndex,
    timerId: activeKey?.split("::").pop() ?? null,
    ckKey: cookRuntime.ckKey,
    remainingMs: timer?.remainingMs ?? 0,
    running: false,
  };
  sm.schedulePersist();
  renderResumeBanner();
}

function renderResumeBanner(): void {
  const bar = $("#resume-cook");
  if (!bar) return;
  const s = sm.state.cookSession;
  if (!s?.recipeId) {
    bar.classList.add("hidden");
    bar.textContent = "";
    return;
  }
  bar.classList.remove("hidden");
  bar.textContent = "";
  bar.appendChild(
    el("span", {
      text: `Продолжить готовку: шаг ${(s.stepIndex || 0) + 1}`,
    }),
  );
  const btn = el("button", { type: "button", className: "btn btn-primary", text: "Открыть" });
  btn.addEventListener("click", () => {
    void openCookMode({ resume: true });
  });
  bar.appendChild(btn);
}

async function openCookMode(opts: { resume?: boolean } = {}): Promise<void> {
  if (!sm.state.selectedRecipeId || !sm.state.selectedMachineId) return;
  const recipe = await ensureRecipe(sm.state.selectedRecipeId);
  const calc = lastCalc || (await fetchCalc());
  if (!calc) return;
  const key =
    sm.state.selectedMachineId === "redmond_rmc_m92s" ? "redmond" : "panasonic";
  const profile = recipe.machineProfiles[key];
  const ck = ckKeyFor(recipe.id, sm.state.selectedMachineId);
  cookRuntime = {
    ckKey: ck,
    steps: profile.steps.map((s) => ({
      ...s,
      text: substituteTokens(s.text, calc),
    })),
    timers: profile.timers,
    recipeTitle: recipe.title,
    machineName: machines[sm.state.selectedMachineId]?.name || "",
  };
  if (!sm.state.checklist[ck]) sm.state.checklist[ck] = {};

  if (opts.resume && sm.state.cookSession) {
    sm.state.cookStepIndex = sm.state.cookSession.stepIndex || 0;
    const tid = sm.state.cookSession.timerId;
    if (tid && cookRuntime.timers.some((t) => t.id === tid)) {
      const full = `${ck}::${tid}`;
      const spec = cookRuntime.timers.find((t) => t.id === tid)!;
      const t = timerService.ensureTimer(sm.state.timers, full, spec.label, spec.minutes);
      t.remainingMs = sm.state.cookSession.remainingMs;
      t.running = false;
      t.deadline = null;
      sm.state.activeTimerId = full;
    }
  } else {
    sm.state.cookStepIndex = 0;
    if (cookRuntime.timers[0]) {
      const full = `${ck}::${cookRuntime.timers[0].id}`;
      timerService.ensureTimer(
        sm.state.timers,
        full,
        cookRuntime.timers[0].label,
        cookRuntime.timers[0].minutes,
      );
      sm.state.activeTimerId = full;
    }
  }

  cookReturnFocus = document.activeElement as HTMLElement | null;
  const overlay = $("#cook-overlay");
  overlay?.classList.remove("hidden");
  $("#cook-sub")!.textContent = `${cookRuntime.recipeTitle} · ${cookRuntime.machineName}`;
  renderCookSteps();
  updateTimerUi();
  timerService.startInterval(
    () => {
      const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
      timerService.syncRunning(t ?? null);
      updateTimerUi();
    },
    (label) => toast(`Таймер «${label}» завершён`, "ok"),
  );
  $("#btn-close-cook")?.focus();
}

function renderCookSteps(): void {
  const wrap = $("#cook-steps");
  if (!wrap || !cookRuntime) return;
  wrap.textContent = "";
  const ck = cookRuntime.ckKey;
  const done = sm.state.checklist[ck] || {};
  cookRuntime.steps.forEach((s, idx) => {
    const row = el("label", {
      className: "cook-step" + (idx === sm.state.cookStepIndex ? " current" : ""),
    });
    const cb = el("input", { type: "checkbox" }) as HTMLInputElement;
    cb.checked = !!done[s.id];
    cb.addEventListener("change", () => {
      if (!sm.state.checklist[ck]) sm.state.checklist[ck] = {};
      sm.state.checklist[ck][s.id] = cb.checked;
      sm.pruneChecklist();
      sm.schedulePersist();
      updateCookProgress();
    });
    row.appendChild(cb);
    const text = el("span", { text: s.text });
    if (sm.state.largeSteps) text.classList.add("large-steps");
    row.appendChild(text);
    wrap.appendChild(row);
  });
  updateCookProgress();
}

function updateCookProgress(): void {
  if (!cookRuntime) return;
  const total = cookRuntime.steps.length;
  const done = Object.values(sm.state.checklist[cookRuntime.ckKey] || {}).filter(Boolean).length;
  const fill = $("#cook-progress") as HTMLElement | null;
  const label = $("#cook-progress-label");
  if (fill) fill.style.width = `${total ? (done / total) * 100 : 0}%`;
  if (label) label.textContent = `Шаг ${sm.state.cookStepIndex + 1} из ${total} · отмечено ${done}`;
}

function updateTimerUi(): void {
  const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
  const display = $("#timer-display");
  const label = $("#timer-label");
  if (display) display.textContent = timerService.display(t);
  if (label && t) label.textContent = t.label;
}

function closeCookMode(): void {
  const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
  if (t?.running) timerService.pause(t);
  timerService.stopInterval();
  saveCookSession();
  $("#cook-overlay")?.classList.add("hidden");
  cookRuntime = null;
  const back = cookReturnFocus || $("#btn-cook");
  cookReturnFocus = null;
  try {
    back?.focus();
  } catch {
    /* ignore */
  }
}

function trapFocus(e: KeyboardEvent): void {
  const overlay = $("#cook-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeCookMode();
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = $all(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    overlay,
  ).filter((n) => !(n as HTMLButtonElement).disabled);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Calibration / IO ---------- */
async function saveCalibration(): Promise<void> {
  const weightEl = $("#calib-weight") as HTMLInputElement | null;
  const fillEl = $("#calib-fill") as HTMLInputElement | null;
  const w = Number(weightEl?.value || 0);
  if (!sm.state.selectedRecipeId || !sm.state.selectedMachineId) return;
  if (!(w >= 50)) {
    toast("Укажите массу не меньше 50 г", "warn");
    return;
  }
  const calc = lastCalc || (await fetchCalc());
  if (!calc) return;
  const predictedMid = (calc.finished.min + calc.finished.max) / 2;
  sm.state.calibrations.push({
    recipeId: sm.state.selectedRecipeId,
    machineId: sm.state.selectedMachineId,
    targetFlourG: sm.state.targetFlourG,
    actualFinishedWeightG: w,
    peakFillPercent: fillEl?.value ? Number(fillEl.value) : null,
    predictedMid,
    timestamp: new Date().toISOString(),
  });
  sm.schedulePersist();
  const status = $("#calib-status");
  if (status) status.textContent = "Калибровка сохранена — прогноз обновлён.";
  toast("Калибровка сохранена", "ok");
  void renderWorkspace();
}

async function doExport(): Promise<void> {
  const res = await api.exportState(sm.toPersisted());
  if (res.cancelled) return;
  toast("Экспорт JSON сохранён", "ok");
}

async function doImport(): Promise<void> {
  const res = await api.importState(sm.toPersisted());
  if (res.cancelled) return;
  sm.applyPersisted(res.state);
  renderPantry();
  await renderCatalog();
  if (sm.state.selectedRecipeId) await renderWorkspace();
  renderResumeBanner();
  toast("Импорт выполнен", "ok");
}

async function copyIngredients(): Promise<void> {
  if (!lastCalc) return;
  const lines = lastCalc.scaled.all.map((row) => {
    const name = row.name || ingredients[row.ingredientId]?.name || row.ingredientId;
    return `${name} — ${formatGrams(row.ingredientId, row.grams, fineAddin(row.ingredientId))} г`;
  });
  await api.copyText(lines.join("\n"));
  toast("Список скопирован", "ok");
}

async function copyShopping(): Promise<void> {
  if (!lastCalc) return;
  const rows = missingRows(lastCalc).map(
    (r) => `${r.name} — ${formatGrams(r.id, r.grams)} г`,
  );
  if (!rows.length) {
    toast("Всё есть дома", "ok");
    return;
  }
  await api.copyText(rows.join("\n"));
  toast("Список покупок скопирован", "ok");
}

/* ---------- Bindings ---------- */
function bindUi(): void {
  const onPantrySearch = debounce((e: Event) => {
    sm.state.pantryQuery = (e.target as HTMLInputElement).value;
    renderPantry();
  }, 180);
  $("#pantry-search")?.addEventListener("input", onPantrySearch);
  $("#btn-clear-pantry")?.addEventListener("click", () => {
    sm.state.pantry = {};
    sm.schedulePersist();
    renderPantry();
    if (sm.state.catalogCanBake) void renderCatalog();
  });
  $("#btn-search")?.addEventListener("click", () => {
    void runSearch();
  });
  $("#opt-near")?.addEventListener("change", () => {
    if (sm.state.searchRan) void runSearch();
  });
  $all(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      sm.state.resultsTab = t.dataset.tab || "panasonic";
      renderResults();
    });
  });

  const onCatalogSearch = debounce((e: Event) => {
    sm.state.catalogQuery = (e.target as HTMLInputElement).value;
    void renderCatalog();
  }, 180);
  $("#catalog-search")?.addEventListener("input", onCatalogSearch);
  $("#flt-fav")?.addEventListener("change", (e) => {
    sm.state.catalogFavoritesOnly = (e.target as HTMLInputElement).checked;
    sm.schedulePersist();
    void renderCatalog();
  });
  $("#flt-bake")?.addEventListener("change", (e) => {
    sm.state.catalogCanBake = (e.target as HTMLInputElement).checked;
    sm.schedulePersist();
    void renderCatalog();
  });
  $("#catalog-details")?.addEventListener("toggle", (e) => {
    sm.state.catalogOpen = (e.target as HTMLDetailsElement).open;
    sm.schedulePersist();
  });

  $("#flour-range")?.addEventListener("input", (e) => {
    setFlour(Number((e.target as HTMLInputElement).value));
  });
  $("#flour-input")?.addEventListener("change", (e) => {
    setFlour(Number((e.target as HTMLInputElement).value));
  });
  $("#flour-minus")?.addEventListener("click", () => setFlour(sm.state.targetFlourG - 5));
  $("#flour-plus")?.addEventListener("click", () => setFlour(sm.state.targetFlourG + 5));

  $("#btn-favorite")?.addEventListener("click", () => {
    if (sm.state.selectedRecipeId) {
      toggleFavorite(sm.state.selectedRecipeId);
      void renderCatalog();
    }
  });
  $("#btn-reset-addins")?.addEventListener("click", () => {
    if (!sm.state.selectedRecipeId) return;
    sm.state.addinsByRecipe[sm.state.selectedRecipeId] = {};
    sm.syncAddinsFor(sm.state.selectedRecipeId);
    sm.schedulePersist();
    void renderWorkspace();
  });
  $("#btn-copy-ings")?.addEventListener("click", () => {
    void copyIngredients();
  });
  $("#btn-shopping")?.addEventListener("click", () => {
    void copyShopping();
  });
  $("#btn-cook")?.addEventListener("click", () => {
    void openCookMode();
  });
  $("#btn-close-cook")?.addEventListener("click", () => closeCookMode());
  $("#timer-start")?.addEventListener("click", () => {
    const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
    if (t) {
      timerService.start(t);
      updateTimerUi();
    }
  });
  $("#timer-pause")?.addEventListener("click", () => {
    const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
    if (t) {
      timerService.pause(t);
      updateTimerUi();
    }
  });
  $("#timer-reset")?.addEventListener("click", () => {
    const t = sm.state.activeTimerId ? sm.state.timers[sm.state.activeTimerId] : null;
    if (t) {
      timerService.reset(t);
      updateTimerUi();
    }
  });
  $("#timer-label")?.addEventListener("click", () => {
    if (!cookRuntime?.timers.length) return;
    const ids = cookRuntime.timers.map((t) => `${cookRuntime!.ckKey}::${t.id}`);
    const cur = Math.max(0, ids.indexOf(sm.state.activeTimerId || ""));
    const next = ids[(cur + 1) % ids.length];
    const spec = cookRuntime.timers[(cur + 1) % ids.length];
    timerService.ensureTimer(sm.state.timers, next, spec.label, spec.minutes);
    sm.state.activeTimerId = next;
    updateTimerUi();
  });
  $("#cook-prev")?.addEventListener("click", () => {
    if (!cookRuntime) return;
    sm.state.cookStepIndex = Math.max(0, sm.state.cookStepIndex - 1);
    renderCookSteps();
  });
  $("#cook-next")?.addEventListener("click", () => {
    if (!cookRuntime) return;
    const step = cookRuntime.steps[sm.state.cookStepIndex];
    if (step) {
      if (!sm.state.checklist[cookRuntime.ckKey]) sm.state.checklist[cookRuntime.ckKey] = {};
      sm.state.checklist[cookRuntime.ckKey][step.id] = true;
    }
    sm.state.cookStepIndex = Math.min(
      cookRuntime.steps.length - 1,
      sm.state.cookStepIndex + 1,
    );
    sm.schedulePersist();
    renderCookSteps();
  });
  $("#cook-reset-all")?.addEventListener("click", () => {
    if (!cookRuntime) return;
    sm.state.checklist[cookRuntime.ckKey] = {};
    sm.state.cookStepIndex = 0;
    sm.schedulePersist();
    renderCookSteps();
  });

  $("#btn-save-calib")?.addEventListener("click", () => {
    void saveCalibration();
  });
  $("#btn-export")?.addEventListener("click", () => {
    void doExport();
  });
  $("#btn-import")?.addEventListener("click", () => {
    void doImport();
  });
  $("#set-machine")?.addEventListener("change", (e) => {
    sm.state.defaultMachineId = (e.target as HTMLSelectElement).value;
    sm.schedulePersist();
  });
  $("#set-large")?.addEventListener("change", (e) => {
    sm.state.largeSteps = (e.target as HTMLInputElement).checked;
    sm.schedulePersist();
    if (sm.state.selectedRecipeId) void renderWorkspace();
  });

  document.addEventListener("keydown", trapFocus);
}

export async function startApp(): Promise<void> {
  meta = await api.getMeta();
  ingredients = await api.getIngredients();
  machines = await api.getMachines();
  addins = await api.getAddins();
  catalog = await api.getCatalog();

  const recovered = await sm.restore();
  if (recovered) toast("Сохранённые данные восстановлены из резервной копии", "warn");

  const setMachine = $("#set-machine") as HTMLSelectElement | null;
  if (setMachine) setMachine.value = sm.state.defaultMachineId;
  const setLarge = $("#set-large") as HTMLInputElement | null;
  if (setLarge) setLarge.checked = sm.state.largeSteps;
  const near = $("#opt-near") as HTMLInputElement | null;
  if (near) near.checked = sm.state.nearMatchOn;
  const fav = $("#flt-fav") as HTMLInputElement | null;
  if (fav) fav.checked = sm.state.catalogFavoritesOnly;
  const bake = $("#flt-bake") as HTMLInputElement | null;
  if (bake) bake.checked = sm.state.catalogCanBake;
  if (typeof sm.state.catalogOpen === "boolean") {
    const d = $("#catalog-details") as HTMLDetailsElement | null;
    if (d) d.open = sm.state.catalogOpen;
  }

  const cats = Array.from(new Set(catalog.map((c) => c.category)));
  cats.sort(
    (a, b) =>
      (CATALOG_CATEGORY_ORDER.indexOf(a) + 1 || 99) -
      (CATALOG_CATEGORY_ORDER.indexOf(b) + 1 || 99),
  );

  renderPantryCats();
  renderPantry();
  renderCatalogCats(cats);
  renderDifficultyChips();
  await renderCatalog();
  renderResumeBanner();
  bindUi();

  if (sm.state.selectedRecipeId) {
    await openRecipe(sm.state.selectedRecipeId, sm.state.selectedMachineId, {
      keepFlour: true,
    });
  }

  // silence unused helper in production build path
  void confidenceBadgeText;
}

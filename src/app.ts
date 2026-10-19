import { open, save } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { renderAddins } from "./components/Addins";
import { readCalibrationInputs, setCalibrationStatus } from "./components/Calibration";
import { renderCatalog } from "./components/BreadCatalog";
import { cookFocusables, renderCookSteps } from "./components/CookMode";
import { bindNav } from "./components/Header";
import { renderIngredientTable } from "./components/IngredientTable";
import { renderKpis, renderWarnings } from "./components/KPIGrid";
import { renderMachinePicker } from "./components/MachineSelector";
import { renderPantryCategories, renderPantryList } from "./components/Pantry";
import { renderResults } from "./components/RecipeResults";
import { copyName, renderScale, renderShopping, renderSteps } from "./components/RecipeWorkspace";
import { syncSettings } from "./components/Settings";
import { toast } from "./components/Toast";
import type { BreadApi } from "./services/tauriApi";
import {
  clampFlour,
  currentCalibration,
  defaultState,
  enabledAddinIds,
  pushRecent,
  selectedPantry,
  syncAddins,
  toggleFavorite,
} from "./services/stateManager";
import { TimerService } from "./services/timerService";
import type { Calculation, Ingredient, Machine, PersistedState, RecipeCard, SearchHit } from "./types/models";
import { byId } from "./utils/dom";

export class BreadLabApp {
  state: PersistedState = defaultState();
  recipes = new Map<string, RecipeCard>();
  ingredients: Ingredient[] = [];
  categories: { id: string; name: string }[] = [];
  categoryOrder: string[] = [];
  machines: Record<string, Machine> = {};
  results: SearchHit[] = [];
  calc: Calculation | null = null;
  pantryCategory = "all";
  pantryQuery = "";
  catalogCategory = "all";
  catalogQuery = "";
  resultsTab: "panasonic" | "redmond" = "panasonic";
  searchRan = false;
  expanded: string | null = null;
  cookSteps: Calculation["cookSteps"] = [];
  cookKey = "";
  cookIndex = 0;
  private returnFocus: HTMLElement | null = null;
  private calcToken = 0;
  private calcTimer: number | null = null;
  private saveTimer: number | null = null;
  private saveFailed = false;
  readonly timer = new TimerService();

  constructor(private readonly api: BreadApi) {
    this.timer.onTick = (text) => {
      const node = document.getElementById("timer-display");
      if (node) node.textContent = text;
    };
    this.timer.onDone = (label) => toast(`Таймер завершён: ${label}`, "ok");
  }

  async start(): Promise<void> {
    const [loaded, catalog, ingredients, machines] = await Promise.all([
      this.api.loadState(),
      this.api.getCatalog(),
      this.api.getIngredients(),
      this.api.getMachines(),
    ]);
    this.state = { ...defaultState(), ...loaded.state };
    this.categories = catalog.meta.categories;
    this.categoryOrder = catalog.meta.catalogCategoryOrder;
    this.recipes = new Map(catalog.recipes.map((recipe) => [recipe.id, recipe]));
    this.ingredients = Object.values(ingredients).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    this.machines = machines;
    if (loaded.notice) toast(loaded.notice, loaded.notice.includes("Импорт") ? "ok" : "warn");
    syncAddins(this.state, this.state.selectedRecipeId);
    this.applyShell();
    this.bind();
    this.renderPantry();
    await this.renderCatalog();
    this.renderResume();
    if (this.state.selectedRecipeId && this.recipes.has(this.state.selectedRecipeId)) {
      byId("recipe-workspace").classList.remove("hidden");
      byId("calibration").classList.remove("hidden");
      await this.refreshCalc(true);
    }
  }

  private applyShell(): void {
    const nav = byId<HTMLDetailsElement>("nav-menu");
    const wideNav = window.matchMedia("(min-width: 640px)");
    const syncNav = () => {
      if (wideNav.matches) nav.open = true;
    };
    wideNav.addEventListener("change", syncNav);
    nav.open = wideNav.matches;
    document.body.classList.toggle("large-steps", this.state.largeSteps);
    syncSettings(this.state.defaultMachineId, this.state.largeSteps);
    const details = byId<HTMLDetailsElement>("catalog-details");
    details.open = this.state.catalogOpen;
    byId<HTMLInputElement>("opt-near").checked = this.state.nearMatchOn;
    byId<HTMLInputElement>("flt-fav").checked = this.state.catalogFavoritesOnly;
    byId<HTMLInputElement>("flt-bake").checked = this.state.catalogCanBake;
  }

  private bind(): void {
    const search = byId<HTMLInputElement>("pantry-search");
    let pantryTimer: number | null = null;
    search.addEventListener("input", () => {
      this.pantryQuery = search.value;
      if (pantryTimer) window.clearTimeout(pantryTimer);
      pantryTimer = window.setTimeout(() => this.renderPantry(), 180);
    });
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!selectedPantry(this.state.pantry).length) {
        toast("Отметьте продукты в списке «Что есть дома»", "warn");
        return;
      }
      void this.runSearch();
    });
    byId("pantry-list").addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      if (target.type !== "checkbox") return;
      const id = target.getAttribute("data-ing-id");
      if (!id) return;
      this.state.pantry[id] = target.checked;
      target.closest(".check-row")?.classList.toggle("checked", target.checked);
      this.updatePantryStat();
      this.persistSoon();
    });
    byId("btn-clear-pantry").addEventListener("click", () => {
      if (!selectedPantry(this.state.pantry).length) {
        toast("Список уже пуст", "warn");
        return;
      }
      if (!window.confirm("Очистить все отмеченные продукты?")) return;
      this.state.pantry = {};
      this.persistNow();
      this.renderPantry();
      toast("Список продуктов очищен", "ok");
    });
    byId("btn-search").addEventListener("click", () => void this.runSearch());
    byId<HTMLInputElement>("opt-near").addEventListener("change", (event) => {
      this.state.nearMatchOn = (event.target as HTMLInputElement).checked;
      this.persistNow();
      if (!byId("search-results").classList.contains("hidden")) void this.runSearch();
    });

    const catalogSearch = byId<HTMLInputElement>("catalog-search");
    let catalogTimer: number | null = null;
    catalogSearch.addEventListener("input", () => {
      this.catalogQuery = catalogSearch.value;
      if (catalogTimer) window.clearTimeout(catalogTimer);
      catalogTimer = window.setTimeout(() => void this.renderCatalog(), 180);
    });
    byId<HTMLInputElement>("flt-fav").addEventListener("change", (event) => {
      this.state.catalogFavoritesOnly = (event.target as HTMLInputElement).checked;
      this.persistNow();
      void this.renderCatalog();
    });
    byId<HTMLInputElement>("flt-bake").addEventListener("change", (event) => {
      this.state.catalogCanBake = (event.target as HTMLInputElement).checked;
      this.persistNow();
      void this.renderCatalog();
    });
    byId<HTMLDetailsElement>("catalog-details").addEventListener("toggle", () => {
      this.state.catalogOpen = byId<HTMLDetailsElement>("catalog-details").open;
      this.persistSoon();
    });

    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this.resultsTab = tab.dataset.tab === "redmond" ? "redmond" : "panasonic";
        this.paintResults();
      });
    });

    byId<HTMLInputElement>("flour-range").addEventListener("input", (event) => {
      this.setFlour(Number((event.target as HTMLInputElement).value), false);
    });
    byId<HTMLInputElement>("flour-range").addEventListener("change", (event) => {
      this.setFlour(Number((event.target as HTMLInputElement).value), true);
    });
    byId<HTMLInputElement>("flour-input").addEventListener("change", (event) => {
      this.setFlour(Number((event.target as HTMLInputElement).value), true);
    });
    byId("flour-minus").addEventListener("click", () => this.setFlour(this.state.targetFlourG - 10, true));
    byId("flour-plus").addEventListener("click", () => this.setFlour(this.state.targetFlourG + 10, true));
    byId("btn-copy-ings").addEventListener("click", () => void this.copyIngredients());
    byId("btn-shopping").addEventListener("click", () => void this.copyShopping());
    byId("btn-favorite").addEventListener("click", () => this.toggleFavorite());
    byId("btn-reset-addins").addEventListener("click", () => this.resetAddins());
    byId("btn-print").addEventListener("click", () => window.print());
    byId("btn-save-calib").addEventListener("click", () => this.saveCalibration());
    for (const id of ["calib-weight", "calib-fill"]) {
      byId(id).addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          this.saveCalibration();
        }
      });
    }
    byId("btn-cook").addEventListener("click", () => void this.openCook(false));
    byId("btn-close-cook").addEventListener("click", () => this.closeCook());
    byId("cook-prev").addEventListener("click", () => this.cookPrev());
    byId("cook-next").addEventListener("click", () => this.cookNext());
    byId("cook-reset-all").addEventListener("click", () => this.cookReset());
    byId("timer-start").addEventListener("click", () => {
      this.timer.start();
      this.saveCookSession();
    });
    byId("timer-pause").addEventListener("click", () => {
      this.timer.pauseActive();
      this.saveCookSession();
    });
    byId("timer-reset").addEventListener("click", () => {
      this.timer.resetActive();
      this.saveCookSession();
    });
    const timerLabel = byId("timer-label");
    timerLabel.style.cursor = "pointer";
    timerLabel.title = "Нажмите, чтобы переключить таймер этапа";
    timerLabel.addEventListener("click", () => this.cycleTimer());

    byId<HTMLSelectElement>("set-machine").addEventListener("change", (event) => {
      this.state.defaultMachineId = (event.target as HTMLSelectElement).value;
      this.persistNow();
      toast("Машина по умолчанию сохранена", "ok");
    });
    byId<HTMLInputElement>("set-large").addEventListener("change", (event) => {
      this.state.largeSteps = (event.target as HTMLInputElement).checked;
      document.body.classList.toggle("large-steps", this.state.largeSteps);
      this.persistNow();
    });
    byId("btn-export").addEventListener("click", () => void this.exportJson());
    byId("btn-import").addEventListener("click", () => void this.importJson());

    bindNav({
      "#pantry": () => byId("pantry").scrollIntoView({ behavior: "smooth", block: "start" }),
      "#catalog": () => {
        byId<HTMLDetailsElement>("catalog-details").open = true;
        this.state.catalogOpen = true;
        byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "#search-results": () => {
        if (!this.searchRan) {
          byId("pantry").scrollIntoView({ behavior: "smooth", block: "start" });
          byId("btn-search").focus();
          toast("Отметьте продукты и нажмите «Найти, что можно испечь»", "warn");
          return;
        }
        const section = byId("search-results");
        section.classList.remove("hidden");
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "#recipe-workspace": () => {
        const section = byId("recipe-workspace");
        if (section.classList.contains("hidden") || !this.currentRecipe()) {
          byId<HTMLDetailsElement>("catalog-details").open = true;
          byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
          toast("Сначала выберите хлеб", "warn");
          return;
        }
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "#cook-mode-anchor": () => {
        if (!this.currentRecipe() || byId("recipe-workspace").classList.contains("hidden")) {
          byId<HTMLDetailsElement>("catalog-details").open = true;
          byId("catalog").scrollIntoView({ behavior: "smooth", block: "start" });
          toast("Сначала выберите хлеб", "warn");
          return;
        }
        byId("cook-mode-anchor").scrollIntoView({ behavior: "smooth", block: "start" });
      },
      "#sources": () => byId("sources").scrollIntoView({ behavior: "smooth", block: "start" }),
    });

    document.addEventListener("keydown", (event) => {
      if (!this.isCookOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeCook();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = cookFocusables(byId("cook-overlay"));
      if (nodes.length < 2) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }

  private categoryName(id: string): string {
    return this.categories.find((item) => item.id === id)?.name ?? id;
  }

  private renderPantry(): void {
    renderPantryCategories(byId("pantry-cats"), this.categories, this.pantryCategory, (id) => {
      this.pantryCategory = id;
      this.renderPantry();
    });
    renderPantryList(byId("pantry-list"), this.ingredients, this.state.pantry, this.pantryCategory, this.pantryQuery, (id) => this.categoryName(id));
    byId<HTMLInputElement>("opt-near").checked = this.state.nearMatchOn;
    this.updatePantryStat();
  }

  private updatePantryStat(): void {
    byId("pantry-stat").textContent = `Выбрано: ${selectedPantry(this.state.pantry).length} ингредиентов`;
  }

  private async renderCatalog(): Promise<void> {
    const present = new Set([...this.recipes.values()].map((recipe) => recipe.category));
    const categories = this.categoryOrder.filter((name) => present.has(name));
    let bakeSet: Set<string> | null = null;
    if (this.state.catalogCanBake) {
      const hits = await this.api.searchRecipes(selectedPantry(this.state.pantry), this.state.nearMatchOn);
      bakeSet = new Set(hits.map((hit) => hit.recipeId));
    }
    renderCatalog({
      recipes: [...this.recipes.values()],
      category: this.catalogCategory,
      categories,
      difficulty: this.state.catalogDifficulty,
      favoritesOnly: this.state.catalogFavoritesOnly,
      canBake: this.state.catalogCanBake,
      favorites: this.state.favorites,
      query: this.catalogQuery,
      bakeSet,
      recent: this.state.recent,
      onOpen: (id) => void this.openRecipe(id, this.state.defaultMachineId, { fromCatalog: true }),
      onCategory: (id) => {
        this.catalogCategory = id;
        void this.renderCatalog();
      },
      onDifficulty: (id) => {
        this.state.catalogDifficulty = id;
        this.persistNow();
        void this.renderCatalog();
      },
    }, {
      cats: byId("catalog-cats"),
      diff: byId("catalog-diff"),
      shortcuts: byId("catalog-shortcuts"),
      grid: byId("catalog-grid"),
      stat: byId("catalog-stat"),
      count: byId("catalog-count"),
    });
    byId<HTMLInputElement>("flt-fav").checked = this.state.catalogFavoritesOnly;
    byId<HTMLInputElement>("flt-bake").checked = this.state.catalogCanBake;
  }

  private async runSearch(): Promise<void> {
    this.searchRan = true;
    this.results = await this.api.searchRecipes(selectedPantry(this.state.pantry), this.state.nearMatchOn);
    const section = byId("search-results");
    section.classList.remove("hidden");
    this.paintResults();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  private paintResults(): void {
    renderResults(
      byId("results-summary"),
      byId("results-panasonic"),
      byId("results-redmond"),
      [...document.querySelectorAll<HTMLElement>(".tab")],
      this.results,
      this.resultsTab,
      (recipeId, machineId) => void this.openRecipe(recipeId, machineId),
    );
    byId<HTMLInputElement>("opt-near").checked = this.state.nearMatchOn;
  }

  private currentRecipe(): RecipeCard | null {
    return this.state.selectedRecipeId ? this.recipes.get(this.state.selectedRecipeId) ?? null : null;
  }

  async openRecipe(id: string, machineId?: string, opts?: { fromCatalog?: boolean; keepFlour?: boolean }): Promise<void> {
    const recipe = this.recipes.get(id);
    if (!recipe) return;
    this.state.selectedRecipeId = id;
    this.state.selectedMachineId = machineId || this.state.defaultMachineId || "panasonic_sd_yr2540hts";
    if (!opts?.keepFlour) {
      this.state.targetFlourG = Math.min(600, Math.max(300, Math.round(recipe.baseTotalFlourG)));
    }
    syncAddins(this.state, id);
    this.expanded = null;
    this.state.recent = pushRecent(this.state.recent, id);
    if (opts?.fromCatalog) {
      byId<HTMLDetailsElement>("catalog-details").open = false;
      this.state.catalogOpen = false;
    }
    byId("recipe-workspace").classList.remove("hidden");
    byId("calibration").classList.remove("hidden");
    this.persistNow();
    await this.refreshCalc(true);
    byId("recipe-workspace").scrollIntoView({ behavior: "smooth", block: "start" });
    void this.renderCatalog();
  }

  private setFlour(value: number, commit: boolean): void {
    this.state.targetFlourG = clampFlour(value);
    renderScale(this.state.targetFlourG);
    if (this.calcTimer) window.clearTimeout(this.calcTimer);
    if (commit) {
      this.calcTimer = null;
      void this.refreshCalc(true);
      this.persistNow();
    } else {
      this.calcTimer = window.setTimeout(() => void this.refreshCalc(true), 120);
      this.persistSoon();
    }
  }

  private async refreshCalc(paint: boolean): Promise<void> {
    const recipe = this.currentRecipe();
    const machineId = this.state.selectedMachineId;
    if (!recipe || !machineId) return;
    const token = ++this.calcToken;
    const calibration = currentCalibration(this.state);
    try {
      const result = await this.api.calculateRecipe({
        recipeId: recipe.id,
        machineId,
        targetFlourG: this.state.targetFlourG,
        enabledAddins: enabledAddinIds(this.state, recipe.id),
        pantry: selectedPantry(this.state.pantry),
        calibration: calibration
          ? { actualFinishedWeightG: calibration.actualFinishedWeightG, predictedMid: calibration.predictedMid }
          : null,
      });
      if (token !== this.calcToken) return;
      this.calc = result;
      if (paint) this.paintWorkspace(recipe);
    } catch (error) {
      if (token !== this.calcToken) return;
      toast(error instanceof Error ? error.message : "Не удалось рассчитать рецепт", "err");
    }
  }

  private paintWorkspace(recipe: RecipeCard): void {
    const calc = this.calc;
    if (!calc) return;
    byId("ws-title").textContent = recipe.title;
    const bits = [recipe.specialty || recipe.description, recipe.category, recipe.sourceNotes].filter(Boolean);
    byId("ws-desc").textContent = bits.join(" · ");
    renderMachinePicker(byId("machine-picker"), recipe, this.machines, this.state.selectedMachineId ?? "", (id) => {
      this.state.selectedMachineId = id;
      this.persistNow();
      void this.refreshCalc(true);
    });
    renderScale(this.state.targetFlourG);
    renderWarnings(byId("scale-warnings"), calc.warnings);
    renderKpis(byId("kpi-grid"), calc);
    this.paintTable();
    renderAddins(byId("addins-grid"), calc.addinPreviews, this.state.enabledTasteAddins, this.state.targetFlourG, (id, on) => {
      syncAddins(this.state, recipe.id);
      this.state.addinsByRecipe[recipe.id]![id] = on;
      this.state.enabledTasteAddins = this.state.addinsByRecipe[recipe.id]!;
      this.persistNow();
      void this.refreshCalc(true);
    });
    renderSteps(byId("steps-list"), calc.cookSteps, calc.profileWarnings);
    renderShopping(byId("shopping-panel"), calc.shopping, (id) => {
      this.state.pantry[id] = true;
      this.persistNow();
      this.renderPantry();
      void this.refreshCalc(true);
      if (this.state.catalogCanBake) void this.renderCatalog();
    });
    const favorite = this.state.favorites.includes(recipe.id);
    byId("btn-favorite").textContent = favorite ? "★ В избранном" : "☆ В избранное";
  }

  private paintTable(): void {
    if (!this.calc) return;
    renderIngredientTable(byId("ing-tbody"), byId("ing-mobile"), this.calc.items, this.expanded, (id) => {
      this.expanded = this.expanded === id ? null : id;
      this.paintTable();
    });
  }

  private toggleFavorite(): void {
    const id = this.state.selectedRecipeId;
    if (!id) return;
    const had = this.state.favorites.includes(id);
    this.state.favorites = toggleFavorite(this.state.favorites, id);
    this.persistNow();
    byId("btn-favorite").textContent = had ? "☆ В избранное" : "★ В избранном";
    toast(had ? "Убрано из избранного" : "Добавлено в избранное", "ok");
    void this.renderCatalog();
  }

  private resetAddins(): void {
    const id = this.state.selectedRecipeId;
    if (id) this.state.addinsByRecipe[id] = {};
    this.state.enabledTasteAddins = id ? this.state.addinsByRecipe[id]! : {};
    this.persistNow();
    void this.refreshCalc(true);
    toast("Добавки сброшены", "ok");
  }

  private async copyIngredients(): Promise<void> {
    const recipe = this.currentRecipe();
    if (!recipe || !this.calc) {
      toast("Сначала откройте рецепт", "warn");
      return;
    }
    const lines = this.calc.items.map((row) => `${copyName(row.name, row.isAddin)} — ${row.gramsText} г`);
    await this.copy(`${recipe.title} (${this.state.targetFlourG} г муки)\n${lines.join("\n")}`);
  }

  private async copyShopping(): Promise<void> {
    const rows = this.calc?.shopping ?? [];
    if (!rows.length) {
      toast("Для этого рецепта всё есть", "ok");
      return;
    }
    const title = this.currentRecipe()?.title ?? "Рецепт";
    await this.copy(`Не хватает для «${title}»:\n${rows.map((row) => `${row.name} — ${row.gramsText} г`).join("\n")}`);
  }

  private async copy(text: string): Promise<void> {
    try {
      await writeText(text);
      toast("Скопировано", "ok");
    } catch {
      toast("Не удалось скопировать", "err");
    }
  }

  private saveCalibration(): void {
    if (!this.state.selectedRecipeId || !this.calc) {
      toast("Сначала откройте рецепт", "warn");
      return;
    }
    const { weight, fill } = readCalibrationInputs();
    if (!Number.isFinite(weight) || weight < 50) {
      toast("Введите фактический вес", "warn");
      return;
    }
    this.state.calibrations.push({
      recipeId: this.state.selectedRecipeId,
      machineId: this.state.selectedMachineId,
      targetFlourG: this.state.targetFlourG,
      actualFinishedWeightG: weight,
      peakFillPercent: Number.isFinite(fill) ? fill : null,
      predictedMid: this.calc.uncalibratedMidG,
      timestamp: new Date().toISOString(),
    });
    this.persistNow();
    setCalibrationStatus("Сохранено. Следующий прогноз для этого рецепта будет с поправкой.");
    void this.refreshCalc(true);
    toast("Калибровка сохранена", "ok");
  }

  private isCookOpen(): boolean {
    const overlay = document.getElementById("cook-overlay");
    return !!overlay && !overlay.classList.contains("hidden");
  }

  private async openCook(resume: boolean): Promise<void> {
    const recipe = this.currentRecipe();
    if (!recipe) {
      toast("Сначала откройте рецепт", "warn");
      return;
    }
    const machineId = this.state.selectedMachineId;
    if (!machineId || !this.machines[machineId]) {
      toast("Выберите машину", "warn");
      return;
    }
    const key = machineId === "redmond_rmc_m92s" ? "redmond" : "panasonic";
    const profile = recipe[key];
    if (!profile.compatible) {
      toast("Рецепт несовместим с выбранной машиной", "err");
      return;
    }
    if (!this.calc || this.calc.recipeId !== recipe.id || this.calc.machineId !== machineId) {
      await this.refreshCalc(true);
    }
    if (!this.calc) return;
    const addinKey = enabledAddinIds(this.state, recipe.id).join(",");
    let ckKey = `${recipe.id}::${machineId}::addins:${addinKey}`;
    if (resume && this.state.cookSession?.ckKey) ckKey = this.state.cookSession.ckKey;
    if (!this.state.checklist[ckKey]) this.state.checklist[ckKey] = {};
    this.cookKey = ckKey;
    this.cookSteps = this.calc.cookSteps;
    this.cookIndex = resume && this.state.cookSession ? this.state.cookSession.stepIndex || 0 : 0;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    byId("cook-overlay").classList.remove("hidden");
    document.body.classList.add("cook-open");
    byId("cook-sub").textContent = `${recipe.title} · ${this.machines[machineId]?.name ?? ""}`;
    this.timer.clearAll();
    const timers = profile.timers.length ? profile.timers : [{ id: "custom", label: "Таймер", minutes: 10 }];
    const first = timers[0]!;
    this.timer.ensure(`${ckKey}::${first.id}`, first.label, first.minutes);
    byId("timer-label").textContent = first.id === "custom"
      ? "Таймер 10 мин"
      : `${first.label} (${first.minutes} мин)`;
    if (resume && this.state.cookSession?.remainingMs != null) {
      this.timer.setRemaining(this.state.cookSession.remainingMs);
    }
    this.paintCook();
    this.saveCookSession();
    window.setTimeout(() => byId("btn-close-cook").focus(), 0);
  }

  private paintCook(): void {
    renderCookSteps(
      byId("cook-steps"),
      byId("cook-progress"),
      byId("cook-progress-label"),
      byId<HTMLButtonElement>("cook-prev"),
      this.cookSteps,
      this.state.checklist[this.cookKey] ?? {},
      this.cookIndex,
      this.state.targetFlourG,
      this.calc?.doughMassG ?? 0,
      (id, checked) => {
        if (!this.state.checklist[this.cookKey]) this.state.checklist[this.cookKey] = {};
        this.state.checklist[this.cookKey]![id] = checked;
        this.saveCookSession();
        this.paintCook();
      },
    );
  }

  private cookPrev(): void {
    if (!this.isCookOpen()) return;
    if (this.cookIndex <= 0) {
      this.closeCook();
      return;
    }
    this.cookIndex -= 1;
    this.saveCookSession();
    this.paintCook();
    document.querySelector("#cook-steps .cook-step.current")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  private cookNext(): void {
    if (!this.isCookOpen() || !this.cookKey) return;
    const current = this.cookSteps[this.cookIndex];
    if (!this.state.checklist[this.cookKey]) this.state.checklist[this.cookKey] = {};
    if (current) this.state.checklist[this.cookKey]![current.id] = true;
    this.cookIndex = Math.min(Math.max(this.cookSteps.length - 1, 0), this.cookIndex + 1);
    this.saveCookSession();
    this.paintCook();
    document.querySelector("#cook-steps .cook-step.current")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  private cookReset(): void {
    if (!this.isCookOpen() || !this.cookKey) return;
    this.state.checklist[this.cookKey] = {};
    this.cookIndex = 0;
    this.saveCookSession();
    this.paintCook();
  }

  private cycleTimer(): void {
    const recipe = this.currentRecipe();
    if (!recipe || !this.state.selectedMachineId) return;
    const key = this.state.selectedMachineId === "redmond_rmc_m92s" ? "redmond" : "panasonic";
    const timers = recipe[key].timers;
    if (timers.length < 2) return;
    const active = this.timer.active();
    const index = Math.max(0, timers.findIndex((item) => `${this.cookKey}::${item.id}` === active?.id));
    const next = timers[(index + 1) % timers.length]!;
    this.timer.ensure(`${this.cookKey}::${next.id}`, next.label, next.minutes);
    byId("timer-label").textContent = `${next.label} (${next.minutes} мин)`;
  }

  private saveCookSession(): void {
    if (!this.state.selectedRecipeId) return;
    const snap = this.timer.snapshot();
    this.state.cookSession = {
      recipeId: this.state.selectedRecipeId,
      machineId: this.state.selectedMachineId,
      stepIndex: this.cookIndex,
      timerId: this.timer.active()?.id.split("::").pop() ?? null,
      ckKey: this.cookKey || null,
      remainingMs: snap.remainingMs,
      running: false,
    };
    this.persistNow();
    this.renderResume();
  }

  private closeCook(): void {
    byId("cook-overlay").classList.add("hidden");
    document.body.classList.remove("cook-open");
    this.timer.pauseAll();
    this.saveCookSession();
    const back = this.returnFocus ?? byId("btn-cook");
    this.returnFocus = null;
    try { back.focus(); } catch { /* element may already be gone */ }
  }

  private renderResume(): void {
    const bar = byId("resume-cook");
    const session = this.state.cookSession;
    bar.replaceChildren();
    if (!session?.recipeId || !this.recipes.has(session.recipeId)) {
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");
    const inner = document.createElement("div");
    inner.className = "resume-bar-inner";
    const text = document.createElement("span");
    text.textContent = `Продолжить: ${this.recipes.get(session.recipeId)?.title ?? ""}, шаг ${(session.stepIndex || 0) + 1}`;
    const go = document.createElement("button");
    go.type = "button";
    go.className = "btn btn-primary";
    go.textContent = "Продолжить";
    go.addEventListener("click", () => {
      void this.openRecipe(session.recipeId, session.machineId ?? undefined, { keepFlour: true }).then(() => this.openCook(true));
    });
    const drop = document.createElement("button");
    drop.type = "button";
    drop.className = "btn btn-ghost";
    drop.textContent = "Сбросить";
    drop.addEventListener("click", () => {
      this.state.cookSession = null;
      this.persistNow();
      this.renderResume();
    });
    inner.append(text, go, drop);
    bar.append(inner);
  }

  private async exportJson(): Promise<void> {
    const path = await save({
      title: "Экспорт BreadLab",
      defaultPath: "breadlab-export.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await this.api.exportState(path);
      toast("Экспорт JSON сохранён", "ok");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Не удалось экспортировать", "err");
    }
  }

  private async importJson(): Promise<void> {
    const picked = await open({
      title: "Импорт BreadLab",
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!picked || Array.isArray(picked)) return;
    try {
      const loaded = await this.api.importState(picked);
      this.state = { ...defaultState(), ...loaded.state };
      syncAddins(this.state, this.state.selectedRecipeId);
      this.applyShell();
      this.renderPantry();
      await this.renderCatalog();
      this.renderResume();
      if (this.state.selectedRecipeId && this.recipes.has(this.state.selectedRecipeId)) {
        byId("recipe-workspace").classList.remove("hidden");
        byId("calibration").classList.remove("hidden");
        await this.refreshCalc(true);
      }
      toast(loaded.notice ?? "Импорт выполнен", "ok");
    } catch (error) {
      toast(`Ошибка импорта: ${error instanceof Error ? error.message : "некорректный JSON"}`, "err");
    }
  }

  private persistSoon(): void {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.persistNow();
    }, 200);
  }

  private persistNow(): void {
    if (this.saveTimer) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    void this.api.saveState(this.state).then(() => {
      this.saveFailed = false;
    }).catch(() => {
      if (!this.saveFailed) {
        this.saveFailed = true;
        toast("Не удалось сохранить данные", "err");
        byId("storage-banner").classList.remove("hidden");
      }
    });
  }
}

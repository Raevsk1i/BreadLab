import type { PersistedState, AppUiState } from "../types/state";
import { createUiState, defaultPersistedState } from "../types/state";
import * as api from "./tauriApi";
import { debounce } from "../utils/formatting";

export class StateManager {
  state: AppUiState = createUiState();
  private persistImpl = debounce(() => {
    void this.persistNow();
  }, 200);

  toPersisted(): PersistedState {
    const s = this.state;
    return {
      schemaVersion: 1,
      pantry: s.pantry,
      staplesOn: s.staplesOn,
      nearMatchOn: s.nearMatchOn,
      favorites: s.favorites,
      recent: s.recent,
      calibrations: s.calibrations,
      enabledTasteAddins: s.enabledTasteAddins,
      addinsByRecipe: s.addinsByRecipe,
      cookSession: s.cookSession
        ? { ...s.cookSession, running: false }
        : null,
      defaultMachineId: s.defaultMachineId,
      largeSteps: s.largeSteps,
      catalogDifficulty: s.catalogDifficulty,
      catalogFavoritesOnly: s.catalogFavoritesOnly,
      catalogCanBake: s.catalogCanBake,
      selectedRecipeId: s.selectedRecipeId,
      selectedMachineId: s.selectedMachineId,
      targetFlourG: s.targetFlourG,
      checklist: s.checklist,
      catalogOpen: s.catalogOpen ?? true,
    };
  }

  applyPersisted(data: PersistedState): void {
    const base = defaultPersistedState();
    this.state = createUiState({
      ...base,
      ...data,
      pantry: data.pantry ?? {},
      favorites: data.favorites ?? [],
      recent: data.recent ?? [],
      calibrations: data.calibrations ?? [],
      addinsByRecipe: data.addinsByRecipe ?? {},
      enabledTasteAddins: data.enabledTasteAddins ?? {},
      checklist: data.checklist ?? {},
      cookSession: data.cookSession
        ? { ...data.cookSession, running: false }
        : null,
    });
  }

  schedulePersist(): void {
    this.persistImpl();
  }

  async persistNow(): Promise<boolean> {
    try {
      await api.saveState(this.toPersisted());
      return true;
    } catch {
      return false;
    }
  }

  async restore(): Promise<boolean> {
    const { state, recoveredFromBackup } = await api.loadState();
    this.applyPersisted(state);
    return recoveredFromBackup;
  }

  syncAddinsFor(recipeId: string | null): void {
    if (!recipeId) return;
    if (!this.state.addinsByRecipe[recipeId]) {
      this.state.addinsByRecipe[recipeId] = {};
    }
    this.state.enabledTasteAddins = this.state.addinsByRecipe[recipeId];
  }

  pruneChecklist(): void {
    const keep = new Set<string>();
    if (this.state.selectedRecipeId && this.state.selectedMachineId) {
      keep.add(`${this.state.selectedRecipeId}::${this.state.selectedMachineId}`);
    }
    if (this.state.cookSession) {
      keep.add(this.state.cookSession.ckKey.split("::addins:")[0] ?? "");
    }
    for (const id of this.state.recent.slice(0, 6)) keep.add(id);
    const keys = Object.keys(this.state.checklist);
    if (keys.length <= 8) return;
    const ranked = keys.sort((a, b) => {
      const as = [...keep].some((k) => a.startsWith(k)) ? 0 : 1;
      const bs = [...keep].some((k) => b.startsWith(k)) ? 0 : 1;
      return as - bs;
    });
    for (const k of ranked.slice(8)) delete this.state.checklist[k];
  }
}

export const stateManager = new StateManager();

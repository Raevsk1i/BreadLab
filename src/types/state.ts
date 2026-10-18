export interface CalibrationEntry {
  recipeId: string;
  machineId: string;
  targetFlourG: number;
  actualFinishedWeightG: number;
  peakFillPercent?: number | null;
  predictedMid: number;
  timestamp: string;
}

export interface CookSession {
  recipeId: string;
  machineId: string;
  stepIndex: number;
  timerId?: string | null;
  ckKey: string;
  remainingMs: number;
  running: boolean;
}

export interface PersistedState {
  schemaVersion?: number;
  pantry: Record<string, boolean>;
  staplesOn: boolean;
  nearMatchOn: boolean;
  favorites: string[];
  recent: string[];
  calibrations: CalibrationEntry[];
  enabledTasteAddins: Record<string, boolean>;
  addinsByRecipe: Record<string, Record<string, boolean>>;
  cookSession: CookSession | null;
  defaultMachineId: string;
  largeSteps: boolean;
  catalogDifficulty: string;
  catalogFavoritesOnly: boolean;
  catalogCanBake: boolean;
  selectedRecipeId: string | null;
  selectedMachineId: string | null;
  targetFlourG: number;
  checklist: Record<string, Record<string, boolean>>;
  catalogOpen?: boolean | null;
}

export interface TimerState {
  durationMs: number;
  remainingMs: number;
  running: boolean;
  deadline: number | null;
  label: string;
}

export interface AppUiState extends PersistedState {
  pantryCategory: string;
  pantryQuery: string;
  catalogCategory: string;
  catalogQuery: string;
  searchRan: boolean;
  results: import("./recipe").MatchResult[];
  resultsTab: string;
  cookStepIndex: number;
  timers: Record<string, TimerState>;
  expandedIng: string | null;
  activeTimerId: string | null;
}

export function defaultPersistedState(): PersistedState {
  return {
    schemaVersion: 1,
    pantry: {},
    staplesOn: true,
    nearMatchOn: true,
    favorites: [],
    recent: [],
    calibrations: [],
    enabledTasteAddins: {},
    addinsByRecipe: {},
    cookSession: null,
    defaultMachineId: "panasonic_sd_yr2540hts",
    largeSteps: false,
    catalogDifficulty: "all",
    catalogFavoritesOnly: false,
    catalogCanBake: false,
    selectedRecipeId: null,
    selectedMachineId: null,
    targetFlourG: 450,
    checklist: {},
    catalogOpen: true,
  };
}

export function createUiState(base?: Partial<PersistedState>): AppUiState {
  const p = { ...defaultPersistedState(), ...base };
  return {
    ...p,
    pantryCategory: "all",
    pantryQuery: "",
    catalogCategory: "all",
    catalogQuery: "",
    searchRan: false,
    results: [],
    resultsTab: "panasonic",
    cookStepIndex: 0,
    timers: {},
    expandedIng: null,
    activeTimerId: null,
  };
}

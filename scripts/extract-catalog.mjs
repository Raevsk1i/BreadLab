#!/usr/bin/env node
/**
 * One-shot extractor for BreadLab reference data and golden calculation fixtures.
 * Runs the original HTML script in a Node vm at build time only.
 * Production never evaluates the HTML.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.resolve(process.argv[2] || path.join(root, "bread_lab.html"));
const dataDir = path.join(root, "src-tauri", "data");
const fixtureDir = path.join(root, "src-tauri", "tests", "fixtures");

const html = fs.readFileSync(htmlPath, "utf8");
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
if (!scriptMatch) {
  console.error("No script block in", htmlPath);
  process.exit(1);
}

let source = scriptMatch[1];
const cutAt = source.indexOf("/* =========================================================\n   * State & persistence");
if (cutAt < 0) {
  console.error("Cut marker for state section not found");
  process.exit(1);
}
source = source.slice(0, cutAt);
source = source.replace(/^\(function\s*\(\)\s*\{/, "");

const stepsStart = scriptMatch[1].indexOf("  function buildAddinInstructionSteps");
const stepsEnd = scriptMatch[1].indexOf("  function renderSteps");
if (stepsStart < 0 || stepsEnd < 0) {
  console.error("Cooking step functions not found");
  process.exit(1);
}
source += "\n" + scriptMatch[1].slice(stepsStart, stepsEnd);

const orderMatch = html.match(/var CATALOG_CATEGORY_ORDER = (\[[\s\S]*?\]);/);
if (!orderMatch) {
  console.error("CATALOG_CATEGORY_ORDER not found");
  process.exit(1);
}

const sandbox = {
  console,
  Object,
  Array,
  Math,
  String,
  Number,
  Boolean,
  JSON,
  Date,
  RegExp,
  Error,
  Map,
  Set,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
};
vm.createContext(sandbox);

const wrapped = `
${source}
const CATALOG_CATEGORY_ORDER = ${orderMatch[1]};
globalThis.__api = {
  DB,
  CATALOG_CATEGORY_ORDER,
  scaleRecipe,
  calculateHydration,
  calculateDoughMass,
  estimateFinishedWeight,
  estimateProofVolume,
  calculateDispenserLoad,
  validateMachineLimits,
  resolveIngredientId,
  matchRecipes,
  buildShoppingList,
  formatGrams,
  getCookingSteps,
  fillStepText,
  placementLabel,
  stageLabel,
};
`;
vm.runInContext(wrapped, sandbox, { timeout: 15000, filename: "bread_lab_extract.js" });
const api = sandbox.__api;
const db = api.DB;
if (!db?.recipes || !db.ingredients) {
  console.error("Extraction failed");
  process.exit(1);
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(fixtureDir, { recursive: true });

function writeJson(dir, name, data) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  return p;
}

const recipeIds = Object.keys(db.recipes);
const ingredientIds = Object.keys(db.ingredients);

writeJson(dataDir, "ingredients.json", db.ingredients);
writeJson(dataDir, "machines.json", db.machines);
writeJson(dataDir, "recipes.json", db.recipes);
writeJson(dataDir, "addins.json", db.tasteAddins);
writeJson(dataDir, "meta.json", {
  version: db.version,
  alwaysAvailable: db.alwaysAvailable,
  staples: db.staples || [],
  categories: db.categories,
  catalogCategoryOrder: api.CATALOG_CATEGORY_ORDER,
  recipeCount: recipeIds.length,
  ingredientCount: ingredientIds.length,
  recipeIds,
  ingredientIds,
});

const errors = [];
if (recipeIds.length !== 35) errors.push(`recipes ${recipeIds.length}`);
for (let i = 1; i <= 35; i++) {
  const id = "p" + String(i).padStart(2, "0");
  const recipe = db.recipes[id];
  if (!recipe) {
    errors.push(`missing ${id}`);
    continue;
  }
  if (!recipe.specialty || recipe.specialty.length <= 20) errors.push(`${id} specialty`);
  if (!recipe.category) errors.push(`${id} category`);
  if (!recipe.ingredients?.length) errors.push(`${id} ingredients`);
  if (!recipe.machineProfiles?.panasonic?.programNo) errors.push(`${id} program`);
  for (const row of recipe.ingredients) {
    if (row.grams == null || !row.ingredientId || !row.placement) {
      errors.push(`${id} incomplete row ${row.ingredientId}`);
    }
    if (!row.unit) errors.push(`${id} enrichment unit ${row.ingredientId}`);
  }
}
const expectedPrograms = {
  p01: "01", p02: "02", p06: "05", p07: "09", p10: "06", p11: "07",
  p16: "10", p25: "04", p29: "03", p32: "11", p34: "12",
};
for (const [id, no] of Object.entries(expectedPrograms)) {
  if (db.recipes[id].machineProfiles.panasonic.programNo !== no) {
    errors.push(`${id} program expected ${no}`);
  }
}
if (db.recipes.p01.title !== "Нарезной белый") errors.push("p01 title");
if (db.recipes.p15.title !== "Дарницкий") errors.push("p15 title");
if (db.recipes.p16.title !== "Бородинский") errors.push("p16 title");
if (db.ingredients.potato.name !== "Картофель") errors.push("potato name");
if (!db.ingredients.salt.hideFromPantry || !db.ingredients.sugar.hideFromPantry) errors.push("hidden staples");
if (db.machines.panasonic_sd_yr2540hts.programs["01"] !== "Основной") errors.push("prog 01");
if (db.recipes.p01.machineProfiles.redmond.flip.required !== false) errors.push("flip");

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function summarizeScaled(recipeId, flour, addins, calibration) {
  const recipe = db.recipes[recipeId];
  const scaled = api.scaleRecipe(recipe, flour, addins);
  const hydration = api.calculateHydration(scaled, recipe);
  const dough = api.calculateDoughMass(scaled);
  const fin = api.estimateFinishedWeight(dough, recipe.physics.bakeLossRange, calibration || null);
  const vol = api.estimateProofVolume(dough, recipe.physics);
  const disp = api.calculateDispenserLoad(scaled);
  const warnings = {};
  for (const machineId of ["panasonic_sd_yr2540hts", "redmond_rmc_m92s"]) {
    warnings[machineId] = api.validateMachineLimits(machineId, recipe, scaled);
  }
  const machineKey = "panasonic";
  const steps = api.getCookingSteps(recipe, machineKey, scaled).map((s) => ({
    id: s.id,
    isAddin: !!s.isAddin,
    text: api.fillStepText(s.text, scaled),
  }));
  return {
    recipeId,
    flour,
    addins,
    calibration: calibration || null,
    factor: scaled.factor,
    hydration,
    doughMass: dough,
    finished: fin,
    volume: vol,
    dispenser: disp,
    items: scaled.items.map((row) => ({
      ingredientId: row.ingredientId,
      grams: row.grams,
      bakerPct: row.bakerPct,
      gramsText: api.formatGrams(row.ingredientId, row.grams),
    })),
    addinRows: scaled.addins.map((row) => ({
      addinId: row.addinId,
      ingredientId: row.ingredientId,
      grams: row.grams,
      bakerPct: row.bakerPct,
      gramsText: api.formatGrams(row.ingredientId, row.grams),
    })),
    warnings,
    panasonicSteps: steps,
  };
}

const cases = [];
const flours = [300, 400, 450, 600];
for (const id of recipeIds) {
  const base = db.recipes[id].baseTotalFlourG;
  const set = new Set(flours);
  set.add(base);
  for (const flour of set) {
    cases.push(summarizeScaled(id, flour, []));
  }
}
cases.push(summarizeScaled("p01", 349, []));
cases.push(summarizeScaled("p01", 350, []));
cases.push(summarizeScaled("p01", 601, []));
cases.push(summarizeScaled("p01", 400, ["walnut", "raisin"]));
cases.push(summarizeScaled("p15", 500, []));
cases.push(summarizeScaled("p27", 400, ["cheese_add"]));
const p01mass = api.calculateDoughMass(api.scaleRecipe(db.recipes.p01, 400, []));
const plain = api.estimateFinishedWeight(p01mass, db.recipes.p01.physics.bakeLossRange);
const mid = (plain.min + plain.max) / 2;
cases.push(summarizeScaled("p01", 400, [], { actualFinishedWeightG: mid * 1.1, predictedMid: mid }));

const pantry = ["wheat_flour", "yeast", "oil"];
const matches = api.matchRecipes(new Set(pantry), { nearMatch: true }).map((m) => ({
  recipeId: m.recipeId,
  machineKey: m.machineKey,
  machineId: m.machineId,
  status: m.status,
  missing: m.missing,
  score: m.score,
  programLabel: m.programLabel,
  timeMin: m.timeMin,
}));
const exactOnly = api.matchRecipes(new Set(pantry), { nearMatch: false }).map((m) => ({
  recipeId: m.recipeId,
  machineKey: m.machineKey,
  status: m.status,
  missing: m.missing,
}));

const resolveCases = [
  "хлебопекарная мука",
  "пшеничная мука",
  "wheat_flour",
  "Вода",
  "нет такого",
  "мука ржаная обдирная",
].map((token) => ({ token, id: api.resolveIngredientId(token) }));

const shopping = api.buildShoppingList(api.matchRecipes(new Set(pantry), { nearMatch: true }));

writeJson(fixtureDir, "golden.json", {
  generatedFrom: path.basename(htmlPath),
  recipeCount: recipeIds.length,
  cases,
  search: { pantry, near: matches, exactOnly, shopping },
  resolve: resolveCases,
  programs: Object.fromEntries(
    recipeIds.map((id) => [id, db.recipes[id].machineProfiles.panasonic.programNo])
  ),
});

function collectKeys(value, prefix, acc) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    acc.add(pathKey);
    const child = value[key];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      collectKeys(child, pathKey, acc);
    }
  }
}

const keySet = new Set();
for (const recipe of Object.values(db.recipes)) collectKeys(recipe, "recipe", keySet);
console.log("Recipe key paths:", [...keySet].sort().join("\n"));

if (errors.length) {
  console.error("VALIDATION FAILED");
  errors.forEach((e) => console.error(" -", e));
  process.exit(2);
}

const p01 = cases.find((c) => c.recipeId === "p01" && c.flour === 400 && c.addins.length === 0 && !c.calibration);
const water = p01.items.find((i) => i.ingredientId === "water");
const p01_600 = cases.find((c) => c.recipeId === "p01" && c.flour === 600 && c.addins.length === 0 && !c.calibration);
const water600 = p01_600.items.find((i) => i.ingredientId === "water");
if (Math.abs(p01.hydration - 65) > 0.2) errors.push("hydration");
if (Math.abs(water600.grams - 390) > 0.01) errors.push("water 600");
if (errors.length) {
  console.error(errors);
  process.exit(2);
}

console.log("OK", recipeIds.length, "recipes,", ingredientIds.length, "ingredients,", cases.length, "golden cases");
console.log("p01/400 hydration", round6(p01.hydration), "water600", water.grams, water600.grams);
console.log("search matches", matches.length);

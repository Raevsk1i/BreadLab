#!/usr/bin/env node
/**
 * Generate golden calculation fixtures from the original bread_lab.html JS kernel.
 * Build/test time only — not shipped in the Tauri app.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "bread_lab.html"), "utf8");
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
const script = scriptMatch[1];

const startMarker = "/* =========================================================\n   * DataDB";
const endMarker = "/* =========================================================\n   * State & persistence";
const startIdx = script.indexOf(startMarker);
const endIdx = script.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0) {
  console.error("Could not locate DataDB + calc block");
  process.exit(1);
}

const block = script.slice(startIdx, endIdx);
const wrapped = `"use strict";\n${block}\nthis.__API__ = {
  DB,
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
  getTotalFlourG,
  formatGrams
};\n`;

const sandbox = { console, Object, Array, Math, JSON, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite, undefined };
sandbox.globalThis = sandbox;
vm.runInNewContext(wrapped, sandbox, { filename: "breadlab-kernel.js", timeout: 15000 });
const api = sandbox.__API__;
const { DB } = api;

const p01 = DB.recipes.p01;
const scaled400 = api.scaleRecipe(p01, 400, []);
const scaled600 = api.scaleRecipe(p01, 600, []);
const hydr400 = api.calculateHydration(scaled400, p01);
const water600 = scaled600.items.find((r) => r.ingredientId === "water").grams;
const mass400 = api.calculateDoughMass(scaled400);
const finished = api.estimateFinishedWeight(mass400, p01.physics.bakeLossRange, null);
const volume = api.estimateProofVolume(mass400, p01.physics);

function warns(flour) {
  const scaled = api.scaleRecipe(p01, flour, []);
  return api.validateMachineLimits("panasonic_sd_yr2540hts", p01, scaled).map((w) => ({
    level: w.level,
    code: w.code,
  }));
}

const scaledDisp = api.scaleRecipe(p01, 400, ["raisin"]);
// Force dispenser overload like self-test: synthetic 160g add-in row
const synth = JSON.parse(JSON.stringify(scaledDisp));
synth.all.push({
  ingredientId: "raisin",
  grams: 160,
  placement: { panasonic: "raisinNutDispenser", redmond: "manual" },
  isAddin: true,
});
const dispLoad = api.calculateDispenserLoad(synth);
const dispWarns = api.validateMachineLimits("panasonic_sd_yr2540hts", p01, synth).filter((w) =>
  w.code.startsWith("dispenser")
);

const p15 = DB.recipes.p15;
const s400 = api.scaleRecipe(p15, 400, []);
const s500 = api.scaleRecipe(p15, 500, []);
function flourRatio(scaled) {
  const rye = scaled.items.find((r) => r.ingredientId === "rye_flour").grams;
  const wheat = scaled.items.find((r) => r.ingredientId === "wheat_flour").grams;
  return rye / wheat;
}

const pantry = new Set(["wheat_flour", "yeast", "oil"]);
const matches = api.matchRecipes(pantry, { nearMatch: true });

const goldens = {
  recipeCount: Object.keys(DB.recipes).length,
  p01_scale_factor_600: api.scaleRecipe(p01, 600, []).factor,
  p01_water_600: water600,
  p01_hydration_400: hydr400,
  p01_dough_mass_400: mass400,
  p01_finished_400: finished,
  p01_volume_400: volume,
  panasonic_warns: {
    f349: warns(349),
    f350: warns(350),
    f600: warns(600),
    f601: warns(601),
  },
  dispenser_over_150: {
    load: dispLoad,
    codes: dispWarns.map((w) => w.code),
    levels: dispWarns.map((w) => w.level),
  },
  mixed_flour_ratio: {
    at400: flourRatio(s400),
    at500: flourRatio(s500),
  },
  alias_wheat: api.resolveIngredientId("хлебопекарная мука"),
  match_count: matches.length,
  match_has_exact_or_near: matches.some((m) => m.status === "exact" || m.status === "near"),
  programs: {
    p01: DB.recipes.p01.machineProfiles.panasonic.programNo,
    p02: DB.recipes.p02.machineProfiles.panasonic.programNo,
    p07: DB.recipes.p07.machineProfiles.panasonic.programNo,
    p16: DB.recipes.p16.machineProfiles.panasonic.programNo,
    p32: DB.recipes.p32.machineProfiles.panasonic.programNo,
  },
};

const outDir = path.join(root, "src-tauri", "tests", "goldens");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "calc.json"), JSON.stringify(goldens, null, 2) + "\n");
console.log("Wrote", path.join(outDir, "calc.json"));
console.log(JSON.stringify(goldens, null, 2));

#!/usr/bin/env node
/**
 * Extract normalized BreadLab DB from bread_lab.html after JS enrichment.
 * Usage: node tool/export_db.mjs [path-to-html]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const htmlPath = path.resolve(process.argv[2] || path.join(root, "bread_lab.html"));
const outDir = path.resolve(__dirname, "../assets/data");

const html = fs.readFileSync(htmlPath, "utf8");
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/i);
if (!scriptMatch) {
  console.error("No <script> block found in", htmlPath);
  process.exit(1);
}

let source = scriptMatch[1];
// Stop before DOM-dependent init; keep enrichment which runs at parse time.
const cutMarkers = [
  "/* =========================================================\n   * State & persistence",
  "/* =========================================================\n   * State & persistence\n   * ========================================================= */",
  "var STORAGE_KEY = \"breadlab_v1\";",
];
let cutAt = -1;
for (const m of cutMarkers) {
  const i = source.indexOf(m);
  if (i !== -1) {
    cutAt = i;
    break;
  }
}
if (cutAt === -1) {
  console.error("Could not find cut marker for state section");
  process.exit(1);
}
source = source.slice(0, cutAt);

// Convert IIFE to export capture
source = source.replace(/^\(function\s*\(\)\s*\{/, "");
source = source.replace(/\)\s*\(\)\s*;\s*$/, "");
// Remove trailing DOMContentLoaded / init wiring if any leaked
source = source.replace(/if\s*\(document\.readyState[\s\S]*$/, "");

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
  __result: null,
};
vm.createContext(sandbox);
const wrapped = `
${source}
__result = {
  version: DB.version,
  alwaysAvailable: DB.alwaysAvailable,
  staples: DB.staples,
  categories: DB.categories,
  ingredients: DB.ingredients,
  machines: DB.machines,
  recipes: DB.recipes,
  tasteAddins: DB.tasteAddins
};
`;
vm.runInContext(wrapped, sandbox, { timeout: 10000, filename: "bread_lab_db.js" });
const db = sandbox.__result;
if (!db || !db.recipes) {
  console.error("DB export failed");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function writeJson(name, data) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Wrote", p);
}

const recipeIds = Object.keys(db.recipes).sort();
const ingredientIds = Object.keys(db.ingredients).sort();

writeJson("meta.json", {
  version: db.version,
  alwaysAvailable: db.alwaysAvailable,
  staples: db.staples || [],
  recipeCount: recipeIds.length,
  ingredientCount: ingredientIds.length,
  exportedFrom: path.basename(htmlPath),
  exportedAt: new Date().toISOString(),
});
writeJson("categories.json", db.categories);
writeJson("ingredients.json", db.ingredients);
writeJson("machines.json", db.machines);
writeJson("taste_addins.json", db.tasteAddins);
writeJson("recipes.json", db.recipes);

// Validations
const errors = [];
if (recipeIds.length !== 35) errors.push(`Expected 35 recipes, got ${recipeIds.length}`);
for (let i = 1; i <= 35; i++) {
  const id = "p" + String(i).padStart(2, "0");
  if (!db.recipes[id]) errors.push(`Missing recipe ${id}`);
}
if (ingredientIds.length !== 54) {
  errors.push(`Expected 54 ingredients, got ${ingredientIds.length}`);
}
const pan = db.machines.panasonic_sd_yr2540hts;
if (!pan || pan.constraints.breadFlour[0] !== 350 || pan.constraints.breadFlour[1] !== 600) {
  errors.push("Panasonic breadFlour constraints mismatch");
}
if (!pan || pan.constraints.dispenserAddinsMaxG !== 150) {
  errors.push("Panasonic dispenser limit mismatch");
}
const red = db.machines.redmond_rmc_m92s;
if (!red || red.bowlVolumeMl !== 5000) errors.push("REDMOND bowlVolumeMl mismatch");

// Ensure enrichment applied (unit present on first row)
const p01 = db.recipes.p01;
if (!p01?.ingredients?.[0]?.unit) errors.push("Enrichment missing: unit on p01 ingredient");
if (p01?.ingredients?.[0]?.scalable == null) errors.push("Enrichment missing: scalable");

if (errors.length) {
  console.error("VALIDATION FAILED:");
  errors.forEach((e) => console.error(" -", e));
  process.exit(2);
}

console.log("OK:", recipeIds.length, "recipes,", ingredientIds.length, "ingredients");
console.log("Recipe ids:", recipeIds.join(", "));

#!/usr/bin/env node
/**
 * Build-time extraction of normalized DataDB from bread_lab.html.
 * Runs only the DB construction block in a Node vm sandbox — not used in production.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "bread_lab.html");
const outDir = path.join(root, "src-tauri", "src", "data");

const html = fs.readFileSync(htmlPath, "utf8");
const scriptMatch = html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/);
if (!scriptMatch) {
  console.error("Could not find main <script> block in bread_lab.html");
  process.exit(1);
}

const script = scriptMatch[1];
const startMarker = "/* =========================================================\n   * DataDB";
const endMarker = "/* =========================================================\n   * Pure calculation layer";
const startIdx = script.indexOf(startMarker);
const endIdx = script.indexOf(endMarker);
if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
  console.error("Could not locate DataDB block boundaries");
  process.exit(1);
}

const dbBlock = script.slice(startIdx, endIdx);
const wrapped = `"use strict";\n${dbBlock}\nthis.__BREADLAB_DB__ = DB;\n`;

const sandbox = {
  console,
  Object,
  Array,
  Math,
  JSON,
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
};
sandbox.globalThis = sandbox;

try {
  vm.runInNewContext(wrapped, sandbox, {
    filename: "breadlab-datadb.js",
    timeout: 10000,
  });
} catch (err) {
  console.error("Failed to evaluate DataDB block:", err);
  process.exit(1);
}

const DB = sandbox.__BREADLAB_DB__;
if (!DB || !DB.recipes) {
  console.error("DB was not produced");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const recipeIds = Object.keys(DB.recipes).sort();
const ingredientIds = Object.keys(DB.ingredients).sort();
const machineIds = Object.keys(DB.machines).sort();
const addinIds = Object.keys(DB.tasteAddins).sort();

const expectedRecipes = Array.from({ length: 35 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
const missing = expectedRecipes.filter((id) => !DB.recipes[id]);
const extra = recipeIds.filter((id) => !expectedRecipes.includes(id));

if (recipeIds.length !== 35 || missing.length || extra.length) {
  console.error("Recipe count/id check failed", { count: recipeIds.length, missing, extra });
  process.exit(1);
}

for (const id of recipeIds) {
  const r = DB.recipes[id];
  for (const field of [
    "id", "title", "category", "specialty", "description", "tags", "difficulty",
    "baseTotalFlourG", "flourComponents", "ingredients", "tasteAddinIds", "physics", "machineProfiles",
  ]) {
    if (r[field] == null) {
      console.error(`Recipe ${id} missing field ${field}`);
      process.exit(1);
    }
  }
  if (!r.machineProfiles.panasonic || !r.machineProfiles.redmond) {
    console.error(`Recipe ${id} missing machine profiles`);
    process.exit(1);
  }
  for (const row of r.ingredients) {
    for (const f of ["ingredientId", "grams", "isFlour", "stage", "unit", "scalable"]) {
      if (row[f] == null) {
        console.error(`Recipe ${id} ingredient row missing ${f}`, row);
        process.exit(1);
      }
    }
  }
}

const meta = {
  version: DB.version,
  alwaysAvailable: DB.alwaysAvailable,
  categories: DB.categories,
  staples: DB.staples || [],
};

fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "ingredients.json"), JSON.stringify(DB.ingredients, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "machines.json"), JSON.stringify(DB.machines, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "recipes.json"), JSON.stringify(DB.recipes, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "addins.json"), JSON.stringify(DB.tasteAddins, null, 2) + "\n");

console.log(JSON.stringify({
  ok: true,
  version: DB.version,
  recipes: recipeIds.length,
  ingredients: ingredientIds.length,
  machines: machineIds.length,
  tasteAddins: addinIds.length,
  outDir,
}, null, 2));

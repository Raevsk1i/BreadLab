# BreadLab Migration Map: HTML → Dart/Flutter

Источник: [`../bread_lab.html`](../../bread_lab.html) (не изменяется, остаётся для сверки).

Целевой проект: `breadlab/` — единая кодовая база Flutter для Android, MagicOS (Android APK) и HarmonyOS NEXT (HAP через OpenHarmony SIG Flutter).

## Данные

| HTML | Dart / Assets |
|------|----------------|
| `DB.version`, `DB.alwaysAvailable`, `DB.staples` | `assets/data/meta.json` → `CatalogMeta` |
| `DB.categories` | `assets/data/categories.json` → `Category` |
| `DB.ingredients` (+ pseudo add-in ings) | `assets/data/ingredients.json` → `Ingredient` |
| `DB.machines` | `assets/data/machines.json` → `Machine` |
| `DB.tasteAddins` | `assets/data/taste_addins.json` → `TasteAddin` |
| `DB.recipes` p01–p35 + enrichment 3296–3311 | `assets/data/recipes.json` → `Recipe` |
| `ing()` / `addin()` / `placePan()` / `stepTexts()` | `tool/export_db.mjs` (экспорт), runtime — модели |
| `tool/export_db.mjs` | Воспроизводимый экспорт из HTML |

## Расчётный движок

| HTML function | Dart |
|---------------|------|
| `getTotalFlourG` | `BreadLabCalculationEngine.getTotalFlourG` |
| `roundPresent` / `formatGrams` | `BreadLabCalculationEngine.roundPresent` / `formatGrams` |
| `scaleRecipe` | `BreadLabCalculationEngine.scaleRecipe` |
| `calculateHydration` | `BreadLabCalculationEngine.calculateHydration` |
| `calculateDoughMass` | `BreadLabCalculationEngine.calculateDoughMass` |
| `estimateFinishedWeight` | `BreadLabCalculationEngine.estimateFinishedWeight` |
| `estimateProofVolume` | `BreadLabCalculationEngine.estimateProofVolume` |
| `calculateDispenserLoad` | `BreadLabCalculationEngine.calculateDispenserLoad` |
| `validateMachineLimits` | `BreadLabCalculationEngine.validateMachineLimits` |
| `normalizeName` | `NameNormalizer.normalize` |
| `resolveIngredientId` | `NameNormalizer.resolveIngredientId` |
| `isAlwaysAvailable` | `RecipeMatcher.isAlwaysAvailable` |
| `recipeRequiredIds` | `RecipeMatcher.requiredIds` |
| `matchRecipes` | `RecipeMatcher.match` |
| `buildShoppingList` | `RecipeMatcher.buildShoppingList` |
| `placementLabel` / `stageLabel` | `LabelMaps` |
| `getCookingSteps` | `CookingStepsService.getCookingSteps` |
| `fillStepText` | `CookingStepsService.fillStepText` |
| `buildAddinInstructionSteps` | `CookingStepsService.buildAddinInstructionSteps` |

Файл: `lib/domain/engines/breadlab_calculation_engine.dart`,  
`lib/domain/services/recipe_matcher.dart`,  
`lib/domain/services/cooking_steps_service.dart`.

## Состояние и persistence

| HTML | Dart |
|------|------|
| `localStorage` / `StorageAdapter` | `AppStorage` + файл в documents dir |
| `persistPayload` / `persist` | `UserStateRepository.save` |
| `restore` | `UserStateRepository.load` |
| `exportJSON` | `UserStateRepository.exportPayload` |
| `importJSON` / `isBreadLabImportPayload` | `UserStateRepository.importPayload` |
| `buildCookSession` / `saveCookSession` | `CookSessionController` + repository |
| `pruneChecklist` | `UserStateRepository.pruneChecklist` |
| `breadlab_catalog_open` | `AppState.catalogOpen` (в основном JSON) |

## UI экраны

| HTML section | Flutter feature |
|--------------|-----------------|
| `#hero` | `features/home` |
| `#pantry` | `features/pantry` |
| `#catalog` | `features/catalog` |
| `#search-results` | `features/recipe_search` |
| `#recipe-workspace` | `features/recipe_calculator` |
| `#cook-overlay` | `features/cooking` |
| `#calibration` | `features/calibration` |
| `#sources` / `#settings` | `features/settings` |
| Header export/import | Settings + AppBar actions |
| `#resume-cook` | Home banner + Cooking resume |

## Тесты

| HTML | Dart |
|------|------|
| `runSelfTests` | `test/domain/calculation_engine_test.dart`, `recipe_matcher_test.dart`, `user_state_test.dart`, `catalog_test.dart` |

## Платформы

| Цель | Артефакт |
|------|----------|
| Android / MagicOS | `android/`, `flutter build apk` |
| HarmonyOS NEXT | `ohos/`, OpenHarmony SIG Flutter, `flutter build hap` (см. `HARMONYOS_BUILD.md`) |

## Что намеренно изменено относительно HTML

- Нативные Flutter Widgets вместо DOM/CSS (фирменные цвета сохранены).
- Нижняя навигация / NavigationRail вместо одностраничного скролла.
- `localStorage` → приватный JSON-файл приложения.
- Cook Mode — полноценный экран маршрута, не overlay поверх всей страницы.
- Экспорт JSON совместим с HTML; локальный autosave хранит полный `persistPayload`.

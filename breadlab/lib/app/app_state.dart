import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../data/models/recipe.dart';
import '../data/models/user_state.dart';
import '../data/repositories/catalog_repository.dart';
import '../data/repositories/user_state_repository.dart';
import '../domain/models/scaled_recipe.dart';

class AppState extends ChangeNotifier {
  AppState({
    CatalogRepository? catalogRepository,
    UserStateRepository? userStateRepository,
  }) : catalogRepository = catalogRepository ?? CatalogRepository() {
    this.userStateRepository = userStateRepository ??
        UserStateRepository(catalogRepository: this.catalogRepository);
  }

  final CatalogRepository catalogRepository;
  late final UserStateRepository userStateRepository;

  BreadLabCatalog? catalog;
  UserState user = UserState();
  bool loading = true;
  String? loadError;
  int tabIndex = 0;
  List<RecipeMatch> searchResults = [];
  bool searchRan = false;
  String pantryQuery = '';
  String pantryCategory = 'all';
  String catalogQuery = '';
  String catalogCategory = 'all';
  String resultsTab = 'panasonic';

  Future<void> init() async {
    loading = true;
    loadError = null;
    notifyListeners();
    try {
      catalog = await catalogRepository.load();
      user = await userStateRepository.load();
      if (user.defaultMachineId.isNotEmpty) {
        user.selectedMachineId = user.selectedMachineId;
      }
    } catch (e, st) {
      loadError = e.toString();
      debugPrint('AppState.init: $e\n$st');
    }
    loading = false;
    notifyListeners();
  }

  Future<void> persist() async {
    await userStateRepository.save(user);
  }

  void setTab(int i) {
    tabIndex = i;
    notifyListeners();
  }

  void setPantryQuery(String q) {
    pantryQuery = q;
    notifyListeners();
  }

  void setPantryCategory(String id) {
    pantryCategory = id;
    notifyListeners();
  }

  void togglePantry(String id, bool value) {
    if (value) {
      user.pantry[id] = true;
    } else {
      user.pantry.remove(id);
    }
    persist();
    notifyListeners();
  }

  void clearPantry() {
    user.pantry.clear();
    persist();
    notifyListeners();
  }

  int get pantrySelectedCount =>
      user.pantry.values.where((v) => v).length;

  void setNearMatch(bool v) {
    user.nearMatchOn = v;
    if (searchRan) runSearch();
    persist();
    notifyListeners();
  }

  void runSearch() {
    final c = catalog;
    if (c == null) return;
    searchResults = c.matcher.match(
      user.pantrySet,
      nearMatch: user.nearMatchOn,
    );
    searchRan = true;
    tabIndex = 3; // recipes / search tab
    persist();
    notifyListeners();
  }

  void setCatalogQuery(String q) {
    catalogQuery = q;
    notifyListeners();
  }

  void setCatalogCategory(String cat) {
    catalogCategory = cat;
    notifyListeners();
  }

  void setResultsTab(String tab) {
    resultsTab = tab;
    notifyListeners();
  }

  void setCatalogDifficulty(String d) {
    user.catalogDifficulty = d;
    persist();
    notifyListeners();
  }

  void setCatalogFavoritesOnly(bool v) {
    user.catalogFavoritesOnly = v;
    persist();
    notifyListeners();
  }

  void setCatalogCanBake(bool v) {
    user.catalogCanBake = v;
    persist();
    notifyListeners();
  }

  void openRecipe(String recipeId, {String? machineId, bool keepFlour = false}) {
    final c = catalog;
    if (c == null || !c.recipes.containsKey(recipeId)) return;
    user.selectedRecipeId = recipeId;
    if (machineId != null && c.machines.containsKey(machineId)) {
      user.selectedMachineId = machineId;
    }
    if (!keepFlour) {
      user.targetFlourG = c.recipes[recipeId]!.baseTotalFlourG.clamp(300, 600);
    }
    syncAddinsFor(recipeId);
    user.recent.remove(recipeId);
    user.recent.insert(0, recipeId);
    if (user.recent.length > 12) {
      user.recent = user.recent.take(12).toList();
    }
    persist();
    notifyListeners();
  }

  void syncAddinsFor(String recipeId) {
    final bag = user.addinsByRecipe[recipeId];
    if (bag != null) {
      user.enabledTasteAddins = Map<String, bool>.from(bag);
    } else {
      user.enabledTasteAddins = {};
    }
  }

  List<String> enabledAddinList() {
    final recipeId = user.selectedRecipeId;
    if (recipeId == null) return const [];
    final recipe = catalog?.recipes[recipeId];
    if (recipe == null) return const [];
    return recipe.tasteAddinIds
        .where((id) => user.enabledTasteAddins[id] == true)
        .toList();
  }

  void setAddin(String addinId, bool on) {
    final rid = user.selectedRecipeId;
    if (rid == null) return;
    user.enabledTasteAddins[addinId] = on;
    user.addinsByRecipe[rid] =
        Map<String, bool>.from(user.enabledTasteAddins);
    persist();
    notifyListeners();
  }

  void setTargetFlour(double g) {
    user.targetFlourG = g.clamp(250, 650);
    persist();
    notifyListeners();
  }

  void setMachine(String machineId) {
    if (catalog?.machines.containsKey(machineId) != true) return;
    user.selectedMachineId = machineId;
    persist();
    notifyListeners();
  }

  void setDefaultMachine(String machineId) {
    if (catalog?.machines.containsKey(machineId) != true) return;
    user.defaultMachineId = machineId;
    persist();
    notifyListeners();
  }

  void toggleFavorite(String recipeId) {
    if (user.favorites.contains(recipeId)) {
      user.favorites.remove(recipeId);
    } else {
      user.favorites.add(recipeId);
    }
    persist();
    notifyListeners();
  }

  bool isFavorite(String recipeId) => user.favorites.contains(recipeId);

  ScaledRecipe? currentScaled() {
    final c = catalog;
    final rid = user.selectedRecipeId;
    if (c == null || rid == null) return null;
    final recipe = c.recipes[rid];
    if (recipe == null) return null;
    return c.engine.scaleRecipe(recipe, user.targetFlourG, enabledAddinList());
  }

  CalibrationRecord? calibrationForCurrent() {
    final rid = user.selectedRecipeId;
    if (rid == null) return null;
    CalibrationRecord? last;
    for (final c in user.calibrations) {
      if (c.recipeId == rid && c.machineId == user.selectedMachineId) {
        last = c;
      }
    }
    return last;
  }

  void saveCalibration({
    required double actualWeightG,
    double? peakFillPercent,
  }) {
    final c = catalog;
    final rid = user.selectedRecipeId;
    if (c == null || rid == null) return;
    final recipe = c.recipes[rid]!;
    final scaled = currentScaled()!;
    final dough = c.engine.calculateDoughMass(scaled);
    final fin = c.engine.estimateFinishedWeight(
      dough,
      recipe.physics.bakeLossRange,
    );
    user.calibrations.add(CalibrationRecord(
      recipeId: rid,
      machineId: user.selectedMachineId,
      targetFlourG: user.targetFlourG,
      actualFinishedWeightG: actualWeightG,
      peakFillPercent: peakFillPercent,
      predictedMid: fin.mid,
      timestamp: DateTime.now().toUtc().toIso8601String(),
    ));
    persist();
    notifyListeners();
  }

  void setLargeSteps(bool v) {
    user.largeSteps = v;
    persist();
    notifyListeners();
  }

  void setThemeMode(String mode) {
    user.themeMode = mode;
    persist();
    notifyListeners();
  }

  void saveCookSession(CookSession? session) {
    user.cookSession = session;
    persist();
    notifyListeners();
  }

  void clearCookSession() {
    user.cookSession = null;
    persist();
    notifyListeners();
  }

  Map<String, bool> checklistFor(String ckKey) {
    return user.checklist.putIfAbsent(ckKey, () => {});
  }

  void setChecklistStep(String ckKey, String stepId, bool done) {
    final bag = checklistFor(ckKey);
    if (done) {
      bag[stepId] = true;
    } else {
      bag.remove(stepId);
    }
    persist();
    notifyListeners();
  }

  void resetChecklist(String ckKey) {
    user.checklist[ckKey] = {};
    persist();
    notifyListeners();
  }

  Future<String> exportJson() async {
    final v = catalog?.version ?? '1.0.0';
    return userStateRepository.exportJson(user, v);
  }

  String? importJson(String raw) {
    final c = catalog;
    if (c == null) return 'Каталог не загружен';
    final err = userStateRepository.importJson(user, raw, c);
    if (err == null) {
      persist();
      notifyListeners();
    }
    return err;
  }

  Recipe? get selectedRecipe {
    final id = user.selectedRecipeId;
    if (id == null) return null;
    return catalog?.recipes[id];
  }

  List<Recipe> filteredCatalog() {
    final c = catalog;
    if (c == null) return const [];
    Iterable<Recipe> list = c.recipes.values;

    final q = catalogQuery.trim().toLowerCase().replaceAll('ё', 'е');
    if (q.isNotEmpty) {
      list = list.where((r) {
        final hay = [
          r.title,
          r.specialty,
          r.category,
          ...r.tags,
        ].join(' ').toLowerCase().replaceAll('ё', 'е');
        return hay.contains(q);
      });
    }
    if (user.catalogDifficulty != 'all') {
      list = list.where((r) => r.difficulty == user.catalogDifficulty);
    }
    if (user.catalogFavoritesOnly) {
      list = list.where((r) => user.favorites.contains(r.id));
    }
    if (user.catalogCanBake) {
      final matches = c.matcher.match(user.pantrySet, nearMatch: true);
      final ids = matches.map((m) => m.recipeId).toSet();
      list = list.where((r) => ids.contains(r.id));
    }
    if (catalogCategory != 'all') {
      list = list.where((r) => r.category == catalogCategory);
    }
    return list.toList()..sort((a, b) => a.id.compareTo(b.id));
  }
}

import '../../domain/models/scaled_recipe.dart';

class UserState {
  UserState({
    Map<String, bool>? pantry,
    this.staplesOn = true,
    this.nearMatchOn = true,
    List<String>? favorites,
    List<String>? recent,
    List<CalibrationRecord>? calibrations,
    Map<String, bool>? enabledTasteAddins,
    Map<String, Map<String, bool>>? addinsByRecipe,
    this.cookSession,
    this.defaultMachineId = 'panasonic_sd_yr2540hts',
    this.largeSteps = false,
    this.catalogDifficulty = 'all',
    this.catalogFavoritesOnly = false,
    this.catalogCanBake = false,
    this.selectedRecipeId,
    this.selectedMachineId = 'panasonic_sd_yr2540hts',
    this.targetFlourG = 400,
    Map<String, Map<String, bool>>? checklist,
    this.catalogOpen = false,
    this.themeMode = 'light',
  })  : pantry = pantry ?? {},
        favorites = favorites ?? [],
        recent = recent ?? [],
        calibrations = calibrations ?? [],
        enabledTasteAddins = enabledTasteAddins ?? {},
        addinsByRecipe = addinsByRecipe ?? {},
        checklist = checklist ?? {};

  Map<String, bool> pantry;
  bool staplesOn;
  bool nearMatchOn;
  List<String> favorites;
  List<String> recent;
  List<CalibrationRecord> calibrations;
  Map<String, bool> enabledTasteAddins;
  Map<String, Map<String, bool>> addinsByRecipe;
  CookSession? cookSession;
  String defaultMachineId;
  bool largeSteps;
  String catalogDifficulty;
  bool catalogFavoritesOnly;
  bool catalogCanBake;
  String? selectedRecipeId;
  String selectedMachineId;
  double targetFlourG;
  Map<String, Map<String, bool>> checklist;
  bool catalogOpen;
  String themeMode;

  Set<String> get pantrySet =>
      pantry.entries.where((e) => e.value).map((e) => e.key).toSet();

  Map<String, dynamic> toPersistPayload() {
    return {
      'pantry': pantry,
      'staplesOn': staplesOn,
      'nearMatchOn': nearMatchOn,
      'favorites': favorites,
      'recent': recent,
      'calibrations': calibrations.map((e) => e.toJson()).toList(),
      'enabledTasteAddins': enabledTasteAddins,
      'addinsByRecipe': addinsByRecipe,
      'cookSession': cookSession?.toJson(),
      'defaultMachineId': defaultMachineId,
      'largeSteps': largeSteps,
      'catalogDifficulty': catalogDifficulty,
      'catalogFavoritesOnly': catalogFavoritesOnly,
      'catalogCanBake': catalogCanBake,
      'selectedRecipeId': selectedRecipeId,
      'selectedMachineId': selectedMachineId,
      'targetFlourG': targetFlourG,
      'checklist': checklist,
      'catalogOpen': catalogOpen,
      'themeMode': themeMode,
    };
  }

  Map<String, dynamic> toExportPayload(String version) {
    return {
      'app': 'BreadLab',
      'version': version,
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'pantry': pantry,
      'staplesOn': staplesOn,
      'nearMatchOn': nearMatchOn,
      'favorites': favorites,
      'recent': recent,
      'calibrations': calibrations.map((e) => e.toJson()).toList(),
      'enabledTasteAddins': enabledTasteAddins,
      'addinsByRecipe': addinsByRecipe,
      'cookSession': cookSession?.toJson(),
      'defaultMachineId': defaultMachineId,
      'largeSteps': largeSteps,
      'settings': {
        'defaultMachineId': defaultMachineId,
        'largeSteps': largeSteps,
      },
    };
  }

  static bool isBreadLabImportPayload(dynamic data) {
    if (data is! Map) return false;
    if (data['app'] == 'BreadLab') return true;
    const keys = [
      'pantry',
      'favorites',
      'calibrations',
      'recent',
      'enabledTasteAddins',
      'checklist',
    ];
    return keys.any(data.containsKey);
  }

  void applyImport(
    Map<String, dynamic> data, {
    required Set<String> knownRecipeIds,
    required Set<String> knownMachineIds,
    required Set<String> knownIngredientIds,
  }) {
    if (data['pantry'] is Map) {
      final next = <String, bool>{};
      (data['pantry'] as Map).forEach((k, v) {
        if (knownIngredientIds.contains(k.toString()) && v == true) {
          next[k.toString()] = true;
        }
      });
      pantry = next;
    }
    if (data['staplesOn'] is bool) staplesOn = data['staplesOn'] as bool;
    if (data['nearMatchOn'] is bool) nearMatchOn = data['nearMatchOn'] as bool;
    if (data['favorites'] is List) {
      favorites = (data['favorites'] as List)
          .map((e) => e.toString())
          .where(knownRecipeIds.contains)
          .toList();
    }
    if (data['recent'] is List) {
      recent = (data['recent'] as List)
          .map((e) => e.toString())
          .where(knownRecipeIds.contains)
          .toList();
    }
    if (data['calibrations'] is List) {
      calibrations = (data['calibrations'] as List)
          .whereType<Map>()
          .map((e) => CalibrationRecord.fromJson(Map<String, dynamic>.from(e)))
          .where((c) =>
              knownRecipeIds.contains(c.recipeId) &&
              knownMachineIds.contains(c.machineId))
          .toList();
    }
    if (data['addinsByRecipe'] is Map) {
      final next = <String, Map<String, bool>>{};
      (data['addinsByRecipe'] as Map).forEach((rid, bag) {
        if (!knownRecipeIds.contains(rid.toString()) || bag is! Map) return;
        next[rid.toString()] = bag.map(
          (k, v) => MapEntry(k.toString(), v == true),
        );
      });
      addinsByRecipe = next;
    } else if (data['enabledTasteAddins'] is Map &&
        data['selectedRecipeId'] != null) {
      final rid = data['selectedRecipeId'].toString();
      if (knownRecipeIds.contains(rid)) {
        addinsByRecipe[rid] = (data['enabledTasteAddins'] as Map).map(
          (k, v) => MapEntry(k.toString(), v == true),
        );
      }
    }
    if (data['enabledTasteAddins'] is Map) {
      enabledTasteAddins = (data['enabledTasteAddins'] as Map).map(
        (k, v) => MapEntry(k.toString(), v == true),
      );
    }
    if (data['cookSession'] is Map) {
      final cs = CookSession.fromJson(
        Map<String, dynamic>.from(data['cookSession'] as Map),
      );
      if (knownRecipeIds.contains(cs.recipeId)) {
        cookSession = cs;
      }
    }
    if (data['defaultMachineId'] is String &&
        knownMachineIds.contains(data['defaultMachineId'])) {
      defaultMachineId = data['defaultMachineId'] as String;
    }
    if (data['settings'] is Map) {
      final s = data['settings'] as Map;
      if (s['defaultMachineId'] is String &&
          knownMachineIds.contains(s['defaultMachineId'])) {
        defaultMachineId = s['defaultMachineId'] as String;
      }
      if (s['largeSteps'] is bool) largeSteps = s['largeSteps'] as bool;
    }
    if (data['largeSteps'] is bool) largeSteps = data['largeSteps'] as bool;
    if (data['catalogDifficulty'] is String) {
      catalogDifficulty = data['catalogDifficulty'] as String;
    }
    if (data['catalogFavoritesOnly'] is bool) {
      catalogFavoritesOnly = data['catalogFavoritesOnly'] as bool;
    }
    if (data['catalogCanBake'] is bool) {
      catalogCanBake = data['catalogCanBake'] as bool;
    }
    if (data['selectedRecipeId'] is String &&
        knownRecipeIds.contains(data['selectedRecipeId'])) {
      selectedRecipeId = data['selectedRecipeId'] as String;
    }
    if (data['selectedMachineId'] is String &&
        knownMachineIds.contains(data['selectedMachineId'])) {
      selectedMachineId = data['selectedMachineId'] as String;
    }
    if (data['targetFlourG'] is num) {
      targetFlourG = (data['targetFlourG'] as num).toDouble();
    }
    if (data['checklist'] is Map) {
      checklist = (data['checklist'] as Map).map((k, v) {
        final bag = v is Map
            ? v.map((sk, sv) => MapEntry(sk.toString(), sv == true))
            : <String, bool>{};
        return MapEntry(k.toString(), bag);
      });
    }
    if (data['themeMode'] is String) themeMode = data['themeMode'] as String;
  }

  void applyPersisted(
    Map<String, dynamic> data, {
    required Set<String> knownRecipeIds,
    required Set<String> knownMachineIds,
    required Set<String> knownIngredientIds,
  }) {
    applyImport(
      data,
      knownRecipeIds: knownRecipeIds,
      knownMachineIds: knownMachineIds,
      knownIngredientIds: knownIngredientIds,
    );
    if (data['catalogOpen'] is bool) catalogOpen = data['catalogOpen'] as bool;
  }

  void pruneChecklist() {
    if (checklist.length <= 8) return;
    final keep = <String>{};
    for (final rid in recent.take(8)) {
      for (final k in checklist.keys) {
        if (k.startsWith('$rid::')) keep.add(k);
      }
    }
    if (cookSession != null) keep.add(cookSession!.ckKey);
    if (selectedRecipeId != null) {
      for (final k in checklist.keys) {
        if (k.startsWith('$selectedRecipeId::')) keep.add(k);
      }
    }
    final keys = checklist.keys.toList();
    final survivors = keys.where(keep.contains).toList();
    if (survivors.length < 8) {
      for (final k in keys.reversed) {
        if (survivors.length >= 8) break;
        if (!survivors.contains(k)) survivors.add(k);
      }
    }
    final next = <String, Map<String, bool>>{};
    for (final k in survivors.take(8)) {
      next[k] = checklist[k]!;
    }
    checklist = next;
  }
}

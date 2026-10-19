import '../../core/utils/name_normalizer.dart';
import '../../data/models/ingredient.dart';
import '../../data/models/recipe.dart';
import '../models/scaled_recipe.dart';

class RecipeMatcher {
  RecipeMatcher({
    required this.recipes,
    required this.ingredients,
    required this.alwaysAvailable,
  });

  final Map<String, Recipe> recipes;
  final Map<String, Ingredient> ingredients;
  final List<String> alwaysAvailable;

  bool isAlwaysAvailable(String id) {
    final ing = ingredients[id];
    if (ing != null && ing.hideFromPantry) return true;
    return alwaysAvailable.contains(id);
  }

  List<String> requiredIds(Recipe recipe) {
    final req = <String>[];
    for (final row in recipe.ingredients) {
      if (row.optional) continue;
      if (isAlwaysAvailable(row.ingredientId)) continue;
      if (!req.contains(row.ingredientId)) req.add(row.ingredientId);
    }
    return req;
  }

  List<RecipeMatch> match(Set<String> pantrySet, {bool nearMatch = true}) {
    final results = <RecipeMatch>[];
    for (final entry in recipes.entries) {
      final recipe = entry.value;
      final req = requiredIds(recipe);
      final missing = req.where((id) => !pantrySet.contains(id)).toList();
      String status = 'unavailable';
      if (missing.isEmpty) {
        status = 'exact';
      } else if (nearMatch && missing.length <= 2) {
        status = 'near';
      }
      if (status == 'unavailable') continue;
      final score =
          status == 'exact' ? 1000 - req.length : 500 - missing.length * 10;

      void push(String mkey, String machineId, String programLabel, int timeMin,
          bool compatible) {
        if (!compatible) return;
        results.add(RecipeMatch(
          recipeId: entry.key,
          machineKey: mkey,
          machineId: machineId,
          status: status,
          missing: List<String>.from(missing),
          score: score,
          programLabel: programLabel,
          timeMin: timeMin,
        ));
      }

      final mp = recipe.panasonic;
      push(
        'panasonic',
        'panasonic_sd_yr2540hts',
        '№${mp.programNo} «${mp.programName}»',
        mp.totalTimeMin,
        mp.compatible,
      );

      final rp = recipe.redmond;
      final programLabel = rp.workflow == 'bake-only'
          ? 'BAKE'
          : rp.workflow == 'bread-auto'
              ? 'BREAD'
              : 'MULTI COOK + BAKE';
      final timeMin = (rp.proof?.timeMin ?? 0) +
          rp.bake.timeMin +
          (rp.bake.secondBakeMin ?? 0);
      push('redmond', 'redmond_rmc_m92s', programLabel, timeMin, rp.compatible);
    }

    results.sort((a, b) {
      if (b.score != a.score) return b.score.compareTo(a.score);
      final ta = recipes[a.recipeId]?.title ?? '';
      final tb = recipes[b.recipeId]?.title ?? '';
      return ta.compareTo(tb);
    });
    return results;
  }

  List<String> buildShoppingList(List<RecipeMatch> matches) {
    final set = <String, String>{};
    for (final m in matches) {
      for (final id in m.missing) {
        set[id] = ingredients[id]?.name ?? id;
      }
    }
    final names = set.values.toList()..sort((a, b) => a.compareTo(b));
    return names;
  }

  String? resolveIngredientId(String token) =>
      NameNormalizer.resolveIngredientId(token, ingredients);
}

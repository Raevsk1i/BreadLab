import '../../data/models/recipe.dart';
import '../../data/models/taste_addin.dart';
import '../engines/breadlab_calculation_engine.dart';
import '../models/scaled_recipe.dart';

class CookingStepsService {
  CookingStepsService({
    required this.tasteAddins,
    required this.engine,
  });

  final Map<String, TasteAddin> tasteAddins;
  final BreadLabCalculationEngine engine;

  List<CookStep> buildAddinInstructionSteps(
    String machineKey,
    ScaledRecipe scaled,
  ) {
    final steps = <CookStep>[];
    for (final row in scaled.addins) {
      final a = tasteAddins[row.addinId];
      if (a == null) continue;
      final grams =
          '${engine.formatGrams(row.ingredientId, row.grams)} г';
      final place = a.placement[machineKey] ?? 'manual';
      final prep = a.prep.isNotEmpty ? a.prep : a.effect;
      late final String whenWhere;
      if (machineKey == 'panasonic') {
        if (place == 'raisinNutDispenser') {
          whenWhere =
              'Перед запуском программы засыпьте в диспенсер добавок (не в дрожжевой). Автомат внесёт их ближе к концу замеса.';
        } else if (place == 'pan') {
          whenWhere = a.dry == false
              ? 'Положите прямо в чашу с основными ингредиентами (влажные/плавящиеся добавки — не в диспенсер).'
              : 'Добавьте в чашу вместе с сухими ингредиентами до старта программы.';
        } else {
          whenWhere =
              'Внесите вручную по сигналу программы или в конце замеса.';
        }
      } else {
        if (place == 'pan' || a.dry == false) {
          whenWhere = a.dry == false
              ? 'Вмешайте в тесто в самом конце замеса, равномерно распределяя, затем уложите в чашу.'
              : 'Добавьте к сухим ингредиентам при замесе или вмешайте в конце замеса перед расстойкой.';
        } else {
          whenWhere =
              'Вмешайте вручную в конце замеса (последние 1–2 минуты), затем сформируйте шар и уложите в чашу.';
        }
      }
      var text =
          'Добавка по вкусу — ${a.name} ($grams). ${prep.isNotEmpty ? 'Подготовка: $prep ' : ''}$whenWhere';
      if (a.warnings.isNotEmpty) {
        text += ' Важно: ${a.warnings.join(' ')}';
      }
      steps.add(CookStep(id: 'addin-${row.addinId}', text: text, isAddin: true));
    }
    return steps;
  }

  List<CookStep> getCookingSteps(
    Recipe recipe,
    String machineKey,
    ScaledRecipe scaled,
  ) {
    final base = machineKey == 'panasonic'
        ? recipe.panasonic.steps
        : recipe.redmond.steps;
    final addins = buildAddinInstructionSteps(machineKey, scaled);
    if (addins.isEmpty) return List<CookStep>.from(base);

    // Match HTML: panasonic → min(3, len); redmond → min(3, max(2, len-3))
    final int insertAt;
    if (machineKey == 'panasonic') {
      insertAt = base.length < 3 ? base.length : 3;
    } else {
      final lo = base.length - 3;
      final mid = lo < 2 ? 2 : lo;
      insertAt = mid > 3 ? 3 : mid;
    }
    return [
      ...base.take(insertAt),
      ...addins,
      ...base.skip(insertAt),
    ];
  }

  String fillStepText(String text, ScaledRecipe scaled) {
    final map = <String, String>{};
    for (final row in scaled.all) {
      map[row.ingredientId] =
          '${engine.formatGrams(row.ingredientId, row.grams)} г';
    }
    map['flour_total'] = '${scaled.targetFlourG.round()} г';
    return text.replaceAllMapped(RegExp(r'\{([a-z0-9_]+)\}'), (m) {
      final key = m.group(1)!;
      return map[key] ?? '{$key}';
    });
  }

  String machineKeyFromId(String machineId) =>
      machineId == 'panasonic_sd_yr2540hts' ? 'panasonic' : 'redmond';

  String checklistKey(
    String recipeId,
    String machineId,
    List<String> enabledAddins,
  ) {
    final sorted = List<String>.from(enabledAddins)..sort();
    return '$recipeId::$machineId::addins:${sorted.join(',')}';
  }
}

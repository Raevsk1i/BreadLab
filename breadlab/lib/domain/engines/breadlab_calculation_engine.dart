import '../../data/models/ingredient.dart';
import '../../data/models/machine.dart';
import '../../data/models/recipe.dart';
import '../../data/models/taste_addin.dart';
import '../models/scaled_recipe.dart';

/// Pure calculation engine ported from bread_lab.html (no Flutter deps).
class BreadLabCalculationEngine {
  BreadLabCalculationEngine({
    required this.ingredients,
    required this.tasteAddins,
    required this.machines,
  });

  final Map<String, Ingredient> ingredients;
  final Map<String, TasteAddin> tasteAddins;
  final Map<String, Machine> machines;

  static const _fineRoundIds = {
    'salt',
    'yeast',
    'coriander',
    'caraway',
    'garlic_dry',
    'vanilla',
    'soda',
    'rosemary',
  };

  double getTotalFlourG(Recipe recipe) {
    return recipe.flourComponents.fold<double>(0, (s, f) => s + f.grams);
  }

  double roundPresent(String ingredientId, double value) {
    final addin = tasteAddins[ingredientId];
    final fine = _fineRoundIds.contains(ingredientId) ||
        (addin != null && addin.suggestedBakerPctRange.length > 1 &&
            addin.suggestedBakerPctRange[1] < 2);
    if (fine) {
      return (value * 10).round() / 10;
    }
    return value.roundToDouble();
  }

  String formatGrams(String ingredientId, double value) {
    final r = roundPresent(ingredientId, value);
    if ((r - r.roundToDouble()).abs() < 1e-9) {
      return r.round().toString();
    }
    return r.toStringAsFixed(1);
  }

  ScaledRecipe scaleRecipe(
    Recipe recipe,
    double targetFlourG,
    List<String> enabledAddins,
  ) {
    final base = getTotalFlourG(recipe);
    final baseFlour = base > 0 ? base : recipe.baseTotalFlourG;
    final factor = targetFlourG / baseFlour;

    final items = recipe.ingredients.map((row) {
      final grams =
          row.scalable == false ? row.grams : row.grams * factor;
      return ScaledItem(
        ingredientId: row.ingredientId,
        grams: grams,
        bakerPct: (grams / targetFlourG) * 100,
        row: row,
        scalable: row.scalable,
        hydrationContributor: row.hydrationContributor,
        placement: row.placement,
      );
    }).toList();

    final addins = <ScaledItem>[];
    for (final aid in enabledAddins) {
      final a = tasteAddins[aid];
      if (a == null) continue;
      final pct = a.defaultPct;
      final grams = targetFlourG * (pct / 100);
      addins.add(
        ScaledItem(
          ingredientId: a.ingredientId,
          grams: grams,
          bakerPct: pct,
          row: null,
          name: a.name,
          addinId: aid,
          isAddin: true,
          pctRange: List<double>.from(a.suggestedBakerPctRange),
          gramsRange: [
            targetFlourG * a.suggestedBakerPctRange[0] / 100,
            targetFlourG * a.suggestedBakerPctRange[1] / 100,
          ],
          role: a.role,
          effect: a.effect,
          warnings: a.warnings,
          placement: IngredientPlacement(
            panasonic: a.placement['panasonic'] ?? 'pan',
            redmond: a.placement['redmond'] ?? 'manual',
          ),
          dry: a.dry,
          scalable: true,
          hydrationContributor: false,
        ),
      );
    }

    return ScaledRecipe(
      targetFlourG: targetFlourG,
      factor: factor,
      items: items,
      addins: addins,
    );
  }

  double calculateHydration(ScaledRecipe scaled) {
    var water = 0.0;
    for (final row in scaled.items) {
      final meta = ingredients[row.ingredientId];
      final frac = meta?.hydrationFraction ?? 0;
      if (row.hydrationContributor || frac > 0) {
        if (meta?.category == 'fat' && frac == 0) continue;
        water += row.grams * frac;
      }
    }
    if (scaled.targetFlourG == 0) return 0;
    return (water / scaled.targetFlourG) * 100;
  }

  double calculateDoughMass(ScaledRecipe scaled) {
    return scaled.all.fold<double>(0, (s, r) => s + r.grams);
  }

  WeightRange estimateFinishedWeight(
    double doughMass,
    List<double> bakeLossRange, [
    CalibrationRecord? calibration,
  ]) {
    final minL = bakeLossRange[0];
    final maxL = bakeLossRange[1];
    var finishedMin = doughMass * (1 - maxL);
    var finishedMax = doughMass * (1 - minL);
    if (calibration != null &&
        calibration.actualFinishedWeightG > 0 &&
        calibration.predictedMid > 0) {
      final bias =
          calibration.actualFinishedWeightG / calibration.predictedMid;
      finishedMin *= bias;
      finishedMax *= bias;
    }
    return WeightRange(min: finishedMin, max: finishedMax);
  }

  ProofVolume estimateProofVolume(double doughMass, RecipePhysics physics) {
    final dens = physics.doughDensityGPerMl > 0
        ? physics.doughDensityGPerMl
        : 1.05;
    final initial = doughMass / dens;
    final pMin = initial * physics.proofExpansionRange[0];
    final pMax = initial * physics.proofExpansionRange[1];
    final bowl = pMax * (physics.headroomFactor > 0 ? physics.headroomFactor : 1.25);
    return ProofVolume(
      initialMl: initial,
      proofedMinMl: pMin,
      proofedMaxMl: pMax,
      recommendedBowlMl: bowl,
    );
  }

  double calculateDispenserLoad(ScaledRecipe scaled) {
    var total = 0.0;
    for (final row in scaled.all) {
      if (row.effectivePlacement.panasonic == 'raisinNutDispenser') {
        total += row.grams;
      }
    }
    return total;
  }

  List<MachineWarning> validateMachineLimits(
    String machineId,
    Recipe recipe,
    ScaledRecipe scaled,
  ) {
    final warnings = <MachineWarning>[];
    final machine = machines[machineId];
    if (machine == null) return warnings;

    final flour = scaled.targetFlourG;
    ScaledItem? yeastRow;
    for (final r in scaled.items) {
      if (r.ingredientId == 'yeast') {
        yeastRow = r;
        break;
      }
    }
    final yeastG = yeastRow?.grams ?? 0;

    if (machineId == 'panasonic_sd_yr2540hts') {
      final c = machine.constraints!;
      final bf = c.breadFlour;
      final mode =
          recipe.panasonic.programNo == '13' ? 'bake' : 'bread';
      if (mode == 'bread') {
        if (flour < bf[0]) {
          warnings.add(MachineWarning(
            level: WarningLevel.warn,
            code: 'flour_low',
            message:
                'Мука ${flour.round()} г ниже рекомендованного для хлеба (${bf[0].round()}–${bf[1].round()} г).',
          ));
        }
        if (flour > bf[1]) {
          warnings.add(MachineWarning(
            level: WarningLevel.danger,
            code: 'flour_high',
            message:
                'Мука ${flour.round()} г выше лимита хлеба Panasonic (${bf[1].round()} г).',
          ));
        }
      } else {
        final df = c.doughFlour;
        if (flour < df[0]) {
          warnings.add(const MachineWarning(
            level: WarningLevel.warn,
            code: 'flour_low_dough',
            message: 'Мука ниже диапазона для теста (250–600 г).',
          ));
        }
        if (flour > df[1]) {
          warnings.add(const MachineWarning(
            level: WarningLevel.danger,
            code: 'flour_high_dough',
            message: 'Мука выше лимита для теста (600 г).',
          ));
        }
      }
      final y = c.yeastG;
      if (yeastG > 0 && yeastG < y[0]) {
        warnings.add(MachineWarning(
          level: WarningLevel.warn,
          code: 'yeast_low',
          message:
              'Дрожжи ${formatGrams('yeast', yeastG)} г ниже обычного диапазона (${y[0]}–${y[1]} г).',
        ));
      }
      if (yeastG > y[1]) {
        warnings.add(MachineWarning(
          level: WarningLevel.danger,
          code: 'yeast_high',
          message:
              'Дрожжи ${formatGrams('yeast', yeastG)} г выше лимита (${y[1]} г).',
        ));
      }
      final disp = calculateDispenserLoad(scaled);
      if (disp > c.dispenserAddinsMaxG) {
        warnings.add(MachineWarning(
          level: WarningLevel.danger,
          code: 'dispenser',
          message:
              'Добавки в диспенсер ≈${disp.round()} г > лимита ${c.dispenserAddinsMaxG.round()} г. Уменьшите добавки или кладите часть вручную.',
        ));
      } else if (disp > c.dispenserAddinsMaxG * 0.9) {
        warnings.add(MachineWarning(
          level: WarningLevel.warn,
          code: 'dispenser_near',
          message:
              'Добавки в диспенсер ≈${disp.round()} г — близко к лимиту 150 г.',
        ));
      }
    }

    if (machineId == 'redmond_rmc_m92s') {
      final vol = estimateProofVolume(
        calculateDoughMass(scaled),
        recipe.physics,
      );
      final fill = vol.proofedMaxMl / (machine.bowlVolumeMl ?? 5000);
      if (fill > 0.9) {
        warnings.add(const MachineWarning(
          level: WarningLevel.danger,
          code: 'bowl_red',
          message:
              'Риск побега теста: расчётный пик >90% объёма чаши (~5 л). Уменьшите муку.',
        ));
      } else if (fill > 0.7) {
        warnings.add(const MachineWarning(
          level: WarningLevel.warn,
          code: 'bowl_yellow',
          message:
              'Заполнение чаши впритык (70–90% расчётного пика). Следите за подъёмом.',
        ));
      } else {
        warnings.add(const MachineWarning(
          level: WarningLevel.ok,
          code: 'bowl_green',
          message: 'Комфортный запас объёма чаши REDMOND.',
        ));
      }
    }

    return warnings;
  }

  bool isFiniteMass(double v) => v.isFinite && !v.isNaN && v >= 0;
}

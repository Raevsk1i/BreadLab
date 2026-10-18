import '../../data/models/recipe.dart';

class ScaledItem {
  ScaledItem({
    required this.ingredientId,
    required this.grams,
    required this.bakerPct,
    required this.row,
    this.name,
    this.addinId,
    this.isAddin = false,
    this.pctRange,
    this.gramsRange,
    this.role,
    this.effect,
    this.warnings = const [],
    this.placement,
    this.dry,
    this.scalable = true,
    this.hydrationContributor = false,
  });

  final String ingredientId;
  final double grams;
  final double bakerPct;
  final RecipeIngredientRow? row;
  final String? name;
  final String? addinId;
  final bool isAddin;
  final List<double>? pctRange;
  final List<double>? gramsRange;
  final String? role;
  final String? effect;
  final List<String> warnings;
  final IngredientPlacement? placement;
  final bool? dry;
  final bool scalable;
  final bool hydrationContributor;

  IngredientPlacement get effectivePlacement =>
      placement ?? row?.placement ?? const IngredientPlacement(panasonic: 'pan', redmond: 'bowl');
}

class ScaledRecipe {
  const ScaledRecipe({
    required this.targetFlourG,
    required this.factor,
    required this.items,
    required this.addins,
  });

  final double targetFlourG;
  final double factor;
  final List<ScaledItem> items;
  final List<ScaledItem> addins;

  List<ScaledItem> get all => [...items, ...addins];
}

class WeightRange {
  const WeightRange({required this.min, required this.max});
  final double min;
  final double max;
  double get mid => (min + max) / 2;
}

class ProofVolume {
  const ProofVolume({
    required this.initialMl,
    required this.proofedMinMl,
    required this.proofedMaxMl,
    required this.recommendedBowlMl,
  });

  final double initialMl;
  final double proofedMinMl;
  final double proofedMaxMl;
  final double recommendedBowlMl;
}

enum WarningLevel { ok, warn, danger }

class MachineWarning {
  const MachineWarning({
    required this.level,
    required this.code,
    required this.message,
  });

  final WarningLevel level;
  final String code;
  final String message;
}

class RecipeMatch {
  const RecipeMatch({
    required this.recipeId,
    required this.machineKey,
    required this.machineId,
    required this.status,
    required this.missing,
    required this.score,
    required this.programLabel,
    required this.timeMin,
  });

  final String recipeId;
  final String machineKey;
  final String machineId;
  final String status; // exact | near
  final List<String> missing;
  final int score;
  final String programLabel;
  final int timeMin;
}

class CalibrationRecord {
  const CalibrationRecord({
    required this.recipeId,
    required this.machineId,
    required this.targetFlourG,
    required this.actualFinishedWeightG,
    this.peakFillPercent,
    required this.predictedMid,
    required this.timestamp,
  });

  final String recipeId;
  final String machineId;
  final double targetFlourG;
  final double actualFinishedWeightG;
  final double? peakFillPercent;
  final double predictedMid;
  final String timestamp;

  factory CalibrationRecord.fromJson(Map<String, dynamic> json) {
    return CalibrationRecord(
      recipeId: json['recipeId'] as String? ?? '',
      machineId: json['machineId'] as String? ?? '',
      targetFlourG: (json['targetFlourG'] as num?)?.toDouble() ?? 0,
      actualFinishedWeightG:
          (json['actualFinishedWeightG'] as num?)?.toDouble() ?? 0,
      peakFillPercent: (json['peakFillPercent'] as num?)?.toDouble(),
      predictedMid: (json['predictedMid'] as num?)?.toDouble() ?? 0,
      timestamp: json['timestamp'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'recipeId': recipeId,
        'machineId': machineId,
        'targetFlourG': targetFlourG,
        'actualFinishedWeightG': actualFinishedWeightG,
        if (peakFillPercent != null) 'peakFillPercent': peakFillPercent,
        'predictedMid': predictedMid,
        'timestamp': timestamp,
      };
}

class CookSession {
  const CookSession({
    required this.recipeId,
    required this.machineId,
    required this.stepIndex,
    this.timerId,
    required this.ckKey,
    required this.remainingMs,
    this.running = false,
  });

  final String recipeId;
  final String machineId;
  final int stepIndex;
  final String? timerId;
  final String ckKey;
  final int remainingMs;
  final bool running;

  factory CookSession.fromJson(Map<String, dynamic> json) {
    return CookSession(
      recipeId: json['recipeId'] as String? ?? '',
      machineId: json['machineId'] as String? ?? '',
      stepIndex: (json['stepIndex'] as num?)?.toInt() ?? 0,
      timerId: json['timerId'] as String?,
      ckKey: json['ckKey'] as String? ?? '',
      remainingMs: (json['remainingMs'] as num?)?.toInt() ?? 0,
      running: json['running'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'recipeId': recipeId,
        'machineId': machineId,
        'stepIndex': stepIndex,
        'timerId': timerId,
        'ckKey': ckKey,
        'remainingMs': remainingMs,
        'running': false, // HTML always persists paused
      };

  CookSession copyWith({
    int? stepIndex,
    String? timerId,
    int? remainingMs,
    bool? running,
  }) {
    return CookSession(
      recipeId: recipeId,
      machineId: machineId,
      stepIndex: stepIndex ?? this.stepIndex,
      timerId: timerId ?? this.timerId,
      ckKey: ckKey,
      remainingMs: remainingMs ?? this.remainingMs,
      running: running ?? this.running,
    );
  }
}

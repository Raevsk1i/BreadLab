class FlourComponent {
  const FlourComponent({required this.ingredientId, required this.grams});

  final String ingredientId;
  final double grams;

  factory FlourComponent.fromJson(Map<String, dynamic> json) {
    return FlourComponent(
      ingredientId: json['ingredientId'] as String,
      grams: (json['grams'] as num).toDouble(),
    );
  }
}

class IngredientPlacement {
  const IngredientPlacement({
    required this.panasonic,
    required this.redmond,
  });

  final String panasonic;
  final String redmond;

  factory IngredientPlacement.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const IngredientPlacement(panasonic: 'pan', redmond: 'bowl');
    }
    return IngredientPlacement(
      panasonic: json['panasonic'] as String? ?? 'pan',
      redmond: json['redmond'] as String? ?? 'bowl',
    );
  }

  Map<String, dynamic> toJson() => {
        'panasonic': panasonic,
        'redmond': redmond,
      };
}

class RecipeIngredientRow {
  const RecipeIngredientRow({
    required this.ingredientId,
    required this.grams,
    this.isFlour = false,
    this.stage = 'mainMix',
    this.role = '',
    this.detailedRole = '',
    this.placement = const IngredientPlacement(panasonic: 'pan', redmond: 'bowl'),
    this.scalable = true,
    this.hydrationContributor = false,
    this.increaseEffect = '',
    this.decreaseEffect = '',
    this.substitutions = const [],
    this.unit = 'g',
    this.optional = false,
  });

  final String ingredientId;
  final double grams;
  final bool isFlour;
  final String stage;
  final String role;
  final String detailedRole;
  final IngredientPlacement placement;
  final bool scalable;
  final bool hydrationContributor;
  final String increaseEffect;
  final String decreaseEffect;
  final List<String> substitutions;
  final String unit;
  final bool optional;

  factory RecipeIngredientRow.fromJson(Map<String, dynamic> json) {
    return RecipeIngredientRow(
      ingredientId: json['ingredientId'] as String,
      grams: (json['grams'] as num).toDouble(),
      isFlour: json['isFlour'] == true,
      stage: json['stage'] as String? ?? 'mainMix',
      role: json['role'] as String? ?? '',
      detailedRole: json['detailedRole'] as String? ?? '',
      placement: IngredientPlacement.fromJson(
        json['placement'] is Map
            ? Map<String, dynamic>.from(json['placement'] as Map)
            : null,
      ),
      scalable: json['scalable'] != false,
      hydrationContributor: json['hydrationContributor'] == true,
      increaseEffect: json['increaseEffect'] as String? ?? '',
      decreaseEffect: json['decreaseEffect'] as String? ?? '',
      substitutions:
          (json['substitutions'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
      unit: json['unit'] as String? ?? 'g',
      optional: json['optional'] == true,
    );
  }

  RecipeIngredientRow copyWith({
    double? grams,
    double? bakerPct,
    bool? scaled,
  }) {
    return RecipeIngredientRow(
      ingredientId: ingredientId,
      grams: grams ?? this.grams,
      isFlour: isFlour,
      stage: stage,
      role: role,
      detailedRole: detailedRole,
      placement: placement,
      scalable: scalable,
      hydrationContributor: hydrationContributor,
      increaseEffect: increaseEffect,
      decreaseEffect: decreaseEffect,
      substitutions: substitutions,
      unit: unit,
      optional: optional,
    );
  }
}

class RecipePhysics {
  const RecipePhysics({
    required this.bakeLossRange,
    required this.doughDensityGPerMl,
    required this.proofExpansionRange,
    required this.headroomFactor,
    this.confidence = 'medium',
  });

  final List<double> bakeLossRange;
  final double doughDensityGPerMl;
  final List<double> proofExpansionRange;
  final double headroomFactor;
  final String confidence;

  factory RecipePhysics.fromJson(Map<String, dynamic> json) {
    return RecipePhysics(
      bakeLossRange: (json['bakeLossRange'] as List)
          .map((e) => (e as num).toDouble())
          .toList(),
      doughDensityGPerMl:
          (json['doughDensityGPerMl'] as num?)?.toDouble() ?? 1.05,
      proofExpansionRange: (json['proofExpansionRange'] as List)
          .map((e) => (e as num).toDouble())
          .toList(),
      headroomFactor: (json['headroomFactor'] as num?)?.toDouble() ?? 1.25,
      confidence: json['confidence'] as String? ?? 'medium',
    );
  }
}

class CookStep {
  const CookStep({
    required this.id,
    required this.text,
    this.timerMin,
    this.isAddin = false,
  });

  final String id;
  final String text;
  final double? timerMin;
  final bool isAddin;

  factory CookStep.fromJson(Map<String, dynamic> json) {
    return CookStep(
      id: json['id'] as String? ?? '',
      text: json['text'] as String? ?? '',
      timerMin: (json['timerMin'] as num?)?.toDouble(),
      isAddin: json['isAddin'] == true,
    );
  }
}

class CookTimerSpec {
  const CookTimerSpec({
    required this.id,
    required this.label,
    required this.minutes,
  });

  final String id;
  final String label;
  final double minutes;

  factory CookTimerSpec.fromJson(Map<String, dynamic> json) {
    return CookTimerSpec(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      minutes: (json['minutes'] as num?)?.toDouble() ?? 0,
    );
  }
}

class PanasonicProfile {
  const PanasonicProfile({
    required this.compatible,
    required this.programNo,
    required this.programName,
    this.crust = '',
    this.loafSize = '',
    this.totalTimeMin = 0,
    this.steps = const [],
    this.timers = const [],
    this.warnings = const [],
  });

  final bool compatible;
  final String programNo;
  final String programName;
  final String crust;
  final String loafSize;
  final int totalTimeMin;
  final List<CookStep> steps;
  final List<CookTimerSpec> timers;
  final List<String> warnings;

  factory PanasonicProfile.fromJson(Map<String, dynamic> json) {
    return PanasonicProfile(
      compatible: json['compatible'] != false,
      programNo: json['programNo']?.toString() ?? '',
      programName: json['programName'] as String? ?? '',
      crust: json['crust'] as String? ?? '',
      loafSize: json['loafSize'] as String? ?? '',
      totalTimeMin: (json['totalTimeMin'] as num?)?.toInt() ?? 0,
      steps: (json['steps'] as List?)
              ?.map((e) => CookStep.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      timers: (json['timers'] as List?)
              ?.map((e) =>
                  CookTimerSpec.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      warnings:
          (json['warnings'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
    );
  }
}

class RedmondBake {
  const RedmondBake({
    required this.program,
    required this.timeMin,
    this.secondBakeMin,
    this.temperatureC,
  });

  final String program;
  final int timeMin;
  final int? secondBakeMin;
  final int? temperatureC;

  factory RedmondBake.fromJson(Map<String, dynamic> json) {
    return RedmondBake(
      program: json['program'] as String? ?? 'BREAD',
      timeMin: (json['timeMin'] as num?)?.toInt() ?? 0,
      secondBakeMin: (json['secondBakeMin'] as num?)?.toInt(),
      temperatureC: (json['temperatureC'] as num?)?.toInt(),
    );
  }
}

class RedmondProof {
  const RedmondProof({
    required this.program,
    required this.timeMin,
    this.temperatureC,
  });

  final String program;
  final int timeMin;
  final int? temperatureC;

  factory RedmondProof.fromJson(Map<String, dynamic> json) {
    return RedmondProof(
      program: json['program'] as String? ?? 'MULTI_COOK',
      timeMin: (json['timeMin'] as num?)?.toInt() ?? 0,
      temperatureC: (json['temperatureC'] as num?)?.toInt(),
    );
  }
}

class RedmondFlip {
  const RedmondFlip({
    required this.required,
    required this.optional,
    this.suggestedAtMin,
    this.reason = '',
  });

  final bool required;
  final bool optional;
  final int? suggestedAtMin;
  final String reason;

  factory RedmondFlip.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const RedmondFlip(required: false, optional: true);
    }
    return RedmondFlip(
      required: json['required'] == true,
      optional: json['optional'] != false,
      suggestedAtMin: (json['suggestedAtMin'] as num?)?.toInt(),
      reason: json['reason'] as String? ?? '',
    );
  }
}

class RedmondProfile {
  const RedmondProfile({
    required this.compatible,
    required this.workflow,
    this.proof,
    required this.bake,
    required this.flip,
    this.steps = const [],
    this.timers = const [],
    this.warnings = const [],
  });

  final bool compatible;
  final String workflow;
  final RedmondProof? proof;
  final RedmondBake bake;
  final RedmondFlip flip;
  final List<CookStep> steps;
  final List<CookTimerSpec> timers;
  final List<String> warnings;

  factory RedmondProfile.fromJson(Map<String, dynamic> json) {
    return RedmondProfile(
      compatible: json['compatible'] != false,
      workflow: json['workflow'] as String? ?? 'bread-3h',
      proof: json['proof'] is Map
          ? RedmondProof.fromJson(Map<String, dynamic>.from(json['proof'] as Map))
          : null,
      bake: RedmondBake.fromJson(
        Map<String, dynamic>.from(json['bake'] as Map? ?? {}),
      ),
      flip: RedmondFlip.fromJson(
        json['flip'] is Map
            ? Map<String, dynamic>.from(json['flip'] as Map)
            : null,
      ),
      steps: (json['steps'] as List?)
              ?.map((e) => CookStep.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      timers: (json['timers'] as List?)
              ?.map((e) =>
                  CookTimerSpec.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList() ??
          const [],
      warnings:
          (json['warnings'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
    );
  }
}

class Recipe {
  const Recipe({
    required this.id,
    required this.title,
    required this.category,
    required this.specialty,
    required this.description,
    required this.tags,
    required this.difficulty,
    required this.sourceConfidence,
    required this.sourceNotes,
    required this.baseTotalFlourG,
    required this.flourComponents,
    required this.ingredients,
    required this.tasteAddinIds,
    required this.physics,
    required this.panasonic,
    required this.redmond,
  });

  final String id;
  final String title;
  final String category;
  final String specialty;
  final String description;
  final List<String> tags;
  final String difficulty;
  final String sourceConfidence;
  final String sourceNotes;
  final double baseTotalFlourG;
  final List<FlourComponent> flourComponents;
  final List<RecipeIngredientRow> ingredients;
  final List<String> tasteAddinIds;
  final RecipePhysics physics;
  final PanasonicProfile panasonic;
  final RedmondProfile redmond;

  factory Recipe.fromJson(String id, Map<String, dynamic> json) {
    final profiles = Map<String, dynamic>.from(json['machineProfiles'] as Map);
    return Recipe(
      id: json['id'] as String? ?? id,
      title: json['title'] as String? ?? id,
      category: json['category'] as String? ?? '',
      specialty: json['specialty'] as String? ?? '',
      description: json['description'] as String? ?? '',
      tags: (json['tags'] as List?)?.map((e) => e.toString()).toList() ??
          const [],
      difficulty: json['difficulty'] as String? ?? 'лёгкий',
      sourceConfidence: json['sourceConfidence'] as String? ?? '',
      sourceNotes: json['sourceNotes'] as String? ?? '',
      baseTotalFlourG: (json['baseTotalFlourG'] as num).toDouble(),
      flourComponents: (json['flourComponents'] as List)
          .map((e) =>
              FlourComponent.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      ingredients: (json['ingredients'] as List)
          .map((e) => RecipeIngredientRow.fromJson(
                Map<String, dynamic>.from(e as Map),
              ))
          .toList(),
      tasteAddinIds:
          (json['tasteAddinIds'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
      physics: RecipePhysics.fromJson(
        Map<String, dynamic>.from(json['physics'] as Map),
      ),
      panasonic: PanasonicProfile.fromJson(
        Map<String, dynamic>.from(profiles['panasonic'] as Map),
      ),
      redmond: RedmondProfile.fromJson(
        Map<String, dynamic>.from(profiles['redmond'] as Map),
      ),
    );
  }
}

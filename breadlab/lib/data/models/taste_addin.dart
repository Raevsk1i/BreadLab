class TasteAddin {
  const TasteAddin({
    required this.id,
    required this.ingredientId,
    required this.name,
    required this.category,
    required this.suggestedBakerPctRange,
    required this.defaultPct,
    this.role = '',
    this.effect = '',
    this.prep = '',
    this.warnings = const [],
    this.placement = const {},
    this.dry = true,
  });

  final String id;
  final String ingredientId;
  final String name;
  final String category;
  final List<double> suggestedBakerPctRange;
  final double defaultPct;
  final String role;
  final String effect;
  final String prep;
  final List<String> warnings;
  final Map<String, String> placement;
  final bool dry;

  factory TasteAddin.fromJson(String id, Map<String, dynamic> json) {
    final range = (json['suggestedBakerPctRange'] as List?)
            ?.map((e) => (e as num).toDouble())
            .toList() ??
        const [0.0, 0.0];
    final placementRaw = json['placement'];
    final placement = <String, String>{};
    if (placementRaw is Map) {
      placementRaw.forEach((k, v) => placement[k.toString()] = v.toString());
    }
    return TasteAddin(
      id: json['id'] as String? ?? id,
      ingredientId: json['ingredientId'] as String? ?? id,
      name: json['name'] as String? ?? id,
      category: json['category'] as String? ?? 'other',
      suggestedBakerPctRange: range,
      defaultPct: (json['defaultPct'] as num?)?.toDouble() ?? 0,
      role: json['role'] as String? ?? '',
      effect: json['effect'] as String? ?? '',
      prep: json['prep'] as String? ?? '',
      warnings:
          (json['warnings'] as List?)?.map((e) => e.toString()).toList() ??
              const [],
      placement: placement,
      dry: json['dry'] != false,
    );
  }
}

class Ingredient {
  const Ingredient({
    required this.id,
    required this.name,
    required this.category,
    this.aliases = const [],
    this.defaultPantryStaple = false,
    this.hydrationFraction = 0,
    this.densityGPerMl = 1,
    this.unitDefault = 'g',
    this.description = '',
    this.roleDefault = '',
    this.increaseEffect = '',
    this.decreaseEffect = '',
    this.substitutions = const [],
    this.hideFromPantry = false,
  });

  final String id;
  final String name;
  final String category;
  final List<String> aliases;
  final bool defaultPantryStaple;
  final double hydrationFraction;
  final double densityGPerMl;
  final String unitDefault;
  final String description;
  final String roleDefault;
  final String increaseEffect;
  final String decreaseEffect;
  final List<String> substitutions;
  final bool hideFromPantry;

  factory Ingredient.fromJson(String id, Map<String, dynamic> json) {
    return Ingredient(
      id: json['id'] as String? ?? id,
      name: json['name'] as String? ?? id,
      category: json['category'] as String? ?? 'other',
      aliases: _stringList(json['aliases']),
      defaultPantryStaple: json['defaultPantryStaple'] == true,
      hydrationFraction: _toDouble(json['hydrationFraction']),
      densityGPerMl: _toDouble(json['densityGPerMl'], 1),
      unitDefault: json['unitDefault'] as String? ?? 'g',
      description: json['description'] as String? ?? '',
      roleDefault: json['roleDefault'] as String? ?? '',
      increaseEffect: json['increaseEffect'] as String? ?? '',
      decreaseEffect: json['decreaseEffect'] as String? ?? '',
      substitutions: _stringList(json['substitutions']),
      hideFromPantry: json['hideFromPantry'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'category': category,
        'aliases': aliases,
        'defaultPantryStaple': defaultPantryStaple,
        'hydrationFraction': hydrationFraction,
        'densityGPerMl': densityGPerMl,
        'unitDefault': unitDefault,
        'description': description,
        'roleDefault': roleDefault,
        'increaseEffect': increaseEffect,
        'decreaseEffect': decreaseEffect,
        'substitutions': substitutions,
        if (hideFromPantry) 'hideFromPantry': true,
      };
}

List<String> _stringList(dynamic v) {
  if (v is List) return v.map((e) => e.toString()).toList();
  return const [];
}

double _toDouble(dynamic v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? fallback;
  return fallback;
}

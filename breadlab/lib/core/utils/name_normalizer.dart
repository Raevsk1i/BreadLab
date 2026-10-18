import '../../data/models/ingredient.dart';

class NameNormalizer {
  const NameNormalizer._();

  static String normalize(String? s) {
    return (s ?? '').toLowerCase().replaceAll('ё', 'е').trim();
  }

  static String? resolveIngredientId(
    String token,
    Map<String, Ingredient> ingredients,
  ) {
    final t = normalize(token);
    if (ingredients.containsKey(t)) return t;
    for (final entry in ingredients.entries) {
      final ing = entry.value;
      if (normalize(ing.name) == t) return entry.key;
      if (ing.aliases.any((a) => normalize(a) == t)) return entry.key;
    }
    return null;
  }

  static bool matchesQuery(Ingredient ing, String query) {
    final q = normalize(query);
    if (q.isEmpty) return true;
    if (normalize(ing.name).contains(q)) return true;
    return ing.aliases.any((a) => normalize(a).contains(q));
  }
}

import '../datasources/asset_catalog_datasource.dart';
import '../models/category.dart';
import '../models/ingredient.dart';
import '../models/machine.dart';
import '../models/recipe.dart';
import '../models/taste_addin.dart';
import '../../domain/engines/breadlab_calculation_engine.dart';
import '../../domain/services/cooking_steps_service.dart';
import '../../domain/services/recipe_matcher.dart';

class BreadLabCatalog {
  BreadLabCatalog({
    required this.version,
    required this.alwaysAvailable,
    required this.categories,
    required this.ingredients,
    required this.machines,
    required this.recipes,
    required this.tasteAddins,
  });

  final String version;
  final List<String> alwaysAvailable;
  final List<Category> categories;
  final Map<String, Ingredient> ingredients;
  final Map<String, Machine> machines;
  final Map<String, Recipe> recipes;
  final Map<String, TasteAddin> tasteAddins;

  late final BreadLabCalculationEngine engine = BreadLabCalculationEngine(
    ingredients: ingredients,
    tasteAddins: tasteAddins,
    machines: machines,
  );

  late final RecipeMatcher matcher = RecipeMatcher(
    recipes: recipes,
    ingredients: ingredients,
    alwaysAvailable: alwaysAvailable,
  );

  late final CookingStepsService cookingSteps = CookingStepsService(
    tasteAddins: tasteAddins,
    engine: engine,
  );

  List<String> get sortedRecipeIds {
    final ids = recipes.keys.toList()..sort();
    return ids;
  }

  List<String> get sortedIngredientIds {
    final ids = ingredients.keys.toList()..sort();
    return ids;
  }
}

class CatalogRepository {
  CatalogRepository({AssetCatalogDatasource? datasource})
      : _ds = datasource ?? AssetCatalogDatasource();

  final AssetCatalogDatasource _ds;
  BreadLabCatalog? _cache;

  Future<BreadLabCatalog> load() async {
    if (_cache != null) return _cache!;

    final meta = await _ds.loadJson('assets/data/meta.json');
    final categoriesRaw = await _ds.loadJsonList('assets/data/categories.json');
    final ingredientsRaw =
        await _ds.loadJson('assets/data/ingredients.json');
    final machinesRaw = await _ds.loadJson('assets/data/machines.json');
    final recipesRaw = await _ds.loadJson('assets/data/recipes.json');
    final addinsRaw = await _ds.loadJson('assets/data/taste_addins.json');

    final categories = categoriesRaw
        .map((e) => Category.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();

    final ingredients = <String, Ingredient>{};
    ingredientsRaw.forEach((k, v) {
      ingredients[k] =
          Ingredient.fromJson(k, Map<String, dynamic>.from(v as Map));
    });

    final machines = <String, Machine>{};
    machinesRaw.forEach((k, v) {
      machines[k] = Machine.fromJson(k, Map<String, dynamic>.from(v as Map));
    });

    final recipes = <String, Recipe>{};
    recipesRaw.forEach((k, v) {
      recipes[k] = Recipe.fromJson(k, Map<String, dynamic>.from(v as Map));
    });

    final tasteAddins = <String, TasteAddin>{};
    addinsRaw.forEach((k, v) {
      tasteAddins[k] =
          TasteAddin.fromJson(k, Map<String, dynamic>.from(v as Map));
    });

    _cache = BreadLabCatalog(
      version: meta['version'] as String? ?? '1.0.0',
      alwaysAvailable: (meta['alwaysAvailable'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      categories: categories,
      ingredients: ingredients,
      machines: machines,
      recipes: recipes,
      tasteAddins: tasteAddins,
    );
    return _cache!;
  }

  BreadLabCatalog? get cached => _cache;
}

import 'dart:convert';
import 'dart:io';

import 'package:breadlab/data/models/ingredient.dart';
import 'package:breadlab/data/models/machine.dart';
import 'package:breadlab/data/models/recipe.dart';
import 'package:breadlab/data/models/taste_addin.dart';
import 'package:breadlab/domain/engines/breadlab_calculation_engine.dart';
import 'package:breadlab/domain/models/scaled_recipe.dart';
import 'package:breadlab/domain/services/recipe_matcher.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> _load(String name) {
  final f = File('assets/data/$name');
  return jsonDecode(f.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  late Map<String, Ingredient> ingredients;
  late Map<String, Recipe> recipes;
  late Map<String, TasteAddin> tasteAddins;
  late Map<String, Machine> machines;
  late BreadLabCalculationEngine engine;
  late RecipeMatcher matcher;
  late List<String> alwaysAvailable;

  setUpAll(() {
    final meta = _load('meta.json');
    alwaysAvailable =
        (meta['alwaysAvailable'] as List).map((e) => e.toString()).toList();
    final ingRaw = _load('ingredients.json');
    ingredients = ingRaw.map(
      (k, v) => MapEntry(k, Ingredient.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final recRaw = _load('recipes.json');
    recipes = recRaw.map(
      (k, v) => MapEntry(k, Recipe.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final addRaw = _load('taste_addins.json');
    tasteAddins = addRaw.map(
      (k, v) => MapEntry(k, TasteAddin.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final macRaw = _load('machines.json');
    machines = macRaw.map(
      (k, v) => MapEntry(k, Machine.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    engine = BreadLabCalculationEngine(
      ingredients: ingredients,
      tasteAddins: tasteAddins,
      machines: machines,
    );
    matcher = RecipeMatcher(
      recipes: recipes,
      ingredients: ingredients,
      alwaysAvailable: alwaysAvailable,
    );
  });

  test('all 35 recipes present p01-p35', () {
    expect(recipes.length, 35);
    for (var i = 1; i <= 35; i++) {
      final id = 'p${i.toString().padLeft(2, '0')}';
      expect(recipes.containsKey(id), isTrue, reason: id);
    }
  });

  test('no ingredient loss (54)', () {
    expect(ingredients.length, 54);
  });

  test('scale factor 600/400 and water 390 for p01', () {
    final r = recipes['p01']!;
    final scaled = engine.scaleRecipe(r, 600, const []);
    expect(scaled.factor, closeTo(1.5, 1e-9));
    final water = scaled.items.firstWhere((i) => i.ingredientId == 'water');
    expect(water.grams, closeTo(390, 1e-6));
  });

  test('hydration ~65 at 400g flour for p01', () {
    final r = recipes['p01']!;
    final scaled = engine.scaleRecipe(r, 400, const []);
    final h = engine.calculateHydration(scaled);
    expect((h - 65).abs() < 0.2, isTrue, reason: 'hydration=$h');
  });

  test('mixed flour ratio preserved on scale (p15)', () {
    final r = recipes['p15']!;
    final a = engine.scaleRecipe(r, r.baseTotalFlourG, const []);
    final b = engine.scaleRecipe(r, r.baseTotalFlourG * 1.5, const []);
    final ryeA = a.items.firstWhere((i) => i.ingredientId == 'rye_flour').grams;
    final wheatA =
        a.items.firstWhere((i) => i.ingredientId == 'wheat_flour').grams;
    final ryeB = b.items.firstWhere((i) => i.ingredientId == 'rye_flour').grams;
    final wheatB =
        b.items.firstWhere((i) => i.ingredientId == 'wheat_flour').grams;
    expect(ryeA / wheatA, closeTo(ryeB / wheatB, 1e-9));
  });

  test('finished weight less than dough mass', () {
    final r = recipes['p01']!;
    final scaled = engine.scaleRecipe(r, 400, const []);
    final dough = engine.calculateDoughMass(scaled);
    final fin = engine.estimateFinishedWeight(dough, r.physics.bakeLossRange);
    expect(fin.max < dough, isTrue);
    expect(fin.min < fin.max, isTrue);
    expect(engine.isFiniteMass(dough), isTrue);
  });

  test('Panasonic flour boundaries 349/350/600/601', () {
    final r = recipes['p01']!;
    List<String> codes(double flour) {
      final s = engine.scaleRecipe(r, flour, const []);
      return engine
          .validateMachineLimits('panasonic_sd_yr2540hts', r, s)
          .map((w) => w.code)
          .toList();
    }

    expect(codes(349), contains('flour_low'));
    expect(codes(350), isNot(contains('flour_low')));
    expect(codes(350), isNot(contains('flour_high')));
    expect(codes(600), isNot(contains('flour_high')));
    expect(codes(601), contains('flour_high'));
  });

  test('dispenser >150 danger', () {
    final r = recipes['p01']!;
    final scaled = engine.scaleRecipe(r, 400, const ['raisin']);
    // Force synthetic dispenser overload like HTML self-test
    final overloaded = ScaledRecipe(
      targetFlourG: scaled.targetFlourG,
      factor: scaled.factor,
      items: scaled.items,
      addins: [
        ScaledItem(
          ingredientId: 'raisin',
          grams: 160,
          bakerPct: 40,
          row: null,
          addinId: 'raisin',
          isAddin: true,
          placement: const IngredientPlacement(
            panasonic: 'raisinNutDispenser',
            redmond: 'manual',
          ),
        ),
      ],
    );
    final warnings = engine.validateMachineLimits(
      'panasonic_sd_yr2540hts',
      r,
      overloaded,
    );
    expect(warnings.map((w) => w.code), contains('dispenser'));
  });

  test('alias wheat flour resolves', () {
    expect(
      matcher.resolveIngredientId('хлебопекарная мука'),
      'wheat_flour',
    );
  });

  test('match recipes with near missing', () {
    final pantry = {
      'wheat_flour',
      'yeast',
      'milk',
      'butter',
      'eggs',
    };
    final results = matcher.match(pantry, nearMatch: true);
    expect(results, isNotEmpty);
    expect(results.any((m) => m.status == 'exact' || m.status == 'near'), isTrue);
  });

  test('addins stay per recipe bags conceptually', () {
    final a = engine.scaleRecipe(recipes['p01']!, 400, const ['walnut']);
    final b = engine.scaleRecipe(recipes['p02']!, 400, const []);
    expect(a.addins.length, 1);
    expect(b.addins.length, 0);
  });

  test('titles preserved', () {
    expect(recipes['p01']!.title, 'Нарезной белый');
    expect(recipes['p15']!.title, contains('Дарниц'));
    expect(recipes['p16']!.title, contains('Бородин'));
  });

  test('panasonic program map 01', () {
    expect(machines['panasonic_sd_yr2540hts']!.programs['01'], 'Основной');
  });
}

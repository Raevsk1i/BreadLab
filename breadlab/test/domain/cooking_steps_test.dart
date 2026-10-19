import 'dart:convert';
import 'dart:io';

import 'package:breadlab/data/models/ingredient.dart';
import 'package:breadlab/data/models/machine.dart';
import 'package:breadlab/data/models/recipe.dart';
import 'package:breadlab/data/models/taste_addin.dart';
import 'package:breadlab/domain/engines/breadlab_calculation_engine.dart';
import 'package:breadlab/domain/services/cooking_steps_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('fillStepText replaces placeholders', () {
    final ingRaw =
        jsonDecode(File('assets/data/ingredients.json').readAsStringSync())
            as Map<String, dynamic>;
    final ingredients = ingRaw.map(
      (k, v) =>
          MapEntry(k, Ingredient.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final addRaw =
        jsonDecode(File('assets/data/taste_addins.json').readAsStringSync())
            as Map<String, dynamic>;
    final tasteAddins = addRaw.map(
      (k, v) =>
          MapEntry(k, TasteAddin.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final macRaw =
        jsonDecode(File('assets/data/machines.json').readAsStringSync())
            as Map<String, dynamic>;
    final machines = macRaw.map(
      (k, v) =>
          MapEntry(k, Machine.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );
    final recRaw =
        jsonDecode(File('assets/data/recipes.json').readAsStringSync())
            as Map<String, dynamic>;
    final recipes = recRaw.map(
      (k, v) =>
          MapEntry(k, Recipe.fromJson(k, Map<String, dynamic>.from(v as Map))),
    );

    final engine = BreadLabCalculationEngine(
      ingredients: ingredients,
      tasteAddins: tasteAddins,
      machines: machines,
    );
    final svc = CookingStepsService(tasteAddins: tasteAddins, engine: engine);
    final scaled = engine.scaleRecipe(recipes['p01']!, 400, const []);
    final text = svc.fillStepText(
      'Мука {flour_total}, вода {water}',
      scaled,
    );
    expect(text.contains('{'), isFalse);
    expect(text.contains('400 г'), isTrue);
    expect(text.contains('260 г'), isTrue);
  });
}

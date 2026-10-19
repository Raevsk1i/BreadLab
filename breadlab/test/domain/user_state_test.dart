import 'package:breadlab/data/models/user_state.dart';
import 'package:breadlab/domain/models/scaled_recipe.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('export payload has app BreadLab', () {
    final s = UserState();
    final p = s.toExportPayload('1.0.0');
    expect(p['app'], 'BreadLab');
    expect(p['version'], '1.0.0');
    expect(p.containsKey('exportedAt'), isTrue);
    expect(p.containsKey('settings'), isTrue);
  });

  test('isBreadLabImportPayload accepts and rejects', () {
    expect(UserState.isBreadLabImportPayload({'app': 'BreadLab'}), isTrue);
    expect(UserState.isBreadLabImportPayload({'pantry': {}}), isTrue);
    expect(UserState.isBreadLabImportPayload({}), isFalse);
    expect(UserState.isBreadLabImportPayload('x'), isFalse);
    expect(UserState.isBreadLabImportPayload(null), isFalse);
  });

  test('import ignores unknown recipe ids', () {
    final s = UserState();
    s.applyImport(
      {
        'app': 'BreadLab',
        'favorites': ['p01', 'p99'],
        'recent': ['ghost'],
        'selectedRecipeId': 'p01',
        'defaultMachineId': 'nope',
      },
      knownRecipeIds: {'p01'},
      knownMachineIds: {'panasonic_sd_yr2540hts'},
      knownIngredientIds: {'wheat_flour'},
    );
    expect(s.favorites, ['p01']);
    expect(s.recent, isEmpty);
    expect(s.selectedRecipeId, 'p01');
    expect(s.defaultMachineId, 'panasonic_sd_yr2540hts');
  });

  test('cook session persists running false', () {
    final cs = CookSession(
      recipeId: 'p01',
      machineId: 'panasonic_sd_yr2540hts',
      stepIndex: 3,
      timerId: 'cycle',
      ckKey: 'p01::panasonic_sd_yr2540hts::addins:',
      remainingMs: 90000,
      running: true,
    );
    expect(cs.toJson()['running'], isFalse);
    expect(cs.toJson()['stepIndex'], 3);
    expect(cs.toJson()['remainingMs'], 90000);
  });

  test('pruneChecklist keeps at most 8', () {
    final s = UserState();
    for (var i = 0; i < 12; i++) {
      s.checklist['k$i'] = {'s1': true};
    }
    s.recent = ['p01'];
    s.pruneChecklist();
    expect(s.checklist.length <= 8, isTrue);
  });

  test('corrupt/empty import rejected by helper', () {
    expect(UserState.isBreadLabImportPayload({}), isFalse);
  });
}

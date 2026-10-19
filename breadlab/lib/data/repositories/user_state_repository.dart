import 'dart:convert';

import '../../core/platform/app_storage.dart';
import '../models/user_state.dart';
import 'catalog_repository.dart';

class UserStateRepository {
  UserStateRepository({
    required this.catalogRepository,
    AppStorage? storage,
  }) : _storage = storage ?? AppStorage();

  final CatalogRepository catalogRepository;
  final AppStorage _storage;

  Future<UserState> load() async {
    final catalog = await catalogRepository.load();
    final state = UserState(defaultMachineId: catalog.machines.keys.first);
    // Seed staples
    for (final ing in catalog.ingredients.values) {
      if (ing.defaultPantryStaple) {
        state.pantry[ing.id] = true;
      }
    }
    final data = await _storage.load();
    if (data == null) return state;
    if (data['_corrupt'] == true) {
      state.themeMode = 'light';
      return state..cookSession = null;
    }
    state.applyPersisted(
      data,
      knownRecipeIds: catalog.recipes.keys.toSet(),
      knownMachineIds: catalog.machines.keys.toSet(),
      knownIngredientIds: catalog.ingredients.keys.toSet(),
    );
    return state;
  }

  Future<bool> save(UserState state) async {
    state.pruneChecklist();
    return _storage.save(state.toPersistPayload());
  }

  Future<String> exportJson(UserState state, String version) async {
    return const JsonEncoder.withIndent('  ')
        .convert(state.toExportPayload(version));
  }

  /// Returns null if rejected; UserState if applied (mutates [state]).
  String? importJson(UserState state, String raw, BreadLabCatalog catalog) {
    late final dynamic decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      return 'Некорректный JSON';
    }
    if (!UserState.isBreadLabImportPayload(decoded)) {
      return 'Файл не похож на экспорт BreadLab';
    }
    if (decoded is! Map) return 'Некорректная структура';
    // Empty object rejection (HTML rejects {})
    final map = Map<String, dynamic>.from(decoded);
    if (map.isEmpty) return 'Пустой объект';
    state.applyImport(
      map,
      knownRecipeIds: catalog.recipes.keys.toSet(),
      knownMachineIds: catalog.machines.keys.toSet(),
      knownIngredientIds: catalog.ingredients.keys.toSet(),
    );
    return null;
  }

  Future<bool> clear() => _storage.clear();
}

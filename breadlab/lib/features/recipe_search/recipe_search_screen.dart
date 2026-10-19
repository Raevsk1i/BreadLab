import 'package:flutter/material.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../shared/widgets/section_header.dart';
import '../recipe_calculator/recipe_calculator_screen.dart';

class RecipeSearchScreen extends StatelessWidget {
  const RecipeSearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    if (!app.searchRan) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search, size: 48, color: BreadLabColors.textSoft),
              const SizedBox(height: 12),
              const Text(
                'Отметьте ингредиенты и нажмите «Найти, что можно испечь».',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => app.setTab(1),
                child: const Text('К ингредиентам'),
              ),
            ],
          ),
        ),
      );
    }

    final tab = app.resultsTab;
    final filtered =
        app.searchResults.where((m) => m.machineKey == tab).toList();
    final exact = filtered.where((m) => m.status == 'exact').toList();
    final near = filtered.where((m) => m.status == 'near').toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SectionHeader(
            title: 'Подбор рецептов',
            subtitle: 'Только из локальной базы · ${app.searchResults.length} совпадений',
            trailing: Switch(
              value: app.user.nearMatchOn,
              onChanged: app.setNearMatch,
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Text(
                'Искать с недостающими (≤2)',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'panasonic', label: Text('Panasonic')),
            ButtonSegment(value: 'redmond', label: Text('REDMOND')),
          ],
          selected: {tab},
          onSelectionChanged: (s) => app.setResultsTab(s.first),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (exact.isNotEmpty) ...[
                const Text('Полностью доступны',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                ...exact.map((m) => _MatchCard(match: m)),
              ],
              if (near.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text('Не хватает ≤ 2 ингредиентов',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                ...near.map((m) => _MatchCard(match: m)),
              ],
              if (filtered.isEmpty)
                const SoftCard(
                  child: Text('Нет подходящих рецептов для этой техники.'),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MatchCard extends StatelessWidget {
  const _MatchCard({required this.match});
  final dynamic match;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final recipe = app.catalog!.recipes[match.recipeId as String]!;
    final missingNames = (match.missing as List<String>)
        .map((id) => app.catalog!.ingredients[id]?.name ?? id)
        .toList();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: SoftCard(
        onTap: () {
          app.openRecipe(match.recipeId as String,
              machineId: match.machineId as String);
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const RecipeCalculatorScreen()),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(recipe.title,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const SizedBox(height: 4),
            Text(
              '${match.programLabel} · ~${match.timeMin} мин · score ${match.score}',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (missingNames.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Не хватает: ${missingNames.join(', ')}',
                style: const TextStyle(color: BreadLabColors.warn),
              ),
            ] else
              const Text('Все ингредиенты есть',
                  style: TextStyle(color: BreadLabColors.greenDark)),
          ],
        ),
      ),
    );
  }
}

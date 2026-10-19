import 'package:flutter/material.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../core/utils/label_maps.dart';
import '../../shared/widgets/section_header.dart';
import '../recipe_calculator/recipe_calculator_screen.dart';

class CatalogScreen extends StatelessWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final recipes = app.filteredCatalog();
    final cats = ['all', ...LabelMaps.catalogCategoryOrder];

    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SectionHeader(
            title: 'Каталог хлеба',
            subtitle: 'Все 35 технологических карт локальной базы.',
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Поиск по названию, тегам…',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: app.setCatalogQuery,
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: cats.map((c) {
              final label = c == 'all' ? 'Все' : c;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FilterChip(
                  label: Text(label),
                  selected: app.catalogCategory == c,
                  onSelected: (_) => app.setCatalogCategory(c),
                ),
              );
            }).toList(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              for (final d in ['all', 'лёгкий', 'средний'])
                FilterChip(
                  label: Text(d == 'all' ? 'Сложность: все' : d),
                  selected: app.user.catalogDifficulty == d,
                  onSelected: (_) => app.setCatalogDifficulty(d),
                ),
              FilterChip(
                label: const Text('Избранное'),
                selected: app.user.catalogFavoritesOnly,
                onSelected: (v) => app.setCatalogFavoritesOnly(v),
              ),
              FilterChip(
                label: const Text('Можно испечь'),
                selected: app.user.catalogCanBake,
                onSelected: (v) => app.setCatalogCanBake(v),
              ),
            ],
          ),
        ),
        if (app.user.recent.isNotEmpty || app.user.favorites.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Быстрые подборки: недавние ${app.user.recent.take(3).join(', ')}'
                '${app.user.favorites.isNotEmpty ? ' · избранное ${app.user.favorites.length}' : ''}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: recipes.length,
            itemBuilder: (context, i) {
              final r = recipes[i];
              final fav = app.isFavorite(r.id);
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: SoftCard(
                  onTap: () {
                    app.openRecipe(r.id);
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const RecipeCalculatorScreen(),
                      ),
                    );
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              r.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                          ),
                          IconButton(
                            onPressed: () => app.toggleFavorite(r.id),
                            icon: Icon(
                              fav ? Icons.star : Icons.star_border,
                              color: fav
                                  ? BreadLabColors.gold
                                  : BreadLabColors.textSoft,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        '${r.category} · ${r.difficulty}',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        r.specialty,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        children: [
                          if (r.panasonic.compatible)
                            Chip(
                              visualDensity: VisualDensity.compact,
                              label: Text('Panasonic №${r.panasonic.programNo}'),
                            ),
                          if (r.redmond.compatible)
                            const Chip(
                              visualDensity: VisualDensity.compact,
                              label: Text('REDMOND'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

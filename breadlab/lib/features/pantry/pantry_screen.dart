import 'package:flutter/material.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../core/utils/name_normalizer.dart';
import '../../shared/widgets/section_header.dart';

class PantryScreen extends StatelessWidget {
  const PantryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final catalog = app.catalog;
    if (catalog == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final ings = catalog.ingredients.values.where((ing) {
      if (ing.hideFromPantry) return false;
      if (app.pantryCategory != 'all' && ing.category != app.pantryCategory) {
        return false;
      }
      return NameNormalizer.matchesQuery(ing, app.pantryQuery);
    }).toList()
      ..sort((a, b) => a.name.compareTo(b.name));

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: SectionHeader(
            title: 'Что есть дома',
            subtitle: 'Отметьте продукты — подберём, что можно испечь.',
            trailing: Text(
              '${app.pantrySelectedCount}',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: BreadLabColors.primary,
                fontSize: 18,
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: TextField(
            decoration: const InputDecoration(
              hintText: 'Поиск по названию или псевдониму',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: app.setPantryQuery,
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: catalog.categories.map((c) {
              final selected = app.pantryCategory == c.id;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: FilterChip(
                  label: Text(c.name),
                  selected: selected,
                  onSelected: (_) => app.setPantryCategory(c.id),
                ),
              );
            }).toList(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    if (app.pantrySelectedCount < 1) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Отметьте хотя бы один ингредиент'),
                        ),
                      );
                      return;
                    }
                    app.runSearch();
                  },
                  child: const Text('Найти, что можно испечь'),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Очистить выбранное?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Отмена'),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Очистить'),
                        ),
                      ],
                    ),
                  );
                  if (ok == true) app.clearPantry();
                },
                child: const Text('Очистить'),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            itemCount: ings.length,
            itemBuilder: (context, i) {
              final ing = ings[i];
              final checked = app.user.pantry[ing.id] == true;
              return CheckboxListTile(
                value: checked,
                onChanged: (v) => app.togglePantry(ing.id, v == true),
                title: Text(ing.name),
                subtitle: ing.aliases.isEmpty
                    ? null
                    : Text(
                        ing.aliases.take(3).join(', '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                controlAffinity: ListTileControlAffinity.leading,
              );
            },
          ),
        ),
      ],
    );
  }
}

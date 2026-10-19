import 'package:flutter/material.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../shared/widgets/section_header.dart';
import '../cooking/cooking_screen.dart';
import '../recipe_calculator/recipe_calculator_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final catalog = app.catalog;
    final favorites = app.user.favorites
        .map((id) => catalog?.recipes[id])
        .whereType<dynamic>()
        .take(6)
        .toList();
    final recent = app.user.recent
        .map((id) => catalog?.recipes[id])
        .whereType<dynamic>()
        .take(6)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        if (app.user.cookSession != null) ...[
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Продолжить приготовление',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  catalog?.recipes[app.user.cookSession!.recipeId]?.title ??
                      app.user.cookSession!.recipeId,
                  style: const TextStyle(color: BreadLabColors.textMuted),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    FilledButton(
                      onPressed: () {
                        final cs = app.user.cookSession!;
                        app.openRecipe(cs.recipeId,
                            machineId: cs.machineId, keepFlour: true);
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const CookingScreen(resume: true),
                          ),
                        );
                      },
                      child: const Text('Продолжить'),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: app.clearCookSession,
                      child: const Text('Сбросить'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        Row(
          children: [
            Expanded(
              child: Text(
                'BreadLab',
                style: Theme.of(context).textTheme.displaySmall,
              ),
            ),
            const OfflineBadge(),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          'Подбор и масштабирование хлеба для Panasonic SD-YR2540HTS и REDMOND SkyCooker RMC-M92S. Все данные и расчёты — на устройстве.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 20),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Поддерживаемая техника',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              const SizedBox(height: 10),
              _MachineLine(
                title: 'Panasonic SD-YR2540HTS',
                subtitle: 'Хлебопечка · программы русской редакции · диспенсеры',
              ),
              const SizedBox(height: 8),
              _MachineLine(
                title: 'REDMOND SkyCooker RMC-M92S',
                subtitle: 'Мультиварка · BREAD / MULTI COOK · ручные этапы',
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => app.setTab(1),
                icon: const Icon(Icons.kitchen_outlined),
                label: const Text('Что есть дома'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (favorites.isNotEmpty) ...[
          const SectionHeader(title: 'Избранное'),
          ...favorites.map((r) => _RecipeTile(
                title: r.title as String,
                subtitle: r.category as String,
                onTap: () {
                  app.openRecipe(r.id as String);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const RecipeCalculatorScreen(),
                    ),
                  );
                },
              )),
          const SizedBox(height: 16),
        ],
        if (recent.isNotEmpty) ...[
          const SectionHeader(title: 'Недавние'),
          ...recent.map((r) => _RecipeTile(
                title: r.title as String,
                subtitle: r.category as String,
                onTap: () {
                  app.openRecipe(r.id as String);
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const RecipeCalculatorScreen(),
                    ),
                  );
                },
              )),
        ],
        if (favorites.isEmpty && recent.isEmpty)
          SoftCard(
            child: Text(
              '35 технологических карт уже в приложении. Отметьте продукты на вкладке «Ингредиенты» или откройте каталог.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
      ],
    );
  }
}

class _MachineLine extends StatelessWidget {
  const _MachineLine({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.check_circle, color: BreadLabColors.green, size: 20),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
        ),
      ],
    );
  }
}

class _RecipeTile extends StatelessWidget {
  const _RecipeTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: SoftCard(
        onTap: onTap,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: BreadLabColors.textSoft),
          ],
        ),
      ),
    );
  }
}

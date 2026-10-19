import 'package:flutter/material.dart';

import '../features/catalog/catalog_screen.dart';
import '../features/home/home_screen.dart';
import '../features/pantry/pantry_screen.dart';
import '../features/recipe_search/recipe_search_screen.dart';
import '../features/settings/settings_screen.dart';
import 'app_scope.dart';
import 'app_state.dart';
import 'app_theme.dart';

class BreadLabApp extends StatefulWidget {
  const BreadLabApp({super.key, this.state});

  final AppState? state;

  @override
  State<BreadLabApp> createState() => _BreadLabAppState();
}

class _BreadLabAppState extends State<BreadLabApp> {
  late final AppState _state = widget.state ?? AppState();

  @override
  void initState() {
    super.initState();
    _state.init();
  }

  @override
  void dispose() {
    _state.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: _state,
      child: ListenableBuilder(
        listenable: _state,
        builder: (context, _) {
          final dark = _state.user.themeMode == 'dark';
          return MaterialApp(
            title: 'BreadLab',
            debugShowCheckedModeBanner: false,
            theme: BreadLabTheme.light(),
            darkTheme: BreadLabTheme.dark(),
            themeMode: dark ? ThemeMode.dark : ThemeMode.light,
            home: const _Shell(),
          );
        },
      ),
    );
  }
}

class _Shell extends StatelessWidget {
  const _Shell();

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Главная',
    ),
    NavigationDestination(
      icon: Icon(Icons.kitchen_outlined),
      selectedIcon: Icon(Icons.kitchen),
      label: 'Ингредиенты',
    ),
    NavigationDestination(
      icon: Icon(Icons.menu_book_outlined),
      selectedIcon: Icon(Icons.menu_book),
      label: 'Каталог',
    ),
    NavigationDestination(
      icon: Icon(Icons.bakery_dining_outlined),
      selectedIcon: Icon(Icons.bakery_dining),
      label: 'Рецепты',
    ),
    NavigationDestination(
      icon: Icon(Icons.settings_outlined),
      selectedIcon: Icon(Icons.settings),
      label: 'Настройки',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    if (app.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (app.loadError != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Ошибка загрузки: ${app.loadError}'),
          ),
        ),
      );
    }

    final pages = const [
      HomeScreen(),
      PantryScreen(),
      CatalogScreen(),
      RecipeSearchScreen(),
      SettingsScreen(),
    ];

    final wide = MediaQuery.sizeOf(context).width >= 900;
    final body = SafeArea(
      child: IndexedStack(index: app.tabIndex, children: pages),
    );

    if (wide) {
      return Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: app.tabIndex,
              onDestinationSelected: app.setTab,
              labelType: NavigationRailLabelType.all,
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: Text('Главная'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.kitchen_outlined),
                  selectedIcon: Icon(Icons.kitchen),
                  label: Text('Ингредиенты'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.menu_book_outlined),
                  selectedIcon: Icon(Icons.menu_book),
                  label: Text('Каталог'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.bakery_dining_outlined),
                  selectedIcon: Icon(Icons.bakery_dining),
                  label: Text('Рецепты'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings),
                  label: Text('Настройки'),
                ),
              ],
            ),
            const VerticalDivider(width: 1),
            Expanded(child: body),
          ],
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('BreadLab'),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 12),
            child: OfflineBadgeChip(),
          ),
        ],
      ),
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: app.tabIndex,
        onDestinationSelected: app.setTab,
        destinations: _destinations,
      ),
    );
  }
}

class OfflineBadgeChip extends StatelessWidget {
  const OfflineBadgeChip({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: BreadLabColors.greenBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Text(
        'Offline',
        style: TextStyle(
          color: BreadLabColors.greenDark,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

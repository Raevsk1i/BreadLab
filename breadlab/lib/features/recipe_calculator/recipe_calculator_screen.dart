import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../core/utils/label_maps.dart';
import '../../domain/models/scaled_recipe.dart';
import '../../shared/widgets/section_header.dart';
import '../calibration/calibration_screen.dart';
import '../cooking/cooking_screen.dart';

class RecipeCalculatorScreen extends StatelessWidget {
  const RecipeCalculatorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final recipe = app.selectedRecipe;
    final catalog = app.catalog;
    if (recipe == null || catalog == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Калькулятор')),
        body: const Center(child: Text('Рецепт не выбран')),
      );
    }

    final scaled = app.currentScaled()!;
    final engine = catalog.engine;
    final dough = engine.calculateDoughMass(scaled);
    final hydration = engine.calculateHydration(scaled);
    final calib = app.calibrationForCurrent();
    final finished = engine.estimateFinishedWeight(
      dough,
      recipe.physics.bakeLossRange,
      calib,
    );
    final volume = engine.estimateProofVolume(dough, recipe.physics);
    final dispenser = engine.calculateDispenserLoad(scaled);
    final warnings = engine.validateMachineLimits(
      app.user.selectedMachineId,
      recipe,
      scaled,
    );
    final machineKey = app.user.selectedMachineId == 'panasonic_sd_yr2540hts'
        ? 'panasonic'
        : 'redmond';
    final steps = catalog.cookingSteps.getCookingSteps(recipe, machineKey, scaled);

    // Shopping: missing vs pantry for this recipe
    final required = catalog.matcher.requiredIds(recipe);
    final missing = required.where((id) => !app.user.pantrySet.contains(id));

    return Scaffold(
      appBar: AppBar(
        title: Text(recipe.title),
        actions: [
          IconButton(
            tooltip: 'Избранное',
            onPressed: () => app.toggleFavorite(recipe.id),
            icon: Icon(
              app.isFavorite(recipe.id) ? Icons.star : Icons.star_border,
              color: app.isFavorite(recipe.id) ? BreadLabColors.gold : null,
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(recipe.specialty, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Техника', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'panasonic_sd_yr2540hts',
                      label: Text('Panasonic'),
                    ),
                    ButtonSegment(
                      value: 'redmond_rmc_m92s',
                      label: Text('REDMOND'),
                    ),
                  ],
                  selected: {app.user.selectedMachineId},
                  onSelectionChanged: (s) => app.setMachine(s.first),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Мука, г',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                    IconButton(
                      onPressed: () =>
                          app.setTargetFlour(app.user.targetFlourG - 10),
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    SizedBox(
                      width: 72,
                      child: TextField(
                        key: ValueKey(app.user.targetFlourG.round()),
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly
                        ],
                        controller: TextEditingController(
                          text: app.user.targetFlourG.round().toString(),
                        ),
                        onSubmitted: (v) {
                          final n = double.tryParse(v);
                          if (n != null) app.setTargetFlour(n);
                        },
                        decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(vertical: 8),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () =>
                          app.setTargetFlour(app.user.targetFlourG + 10),
                      icon: const Icon(Icons.add_circle_outline),
                    ),
                  ],
                ),
                Slider(
                  min: 300,
                  max: 600,
                  divisions: 30,
                  value: app.user.targetFlourG.clamp(300, 600),
                  label: '${app.user.targetFlourG.round()} г',
                  onChanged: app.setTargetFlour,
                ),
                Text(
                  'Коэффициент ×${scaled.factor.toStringAsFixed(3)} · база ${recipe.baseTotalFlourG.round()} г',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Kpi('Гидратация', '${hydration.toStringAsFixed(1)}%'),
              _Kpi('Тесто', '${dough.round()} г'),
              _Kpi(
                'Буханка',
                '${finished.min.round()}–${finished.max.round()} г',
              ),
              _Kpi(
                'Объём пик',
                '${volume.proofedMaxMl.round()} мл',
              ),
              _Kpi('Диспенсер', '${dispenser.round()} г'),
            ],
          ),
          if (warnings.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...warnings.map((w) => _WarningTile(w)),
          ],
          const SizedBox(height: 16),
          const SectionHeader(title: 'Ингредиенты'),
          ...scaled.items.map((item) {
            final meta = catalog.ingredients[item.ingredientId];
            final place = machineKey == 'panasonic'
                ? item.effectivePlacement.panasonic
                : item.effectivePlacement.redmond;
            final g = engine.formatGrams(item.ingredientId, item.grams);
            return SoftCard(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          meta?.name ?? item.ingredientId,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      Text('$g г',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.bakerPct.toStringAsFixed(1)}% · ${LabelMaps.stageLabel(item.row?.stage)} · ${LabelMaps.placementLabel(place, machineKey)}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (item.row?.role.isNotEmpty == true)
                    Text(item.row!.role),
                ],
              ),
            );
          }),
          if (recipe.tasteAddinIds.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(
              title: 'Добавить по вкусу',
              subtitle: 'Проценты от массы муки',
            ),
            ...recipe.tasteAddinIds.map((aid) {
              final a = catalog.tasteAddins[aid];
              if (a == null) return const SizedBox.shrink();
              final on = app.user.enabledTasteAddins[aid] == true;
              return CheckboxListTile(
                value: on,
                onChanged: (v) => app.setAddin(aid, v == true),
                title: Text(a.name),
                subtitle: Text(
                  '${a.defaultPct}% (${a.suggestedBakerPctRange[0]}–${a.suggestedBakerPctRange[1]}%) · ${a.role}',
                ),
              );
            }),
          ],
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Список покупок'),
            SoftCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: missing.map((id) {
                  final name = catalog.ingredients[id]?.name ?? id;
                  ScaledItem? row;
                  for (final i in scaled.items) {
                    if (i.ingredientId == id) {
                      row = i;
                      break;
                    }
                  }
                  final g = row == null
                      ? ''
                      : ' — ${engine.formatGrams(id, row.grams)} г';
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text('• $name$g'),
                  );
                }).toList(),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const SectionHeader(title: 'Инструкция'),
          SoftCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < steps.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      '${i + 1}. ${catalog.cookingSteps.fillStepText(steps[i].text, scaled)}',
                      style: TextStyle(
                        fontSize: app.user.largeSteps ? 18 : 15,
                        height: 1.45,
                        color: steps[i].isAddin
                            ? BreadLabColors.greenDark
                            : BreadLabColors.text,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CookingScreen()),
                  );
                },
                icon: const Icon(Icons.play_arrow),
                label: const Text('Режим приготовления'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const CalibrationScreen(),
                    ),
                  );
                },
                icon: const Icon(Icons.balance),
                label: const Text('Калибровка'),
              ),
              OutlinedButton.icon(
                onPressed: () async {
                  final buf = StringBuffer('${recipe.title}\n');
                  buf.writeln('Мука: ${scaled.targetFlourG.round()} г');
                  for (final item in scaled.all) {
                    final name = item.name ??
                        catalog.ingredients[item.ingredientId]?.name ??
                        item.ingredientId;
                    buf.writeln(
                      '$name — ${engine.formatGrams(item.ingredientId, item.grams)} г',
                    );
                  }
                  await Clipboard.setData(ClipboardData(text: buf.toString()));
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Рецепт скопирован')),
                    );
                  }
                },
                icon: const Icon(Icons.copy),
                label: const Text('Копировать'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: BreadLabColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: BreadLabColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ],
      ),
    );
  }
}

class _WarningTile extends StatelessWidget {
  const _WarningTile(this.w);
  final MachineWarning w;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (w.level) {
      case WarningLevel.danger:
        bg = BreadLabColors.dangerBg;
        fg = BreadLabColors.danger;
      case WarningLevel.warn:
        bg = BreadLabColors.warnBg;
        fg = BreadLabColors.warn;
      case WarningLevel.ok:
        bg = BreadLabColors.greenBg;
        fg = BreadLabColors.greenDark;
    }
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(w.message, style: TextStyle(color: fg)),
    );
  }
}

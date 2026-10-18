import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../shared/widgets/section_header.dart';

class CalibrationScreen extends StatefulWidget {
  const CalibrationScreen({super.key});

  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  final _weightCtrl = TextEditingController();
  final _fillCtrl = TextEditingController();

  @override
  void dispose() {
    _weightCtrl.dispose();
    _fillCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final recipe = app.selectedRecipe;
    final last = app.calibrationForCurrent();

    return Scaffold(
      appBar: AppBar(title: const Text('Калибровка')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionHeader(
            title: 'Что получилось?',
            subtitle:
                'Фактический вес корректирует прогноз буханки для этого рецепта и техники. Оценки остаются ориентировочными.',
          ),
          if (recipe == null)
            const SoftCard(child: Text('Сначала откройте рецепт.'))
          else ...[
            Text(recipe.title,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
            const SizedBox(height: 4),
            Text(
              '${app.user.selectedMachineId.contains('panasonic') ? 'Panasonic' : 'REDMOND'} · мука ${app.user.targetFlourG.round()} г',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _weightCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Фактический вес буханки, г',
                hintText: 'например 680',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _fillCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Макс. заполнение чаши, % (необязательно)',
                hintText: 'например 65',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () {
                final w = double.tryParse(_weightCtrl.text);
                if (w == null || w < 50) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Укажите вес не менее 50 г'),
                    ),
                  );
                  return;
                }
                final fill = double.tryParse(_fillCtrl.text);
                app.saveCalibration(
                  actualWeightG: w,
                  peakFillPercent: fill,
                );
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Калибровка сохранена'),
                    backgroundColor: BreadLabColors.green,
                  ),
                );
              },
              child: const Text('Сохранить измерение'),
            ),
            if (last != null) ...[
              const SizedBox(height: 20),
              SoftCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Последняя калибровка',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(
                      'Факт: ${last.actualFinishedWeightG.round()} г · прогноз mid: ${last.predictedMid.round()} г',
                    ),
                    if (last.peakFillPercent != null)
                      Text('Заполнение: ${last.peakFillPercent!.round()}%'),
                    Text(last.timestamp,
                        style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/app_scope.dart';
import '../../app/app_theme.dart';
import '../../shared/widgets/section_header.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      children: [
        const SectionHeader(
          title: 'Настройки и справка',
          subtitle: 'Локальные данные, техника по умолчанию, методология.',
        ),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Техника по умолчанию',
                  style: TextStyle(fontWeight: FontWeight.w700)),
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
                selected: {app.user.defaultMachineId},
                onSelectionChanged: (s) => app.setDefaultMachine(s.first),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Крупный текст инструкций'),
                value: app.user.largeSteps,
                onChanged: app.setLargeSteps,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Тёмная тема'),
                value: app.user.themeMode == 'dark',
                onChanged: (v) => app.setThemeMode(v ? 'dark' : 'light'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Данные',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: () async {
                      final json = await app.exportJson();
                      try {
                        final dir = await getTemporaryDirectory();
                        final file = File('${dir.path}/breadlab-export.json');
                        await file.writeAsString(json);
                        await SharePlus.instance.share(
                          ShareParams(
                            files: [XFile(file.path)],
                            subject: 'BreadLab export',
                          ),
                        );
                      } catch (_) {
                        await Clipboard.setData(ClipboardData(text: json));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Экспорт скопирован в буфер (share недоступен)',
                              ),
                            ),
                          );
                        }
                      }
                    },
                    icon: const Icon(Icons.upload_file),
                    label: const Text('Экспорт JSON'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () async {
                      try {
                        final result = await FilePicker.platform.pickFiles(
                          type: FileType.custom,
                          allowedExtensions: const ['json'],
                          withData: true,
                        );
                        if (result == null || result.files.isEmpty) return;
                        final f = result.files.first;
                        String raw;
                        if (f.bytes != null) {
                          raw = utf8.decode(f.bytes!);
                        } else if (f.path != null) {
                          raw = await File(f.path!).readAsString();
                        } else {
                          return;
                        }
                        final err = app.importJson(raw);
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              err ?? 'Импорт выполнен',
                            ),
                            backgroundColor:
                                err == null ? BreadLabColors.green : BreadLabColors.danger,
                          ),
                        );
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Ошибка импорта: $e')),
                        );
                      }
                    },
                    icon: const Icon(Icons.download),
                    label: const Text('Импорт JSON'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Методология расчётов',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 8),
              Text(
                'Пекарские проценты считаются от суммарной массы муки (100%). '
                'Гидратация учитывает hydrationFraction жидкостей и других вкладчиков. '
                'Прогноз веса буханки использует диапазон упёка рецепта и может быть '
                'скорректирован калибровкой. Объём подъёма — оценочный, с запасом headroomFactor. '
                'Это инженерные ориентиры, а не гарантированные физические результаты.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              const Text('Программы техники',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                'Panasonic: номера меню русской редакции SD-YR2540HTS, лимиты муки 350–600 г, '
                'дрожжей 1.4–11.2 г, диспенсер добавок до 150 г.\n'
                'REDMOND RMC-M92S: режимы BREAD / MULTI COOK, чаша ~5 л, переворот по рекомендации рецепта.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SoftCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('О приложении',
                  style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                'BreadLab ${app.catalog?.version ?? '1.0.0'} · Flutter · offline\n'
                'Рецептов: ${app.catalog?.recipes.length ?? 0} · '
                'Ингредиентов: ${app.catalog?.ingredients.length ?? 0}',
              ),
            ],
          ),
        ),
      ],
    );
  }
}

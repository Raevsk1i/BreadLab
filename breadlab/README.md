# BreadLab (Flutter)

Кроссплатформенное мобильное приложение BreadLab на Dart/Flutter: подбор и масштабирование рецептов хлеба для **Panasonic SD-YR2540HTS** и **REDMOND SkyCooker RMC-M92S**.

Исходная веб-версия для сверки: [`../bread_lab.html`](../bread_lab.html) (не используется в runtime приложения).

## Возможности

- 35 технологических карт (`p01`–`p35`) из локальной базы
- Панель «Что есть дома», поиск с нормализацией `ё/е`
- Подбор exact / near (≤2 недостающих), раздельно Panasonic / REDMOND
- Калькулятор: пекарские проценты, гидратация, масса теста, прогноз буханки/объёма, лимиты техники
- Добавки «по вкусу», список покупок, копирование рецепта
- Режим приготовления с таймерами и сохранением сессии
- Калибровка фактического веса
- Экспорт/импорт JSON в формате исходного BreadLab
- Полностью offline

## Структура

```
lib/           — приложение (domain / data / features)
assets/data/   — JSON база (экспорт из HTML)
tool/export_db.mjs — воспроизводимый экспорт данных
test/          — unit-тесты расчётов и состояния
docs/          — миграция, Android/MagicOS, HarmonyOS
android/       — Android APK
ohos/          — каркас HarmonyOS NEXT (SIG Flutter)
```

## Запуск

```bash
cd breadlab
flutter pub get
flutter run
```

Переэкспорт данных из HTML:

```bash
node tool/export_db.mjs ../bread_lab.html
```

Тесты и анализ:

```bash
flutter analyze
flutter test
```

## Сборки

- Android / MagicOS: [docs/ANDROID_MAGICOS_BUILD.md](docs/ANDROID_MAGICOS_BUILD.md)
- HarmonyOS NEXT: [docs/HARMONYOS_BUILD.md](docs/HARMONYOS_BUILD.md)
- Карта миграции: [docs/MIGRATION_MAP.md](docs/MIGRATION_MAP.md)
- Проверки: [docs/VERIFICATION.md](docs/VERIFICATION.md)

Для HAP требуется [OpenHarmony SIG Flutter](https://gitee.com/openharmony-sig/flutter_flutter) и DevEco Studio.

## Архитектура

- UI: Flutter Widgets + Material 3, тема BreadLab
- Состояние: `ChangeNotifier` (`AppState`) + репозитории
- Расчёты: чистый `BreadLabCalculationEngine` без UI
- Хранение: JSON-файл в documents directory (`AppStorage`)

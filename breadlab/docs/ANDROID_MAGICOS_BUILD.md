# Сборка BreadLab для Android и MagicOS

## Требования

- Flutter SDK (официальный stable **или** OpenHarmony SIG fork с поддержкой `android`)
- Android SDK (API 24+), JDK 17+
- Устройство/эмулятор Android, либо MagicOS с поддержкой установки Android APK

Проверка:

```bash
flutter --version
flutter doctor -v
```

## Сборка APK

```bash
cd breadlab
flutter pub get
flutter build apk --release
```

Артефакт сборки: `build/app/outputs/flutter-apk/app-release.apk`  
Релиз для установки: корневой файл репозитория **`BreadLab.apk`** (версия из `pubspec.yaml`, тег `0.0.2`).

Установка на Android / MagicOS / HarmonyOS (если устройство ставит Android APK):

1. Скопируйте `BreadLab.apk` на телефон.
2. Откройте файл и подтвердите установку.
3. Запустите приложение **BreadLab** с рабочего стола (LAUNCHER intent уже в манифесте).

Отладочная сборка:

```bash
flutter build apk --debug
flutter install
```

## MagicOS

MagicOS (Huawei), если устройство поддерживает установку Android-приложений, использует тот же APK. Отдельной MagicOS-сборки нет: это Android runtime.

Установка:

1. Разрешите установку из неизвестных источников (по политике устройства).
2. Скопируйте `app-release.apk` на устройство.
3. Установите APK стандартным установщиком.

## Подпись

Release APK подписывается ключом из `android/app` / Gradle signing config. Для публикации настройте собственный keystore в `android/key.properties` (не коммитьте секреты).

## Известные ограничения среды CI/Cloud

Если Android SDK не установлен, команда `flutter build apk` завершится ошибкой. Исходники и тесты при этом остаются валидными; установите SDK и повторите сборку.

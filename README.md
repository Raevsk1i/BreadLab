# BreadLab

Автономное русскоязычное приложение для подбора и масштабирования рецептов хлеба под **Panasonic SD-YR2540HTS** и **REDMOND SkyCooker RMC-M92S**.

## Установка (Android / MagicOS / HarmonyOS с Android APK)

Релиз **0.0.2**: скачайте [`BreadLab.apk`](BreadLab.apk), установите на устройство и запустите **BreadLab** с рабочего стола.

```bash
# пересборка
cd breadlab && flutter build apk --release
cp build/app/outputs/flutter-apk/app-release.apk ../BreadLab.apk
```

## Исходники Flutter

Каталог [`breadlab/`](breadlab/):

```bash
cd breadlab
flutter pub get
flutter run
flutter test
```

Документация сборок:

- [breadlab/docs/ANDROID_MAGICOS_BUILD.md](breadlab/docs/ANDROID_MAGICOS_BUILD.md)
- [breadlab/docs/HARMONYOS_BUILD.md](breadlab/docs/HARMONYOS_BUILD.md)
- [breadlab/docs/MIGRATION_MAP.md](breadlab/docs/MIGRATION_MAP.md)

## Legacy HTML (сверка)

Исходный однофайловый веб-клиент сохранён для аудита и экспорта данных:

1. Откройте `bread_lab.html` двойным кликом  
   или
2. Windows: `run.bat`  
3. Linux / macOS: `chmod +x run.sh && ./run.sh`

Сервер не нужен. Мобильный runtime **не** использует HTML/WebView.


```bash
cd breadlab && node tool/export_db.mjs ../bread_lab.html
```

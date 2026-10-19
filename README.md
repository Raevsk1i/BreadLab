# BreadLab

Автономное русскоязычное приложение для подбора и масштабирования рецептов хлеба под **Panasonic SD-YR2540HTS** и **REDMOND SkyCooker RMC-M92S**.

## Запуск (offline)

1. Откройте `bread_lab.html` двойным кликом  
   или
2. Windows: `run.bat`  
3. Linux / macOS: `chmod +x run.sh && ./run.sh`

Сервер, npm и интернет **не нужны**. Весь CSS, JavaScript и база рецептов встроены в один HTML-файл.

На Linux Chrome иногда пишет в терминал `zygote … Broken pipe`, если браузер уже открыт: это шум вспомогательного процесса, вкладка при этом открывается. `run.sh` запускает браузер отдельно и эти строки не показывает. Если вкладки нет — откройте `bread_lab.html` двойным щелчком.

## Возможности

- 35 технологических карт из сборника для REDMOND RMC-M92S и Panasonic SD-YR2540HTS
- Панель «Что есть дома» и локальный поиск рецептов
- Раздельная выдача для Panasonic и REDMOND (номера меню русской редакции)
- Масштабирование по пекарским процентам (слайдер муки 300–600 г)
- KPI: гидратация, масса теста, пиковый объём, вес буханки, лимиты техники
- «Добавить по вкусу», Cook Mode с таймерами, калибровка, экспорт/импорт JSON

## Android и HarmonyOS

Готовые пакеты лежат в `dist/`:

- `BreadLab-android.apk` — Android 8.0 и новее (`dev.breadlab.app`)
- `BreadLab-harmony.apk` — HarmonyOS 2, 3 и 4, где ставятся Android APK (`dev.breadlab.harmony`)

Оба файла — это BreadLab в системном WebView: сервер и интернет не используются, рецепты и сохранения остаются на устройстве. Экспорт открывает системный диалог «Сохранить как», импорт — выбор JSON-файла. Кнопка «Назад» закрывает Cook Mode, а со стартового экрана выходит из приложения.

HarmonyOS NEXT (пакеты HAP) эти APK не устанавливает: там нет Android-слоя. Файл `BreadLab-harmony.apk` рассчитан на HarmonyOS с совместимостью Android-приложений.

Пересборка (нужны JDK 17+ и Android SDK, `compileSdk` 34):

```bash
cd android
./gradlew :app:assembleRelease
```

Скрипт кладёт оба APK в `dist/`. Подпись релиза: `android/keystore/breadlab-release.jks`, пароли — в `android/keystore.properties`.

## Отладка

Откройте `bread_lab.html?debug=1` — внизу страницы появятся встроенные self-tests.

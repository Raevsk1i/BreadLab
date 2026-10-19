# BreadLab — фактически выполненные проверки

Дата прогона: 2026-10-18 (Cloud Agent среда).

## Данные

| Проверка | Результат |
|----------|-----------|
| `node tool/export_db.mjs` | OK: 35 recipes, 54 ingredients |
| Ids `p01`–`p35` | OK |
| Enrichment (`unit`, `scalable`, effects) | OK на p01 |
| Panasonic breadFlour `[350,600]`, dispenser `150` | OK |
| REDMOND `bowlVolumeMl: 5000` | OK |

## Автотесты

```bash
cd breadlab && flutter analyze && flutter test
```

| Команда | Результат |
|---------|-----------|
| `flutter analyze` | No issues found |
| `flutter test` | **21 passed** |

Покрыто (порт `runSelfTests`):

- 35 рецептов, 54 ингредиента
- scale 600/400, вода p01 = 390 г
- гидратация p01@400 ≈ 65%
- сохранение соотношения муки p15
- масса буханки < массы теста
- границы Panasonic 349/350/600/601
- dispenser >150 danger
- alias «хлебопекарная мука»
- match near/exact
- addins изоляция
- export/import payload, неизвестные ids, cookSession `running: false`, pruneChecklist
- `fillStepText` плейсхолдеры

## Сборки

| Цель | Результат |
|------|-----------|
| Android APK release **0.0.2** | **Успешно**: корневой [`BreadLab.apk`](../../BreadLab.apk) (~52 MB), `versionName=0.0.2`, LAUNCHER activity. Для Android и HarmonyOS/MagicOS с поддержкой Android APK. |
| HarmonyOS HAP | **Не собирался**: нет OpenHarmony SIG Flutter, DevEco Studio, OHOS SDK в среде. Каркас `ohos/` + инструкция `HARMONYOS_BUILD.md` |
| Impeller | **Не подтверждён** для OHOS Engine в этой среде |

Flutter в среде: официальный **stable 3.47.7** (не SIG fork). Для HAP нужен SIG.

## Ручные сценарии

Запуск `flutter run -d linux` в среде агента (DISPLAY=:1):

- Главная: бренд BreadLab, техника Panasonic/REDMOND, badge «Автономно»
- Каталог: «Все 35 технологических карт», фильтры, карточки p01+
- Калькулятор: «Экспресс-батон», слайдер муки, KPI гидратация/тесто/буханка/объём/диспенсер, таблица ингредиентов с пекарскими %

Скриншоты: `/opt/cursor/artifacts/screenshots/01-home.png`, `02-catalog.png`, `03-calculator.png`.

На Linux desktop лог показал Impeller OpenGLES — это **не** подтверждение Impeller на HarmonyOS NEXT.

## Блокеры платформ

1. **HAP**: установить [OpenHarmony SIG Flutter](https://gitee.com/openharmony-sig/flutter_flutter), DevEco, OHOS SDK, подпись → `flutter build hap --release` или DevEco Build.
2. **MagicOS**: тот же APK при поддержке Android-приложений на устройстве.
3. Плагины `path_provider` / `file_picker` / `share_plus` на OHOS — проверить совместимость SIG; есть fallback буфера обмена и MethodChannel `com.breadlab/storage`.

# HarmonyOS NEXT / OpenHarmony — сборка HAP

BreadLab для HarmonyOS NEXT должен собираться через **OpenHarmony SIG Flutter**, а не через стандартный Google Flutter stable.

Репозиторий SDK: https://gitee.com/openharmony-sig/flutter_flutter

## Важно

- Поддержка `ohos` в SIG Flutter **не равна** гарантированному запуску на любой версии HarmonyOS NEXT.
- Не используйте WebView/Android-контейнер как замену OHOS Engine.
- **Impeller / Vulkan:** не утверждайте включение Impeller, пока конкретная версия OHOS Flutter Engine и устройство это не подтверждают (`flutter doctor -v`, логи рендерера).

## Требования

1. OpenHarmony SIG Flutter SDK (форк с платформой `ohos`)
2. OpenHarmony / HarmonyOS SDK
3. DevEco Studio (актуальная версия под целевой API)
4. Совместимый JDK (обычно 17; уточняйте по документации SIG)
5. Настроенная подпись HAP (DevEco signing configs)

## Создание / привязка платформы ohos

Если проект создан на SIG Flutter:

```bash
flutter create --platforms android,ohos .
# или
flutter create --platforms ohos .
```

В данном репозитории каталог `ohos/` содержит минимальный каркас entry-модуля. На SIG SDK выполните синхронизацию/`flutter pub get` и донастройку в DevEco Studio.

## Проверка окружения

```bash
flutter --version
flutter doctor -v
# убедитесь, что doctor видит ohos toolchain, а не только Android
```

## Сборка HAP

Команда зависит от версии SIG:

```bash
flutter build hap --release
```

Если команда недоступна в вашей ревизии форка — соберите через DevEco Studio (открыть `ohos/`, Build Hap).

## Bundle / приложение

- Отображаемое имя: **BreadLab**
- Рекомендуемый bundle name: `com.breadlab.app`
- Entry module: `entry`

Настройте `AppScope` / `module.json5` / иконку в DevEco.

## Плагины

Используются:

- `path_provider` — на OHOS может потребоваться SIG-совместимый вариант или platform channel
- `file_picker` / `share_plus` — при несовместимости используйте экспорт через буфер обмена (реализован fallback) или OHOS file APIs через MethodChannel `com.breadlab/storage`

Доменная логика (расчёты, каталог, матчинг) — чистый Dart и не зависит от плагинов.

## Подпись и установка

1. Создайте signing config в DevEco Studio.
2. Соберите signed HAP.
3. Установите на устройство HarmonyOS NEXT через DevEco / `hdc`.

## Статус в Cloud Agent среде

На момент миграции в среде агента установлен **официальный Flutter stable** без OHOS toolchain и без DevEco. HAP **не собирался** здесь. После установки SIG Flutter + DevEco выполните шаги выше и зафиксируйте результат в `docs/VERIFICATION.md`.

# BreadLab

Автономное русскоязычное приложение для подбора и масштабирования рецептов хлеба под **Panasonic SD-YR2540HTS** и **REDMOND SkyCooker RMC-M92S**.

Настольная версия — **Rust + TypeScript + Tauri 2**. Справочники лежат в `src-tauri/data`, расчёты выполняет Rust, интерфейс повторяет `bread_lab.html`. Интернет и отдельный сервер не нужны: окно использует системный WebView (WebView2 на Windows, WebKitGTK на Linux).

## Настольное приложение

```bash
npm install
npm run tauri dev
npm run tauri build
cargo test --manifest-path src-tauri/Cargo.toml
```

Дополнительно:

```bash
npm test                 # Vitest: состояние, таймер, секции интерфейса
npm run build            # строгий tsc и production-сборка Vite
npm run extract-catalog  # заново снять JSON и golden-фикстуры из bread_lab.html
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

`npm run extract-catalog` нужен только если меняется исходный HTML. В релизном приложении HTML не исполняется.

Состояние пишется в каталог данных приложения: `BreadLab/state.json` и `state.backup.json` (атомарная запись, восстановление из копии). Импорт принимает прежний экспорт BreadLab (`app: "BreadLab"` или знакомые поля `pantry`, `favorites`, `calibrations`, `recent`, `enabledTasteAddins`, `checklist`). Печать рецепта — кнопка «Печать» и системный диалог (`window.print()`), стили печати те же, что в HTML.

### Системные зависимости

Linux (Debian/Ubuntu):

```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev
```

Windows 10/11: [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) (на актуальных Windows 11 он уже есть), Rust stable и Node.js. Сборка на Windows создаёт NSIS и MSI — цели указаны в `src-tauri/tauri.conf.json`. Эта среда Linux, поэтому установщики Windows здесь не собирались.

### Размер и память

Цели 10–15 МБ и 30–50 МБ RAM — ориентир, не гарантия Tauri: окно рисует системный WebView.

Сборка Linux (x86_64, Rust 1.99, Tauri 2.12, `opt-level = "z"`, LTO, strip), WebKitGTK 4.1 подключён динамически, отдельного Chromium нет:

| Артефакт | Размер |
|---|---|
| `src-tauri/target/release/breadlab` | 4,6 МБ (4 820 336 байт) |
| DEB `BreadLab_1.0.0_amd64.deb` | 1,8 МБ (1 910 212 байт, WebKit берётся из системы) |
| AppImage | 77 МБ (80 771 576 байт; linuxdeploy упаковывает GTK/WebKit) |

Память на этой ВМ измерялась без GPU (в логе `libEGL … DRI3 error`, программный рендер WebKit). Сумма RSS процесса и дочерних WebKit:

- сразу после появления окна: около 606 МиБ (основной процесс ~163 МиБ, WebKitWebProcess ~395 МиБ, WebKitNetworkProcess ~48 МиБ);
- открытый рецепт с таблицей и добавками: около 706 МиБ;
- режим готовки ещё открыт: около 728 МиБ.

Окно на прогретом кэше страниц появилось примерно за 0,1 с. Холодный старт с диска и простой 30 минут в этой сессии не измерялись. Диапазон 30–50 МБ на этой конфигурации недостижим: один процесс WebKitGTK уже больше, а программный рендер раздувает его ещё сильнее. На обычном рабочем столе с видеоускорением WebKit обычно легче, но всё равно это не 30–50 МБ.

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

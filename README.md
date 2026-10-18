# BreadLab (Tauri 2)

Автономное русскоязычное desktop-приложение для подбора и масштабирования рецептов хлеба под **Panasonic SD-YR2540HTS** и **REDMOND SkyCooker RMC-M92S**.

Стек: **Rust + TypeScript + Vite + Tauri 2**. Оригинальный однофайловый эталон сохранён как [`bread_lab.html`](bread_lab.html) (не удалять).

## Быстрый старт

```bash
npm install
npm run extract-data          # нормализованные JSON из bread_lab.html
npm run generate-goldens      # эталоны расчётов для Rust-тестов
npm run tauri dev             # разработка
npm run tauri build           # production-сборка / установщики
cargo test --manifest-path src-tauri/Cargo.toml
npm test                      # Vitest (таймеры, debounce, import guard)
```

## Системные зависимости

### Linux

- Rust stable (рекомендуется ≥ 1.90)
- Node.js 20+
- WebKitGTK 4.1 и GTK 3:

```bash
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libgtk-3-dev pkg-config
```

Целевые пакеты: AppImage и/или DEB (см. `src-tauri/tauri.conf.json`).

### Windows 10/11

- Rust stable, Node.js 20+, Visual Studio C++ Build Tools
- WebView2 Runtime (обычно уже установлен на Windows 11)
- Сборка: NSIS и/или MSI

На Linux-агенте Windows-установщики не собираются.

## Архитектура

| Слой | Ответственность |
|---|---|
| Rust (`src-tauri`) | каталоги данных, расчёты, поиск, валидация машин, persist, import/export, IPC |
| TypeScript (`src`) | UI, локальное состояние отображения, таймеры Cook Mode, debounce IPC |
| Tauri 2 | WebView + безопасный `invoke` |

Хранилище пользователя: `app_data_dir/BreadLab/state.json` (+ `state.backup.json`).  
Экспорт JSON совместим с оригинальным форматом `app: "BreadLab"`.

## Скрипты данных

- `npm run extract-data` — одноразовый/CI разбор DataDB из HTML через Node `vm` (не используется в production runtime).
- `npm run generate-goldens` — сравнение ядра JS с Rust golden tests.

## Проверки

```bash
npm run build
npm test
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run tauri build
```

Фактические размеры и RAM: [`docs/METRICS.md`](docs/METRICS.md).

## Запуск старого HTML (эталон)

Оригинал по-прежнему можно открыть через `run.sh` / `run.bat` / двойной клик по `bread_lab.html`.

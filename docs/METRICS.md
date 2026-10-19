# BreadLab — метрики сборки и памяти

Измерения: Cloud Agent, Linux x86_64, 2026-10-18.  
Цели ТЗ (10–15 МБ дистрибутив, 30–50 МБ RAM) — ориентиры; системный WebKitGTK/WebView2 доминирует в footprint.

## Frontend production (Vite)

`npm run build`

| Артефакт | Размер |
|---|---|
| `dist/index.html` | 18.25 KB |
| CSS bundle | 16.97 KB |
| JS bundle | 33.31 KB |

Справочные JSON вшиты в Rust (`include_str!`).

## Rust / Tauri checks

| Проверка | Результат |
|---|---|
| `cargo test` | 17 passed |
| `cargo clippy -D warnings` | ok |
| `npm run build` / `tsc` | ok |
| `npm test` (Vitest) | 6 passed |
| `npm run tauri build` (Linux) | AppImage + DEB ok |

## Release sizes (Linux)

| Артефакт | Размер |
|---|---|
| `target/release/breadlab` | **4.6 MiB** |
| `BreadLab_1.0.0_amd64.deb` | **1.8 MiB** |
| `BreadLab_1.0.0_amd64.AppImage` | **78 MiB** |

AppImage существенно выше цели 10–15 МБ из‑за упаковки helper/runtime слоёв linuxdeploy; компактный `.deb` ближе к целевому диапазону для систем с установленным WebKitGTK.

Windows NSIS/MSI в этой среде **не собирались**.

## RAM (xvfb, cold start ~5 s, idle)

| Процесс | RSS |
|---|---|
| `breadlab` | ~171 MiB |
| `WebKitNetworkProcess` | ~48 MiB |
| `WebKitWebProcess` | ~438 MiB |
| **Сумма (оценка)** | **~657 MiB** |

Цель 30–50 МБ **не достигнута**: основной вклад даёт WebKitGTK WebProcess, а не прикладной код BreadLab.  
Не измерено в этой среде: каталог/cook-mode дельты, 30‑минутный idle, cold-start latency с UI automation.

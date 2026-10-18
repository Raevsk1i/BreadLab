# BreadLab — метрики сборки и памяти

Значения ниже — фактические измерения в среде Cloud Agent (Linux), если не указано иное.  
Цели ТЗ (10–15 МБ дистрибутив, 30–50 МБ RAM) являются ориентирами Tauri+WebView; WebKitGTK/WebView2 добавляют собственный footprint.

## Frontend production (Vite)

Измерено: `npm run build` (2026-10-18)

| Артефакт | Размер |
|---|---|
| `dist/index.html` | ~18 KB |
| CSS bundle | ~17 KB |
| JS bundle | ~33 KB |

Справочные JSON рецептов вшиты в Rust binary (`include_str!`), не в JS-бандл.

## Rust / Tauri

| Проверка | Статус |
|---|---|
| `cargo test` | 17 passed |
| `cargo clippy -D warnings` | ok |
| `npm run build` / `tsc` | ok |
| `npm test` (Vitest) | 6 passed |
| `npm run tauri build` | см. ниже |

### Release binary / installer

Заполняется после `npm run tauri build` на доступной ОС.

| Платформа | Артефакт | Размер | Примечание |
|---|---|---|---|
| Linux | AppImage / DEB / binary | _измерить после сборки_ | требует WebKitGTK |
| Windows | NSIS / MSI | _не собрано в Linux CI_ | собирать на Windows |

## RAM / startup

| Сценарий | Значение | Примечание |
|---|---|---|
| Idle | _измерить при `tauri dev`/`tauri build` run_ | учитывать процесс WebKitGTK |
| Каталог открыт | _измерить_ | |
| Cook Mode | _измерить_ | |
| После open/close Cook ×N | _измерить_ | |
| Cold start | _измерить_ | |
| 30 мин idle delta | _не измерено в этой среде_ | |

Если целевые 30–50 МБ недостжимы, причина обычно в системном WebView, а не в объёме прикладного кода BreadLab.

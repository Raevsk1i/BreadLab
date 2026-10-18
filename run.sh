#!/usr/bin/env bash
# Opens bread_lab.html in the default browser (offline, no server).
#
# Chrome/Chromium on Linux prints "Opening in existing browser session"
# and then a zygote "Broken pipe" when a second process only hands the
# URL to an already running window. That helper exits immediately; the
# tab still opens. We start the browser in its own session and drop
# that noise so the terminal stays clean.

set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="${DIR}/bread_lab.html"
URL="file://${FILE}"

if [[ ! -f "$FILE" ]]; then
  echo "Не найден файл: ${FILE}" >&2
  exit 1
fi

launch_detached() {
  # New session, stdin closed, stdout/stderr discarded.
  if command -v setsid >/dev/null 2>&1; then
    setsid "$@" >/dev/null 2>&1 </dev/null &
  else
    "$@" >/dev/null 2>&1 </dev/null &
  fi
  disown >/dev/null 2>&1 || true
}

BROWSER=""
for cmd in google-chrome google-chrome-stable chromium chromium-browser firefox firefox-esr; do
  if command -v "$cmd" >/dev/null 2>&1; then
    BROWSER="$cmd"
    break
  fi
done

if [[ -n "$BROWSER" ]]; then
  # A URL argument opens a new tab in a running browser, or starts one.
  launch_detached "$BROWSER" "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  launch_detached xdg-open "$URL"
elif command -v open >/dev/null 2>&1; then
  open "$URL" >/dev/null 2>&1 || open "$FILE"
else
  echo "Браузер не найден. Откройте файл вручную:" >&2
  echo "  ${FILE}" >&2
  exit 1
fi

echo "BreadLab открыт в браузере."
echo "Если вкладка не появилась, откройте файл напрямую: ${FILE}"
exit 0

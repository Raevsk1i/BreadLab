#!/usr/bin/env bash
URL="file://$(pwd)/bread_lab.html"
if command -v xdg-open > /dev/null; then xdg-open "$URL"; elif command -v open > /dev/null; then open "$URL"; fi

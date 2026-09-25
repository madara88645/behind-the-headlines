#!/bin/bash
# qa_shot.sh - headless-Chrome smoke test for a game page.
# Usage: tools/qa_shot.sh vox-pop.html out.png [width] [height] [hash]
#   Saves a screenshot and prints any console errors/warnings the page logged.
#   Optional [hash] is appended to the URL (e.g. "#screen=start") so a page can jump to a state.
#   Headless Chrome will not lay out narrower than 500px, so for phone widths (<500) the page is
#   rendered inside an iframe of exactly [width] px and the screenshot is cropped to that width.
set -u
PAGE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="$2"; W="${3:-1280}"; H="${4:-800}"; HASH="${5:-}"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROF="$(mktemp -d)"
LOG="$(mktemp)"
URL="file://$PAGE$HASH"
WIN_W="$W"
if [ "$W" -lt 500 ]; then
  WRAP="$PROF/wrap.html"
  printf '<!doctype html><html><body style="margin:0;background:#888"><iframe src="%s" style="display:block;margin:0 auto;width:%spx;height:%spx;border:0;background:#fff"></iframe></body></html>' "$URL" "$W" "$H" > "$WRAP"
  URL="file://$WRAP"
  WIN_W=500
fi
"$CH" --headless=new --disable-gpu --no-first-run --hide-scrollbars \
  --user-data-dir="$PROF" --enable-logging=stderr --v=0 --allow-file-access-from-files \
  --virtual-time-budget=6000 --window-size="$WIN_W,$H" \
  --screenshot="$OUT" "$URL" >"$LOG" 2>&1 &
PID=$!
for _ in $(seq 1 30); do sleep 1; kill -0 $PID 2>/dev/null || break; done
kill $PID 2>/dev/null
if [ "$W" -lt 500 ] && [ -f "$OUT" ]; then
  sips --cropToHeightWidth "$H" "$W" "$OUT" >/dev/null 2>&1
fi
echo "screenshot: $OUT (${W}x${H})"
grep -E "CONSOLE|Uncaught|SyntaxError|TypeError|ReferenceError" "$LOG" | sed 's/^.*CONSOLE/CONSOLE/' | head -40
rm -rf "$PROF" "$LOG"

#!/bin/bash
# capture-screens.sh - refresh the real game screenshots shown in the "What we made" scene.
# Uses the project's own read-only QA tool (tools/qa_shot.sh, headless Chrome) and the games'
# debug hashes (#screen=...). Run from video/:  bash scripts/capture-screens.sh
# If a PNG is missing, the video falls back to a drawn tile for that game.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$(cd .. && pwd)"
OUT="public/screens"
mkdir -p "$OUT"
shot() { # <page> <out> <hash>
  bash "$ROOT/tools/qa_shot.sh" "$ROOT/$1" "$PWD/$OUT/$2" 1440 900 "$3"
}
shot bubble-sort.html bubble-sort.png "#screen=selected"
shot 5km.html 5km.png "#screen=zoom"
shot rigged.html rigged.png "#screen=wheel-debrief"
ls -la "$OUT"

# Behind the Headlines

Four browser games built on the Maynooth University survey *Social Acceptance of Sustainable Data Centres in Ireland* (200 people, 104 questions) for the BU Induction Hack 2026: "Data centres: behind the headlines - make data playable."

The idea running through all of them: **data ≠ opinion ≠ assumption.**

| Game | What you do | Survey part it uses |
|---|---|---|
| **Bubble Sort** | Sort 12 claims into Data / Opinion / Assumption bubbles and bet on how sure you are. Then see what the survey believed, what's actually true, and whose information bubble you're in. | True/false beliefs (q18-q25), opinion statements, information sources (q16), self-rated knowledge (q17) |
| **5 KM** | Zoom from Ireland to your own street while support drops from 56% to 30%. Then try to win over a town hall of 100 residents with a limited planning budget. | Overall attitude (q96), acceptance within 5 km (q77), area type (q4), living near one (q7), the ten conditions (q78-q88) |
| **Rigged** | Three psychology experiments, all rigged (anchoring wheel, alarming feed, fake crowd), each debriefed straight away. Your behaviour is set next to what respondents said about themselves. | Cognitive-bias statements (q55-q65), acceptance (q77), gut feeling (q66) |
| **Vox Pop** | Walk around a made-up Irish town next to a data-centre campus (isometric, keyboard or click). Interview made-up residents whose answers are drawn from the survey, read sourced facts at the campus, and file a headline number. Then meet the real 200 and see how far a small sample drifts. | Area type (q4) as the town's districts; unease near home (q67) or acceptance within 5 km (q77); AI-tool and streaming use (q11, q8); view change (q97), investment (q99), benefits vs costs (q104) |

## Run it
Open `index.html` in any modern browser - double-click works, no install or server needed. Each game can also be opened directly: `bubble-sort.html`, `5km.html`, `rigged.html`, `vox-pop.html`. Fonts come from Google Fonts; offline, the games fall back to system fonts.

**Vox Pop sound is on hold** (team decision, 24 Sep). It is built but not loaded: `games/vox-pop/audio.js` (the engine), `music.js` ("Etirwer" by Kistol, CC0 1.0 - https://opengameart.org/content/etirwer) and `voices.js` (character voices generated with Kokoro-82M by hexgrad, Apache-2.0, via `tools/make_vox_pop_voices.py`). To try it again, add `<script src="games/vox-pop/music.js"></script>` and `<script src="games/vox-pop/audio.js"></script>` (plus `voices.js` for the voices) before the game's other scripts in `vox-pop.html`; the game then shows a *Sound* button. Two answer lines were reworded since the voices were made, so run the generator again before using them.

Optional local server (for testing on a phone on the same Wi-Fi):
```bash
python3 -m http.server 8765 --directory .
```

## Folder layout
```
index.html              launcher page
bubble-sort.html        game pages - kept in the project root on purpose (see note below)
5km.html
rigged.html
vox-pop.html
games/<game>/           each game's style.css, game.js (+ helpers)
data/survey_stats.js    aggregated survey results (generated - do not edit by hand)
data/facts.js           checked facts, true/false answer key, policies, paraphrased news claims - every item has a source URL
shared/survey.js        small helper the games use to read the survey (pct, agree, within, crosstab)
tools/extract_survey.py rebuilds data/survey_stats.* from the original .xlsx
tools/qa_shot.sh        headless-Chrome screenshot + console-error check (supports #screen=<name>)
docs/                   game specs and build rules
video/                  optional Remotion video project (see video/README.md)
```

**Why the game pages sit in the root:** Safari only lets a page opened from disk (file://) load files from its own folder and the folders below it. The games need `data/` and `shared/`, so their pages live next to those folders. Don't move them into `games/`.

## Data and privacy
- `tools/extract_survey.py` reads the survey spreadsheet and writes **only aggregate counts**: per-answer totals and cross-tabulations. No individual response is copied. The timestamp column is dropped, and cross-tab cells with fewer than 3 people are hidden.
- Rebuild the data (Python 3, no packages needed):
  ```bash
  python3 tools/extract_survey.py "path/to/Social Acceptance of Sustainable Data Centres in Ireland (Responses).xlsx"
  ```
- The games never hard-code survey numbers - every percentage is computed from `data/survey_stats.js` when the page loads.
- Groups under 30 people are flagged as "small group" wherever they appear. Multi-select questions are never drawn as parts of a whole. The trust questions (q89-q94) are not used, because the export doesn't say which end of the scale is "most trusted".

## Debug screens
Every game can jump straight to a screen with sample answers for screenshots, e.g. `5km.html#screen=hall` or `rigged.html#screen=finale`. The full list is at the top of each game's `game.js`.

## Working together
- `main` always holds a version that works. Don't push to it directly.
- For each change: make a branch (`git switch -c fix-bubble-label`), commit, push, and open a pull request. Someone else opens the game once before merging.
- Before opening a PR, open the game you changed in **Safari and Chrome** and play it to the end screen.
- The raw survey spreadsheet (`.xlsx`) is ignored by git on purpose - only the aggregated `data/` files are shared.
- Open tasks live in the repo's Issues tab.
- Building with an AI assistant? It should follow `AGENTS.md` (Claude Code reads it through `CLAUDE.md`; Codex, Cursor, Copilot and Gemini read `AGENTS.md` directly).

## Main sources
CSO (data-centre electricity 2015-2025) · SEAI (renewable share) · EirGrid (wind dispatch-down 2024) · CRU (connection policy, Dec 2025) · KPMG for the Department of Enterprise (economic value, 2026) · Uisce Éireann via TheJournal.ie (water) · IEA (Energy and AI). Every game lists the exact sources it shows on its end screen.

# Behind the Headlines: submission video (Remotion)

The hackathon submission video, made in code with [Remotion](https://www.remotion.dev) (React → MP4).

- **Output:** `out/behind-the-headlines.mp4`: 1920×1080, 30 fps, H.264 (yuv420p, BT.709) + AAC, **2:34** (4,634 frames), about 25 MB
- **Posters:** `out/stills/*.png` (five full-resolution frames)
- **Every survey figure and fact on screen is computed from `../data/`**. Nothing is typed in by hand (see *Data honesty* below).

## Quick start

```bash
cd video
npm install            # only once; installs Remotion 4.0.527 locally (nothing global)
npm run dev            # opens Remotion Studio (preview, scrub, edit props)
npm run render         # renders out/behind-the-headlines.mp4  (about 1-2 min on an M-series Mac)
npm run stills         # renders the poster frames to out/stills/
npm run render:draft   # fast half-resolution check: out/draft.mp4
```

Each of these runs `npm run data` first, which rebuilds `src/data/generated.ts` from the data files.
Fonts come from Google Fonts at render time, so you need an internet connection when you render.

## Structure (timeline)

| Time | Scene | What it shows |
|---|---|---|
| 0:00 | 00 Cold open | CSO line draws itself 2015 → 2025 while the counter steps 5% → 23%; reference lines for all homes (28%) and urban homes (18%) |
| 0:12 | Thesis | The 23% flies into the launcher's equation: **Data ≠ Opinion ≠ Assumption** (23% CSO / 56% q96 / 52% q18, false) |
| 0:23 | Title | "Behind the headlines" + the three game emblems |
| 0:25 | 01 The data | 200 dots = 200 respondents, a 104-bar "barcode" = 104 questions, official sources, the honesty rules |
| 0:40 | 02 What we made | Real screenshots of the three games in browser frames, then a push into Bubble Sort |
| 0:47 | 03 Bubble Sort | Card → confidence bet → drop into the ASSUMPTION soap bubble (gulp) → reveal: FALSE + SEAI fact + the survey split for q18 |
| 1:00 | 04 5 KM | Yellow planning notice; zoom Ireland → county → town → street while the meter falls 56% → 30%; "THE 5 KM GAP" stamp |
| 1:10 | 5 KM town hall | 100 residents (q77 scaled to 100), a sample package, the vote (the game's simplified model) |
| 1:18 | 05 Rigged | Protocol sheet, rigged wheel lands on 72, estimate; sheet flips to the red-pen researcher's copy; RIGGED stamp; the feed and the crowd |
| 1:34 | 06 What we discovered | Five findings, each with its caveat and source (see below) |
| 2:10 | 07 What worked / what didn't | Editable draft text (props) |
| 2:25 | 08 End card | Title, equation, team line, sources |

Scene durations live next to each scene (`*_DURATION` exports in `src/scenes/`). Transitions are in `src/Video.tsx`.
The total length is calculated automatically.

## Change the editable texts (team name, what worked / what didn't)

**Option A, in Studio:** `npm run dev` → select **BehindTheHeadlines** → the **Props** panel on the right → edit → **Save**.
**Option B, in code:** edit the `defaultProps` object in `src/Root.tsx`.

| Prop | What it is | Draft value |
|---|---|---|
| `teamName` | Big line on the end card | "Made at the BU Induction Hack 2026" (**put your team name here**) |
| `teamMembers` | Names on the end card (hidden when empty) | `[]` (**add your names**) |
| `eventLine` | Small orange line under the team name | "Data centres: behind the headlines · Make data playable" |
| `playLine` | Last sentence of the end card blurb | "Open index.html in any browser - no install." |
| `worked` | "What worked" (max 4 short lines) | 3 draft lines, honest but written by the video agent. **Please check them.** |
| `didnt` | "What didn't (yet)" (max 4 short lines) | 3 draft lines. **Please check them.** |
| `sound` | Synthesised sound effects on/off | `true` |
| `footage` | `"auto"` = use real recordings if present, `"off"` = always the recreations | `"auto"` |
| `footageStartAt` | Seconds to skip at the start of each recording | `0 / 0 / 0` |

Keep each line under about 60 characters so it stays on two lines.

## Drop in real gameplay footage

The game scenes are motion-graphics **recreations** of each game's signature moment, so the video works on its own.
To show the real thing instead, put screen recordings here, with exactly these names:

```
video/public/footage/bubble-sort.mp4   (the scene is 14.0 s long)
video/public/footage/5km.mp4           (the scene is 18.7 s long)
video/public/footage/rigged.mp4        (the scene is 17.3 s long)
```

- Record the browser window (macOS: `Cmd+Shift+5` → *Record Selected Portion*), 16:10 or 16:9, at least as long as the scene.
  A shorter clip loops. Export or convert to H.264 MP4 (`ffmpeg -i in.mov -c:v libx264 -crf 18 -pix_fmt yuv420p bubble-sort.mp4`).
- The clip is shown muted, in a browser frame, next to the scene's title and "what you do" steps.
  Use `footageStartAt` to skip the first seconds.
- Remove the file (or set `footage: "off"`) to go back to the recreation. Nothing else needs changing.
- Components: `src/components/Footage.tsx` (`hasFootage()` uses `getStaticFiles()`, and the clip plays through `<Video>` from `@remotion/media`).

**Real screenshots** in scene 02 come from `public/screens/{bubble-sort,5km,rigged}.png`, captured read-only with the project's
own `tools/qa_shot.sh` and the games' `#screen=` debug states. To refresh them after the games change: `bash scripts/capture-screens.sh`.
If a PNG is missing, that tile falls back to a drawn illustration.

## Sound

- `public/sfx/*.wav` are **synthesised from maths** by `scripts/make-sfx.sh` (ffmpeg `aevalsrc`/`anoisesrc`): thump, pop, tick,
  whoosh, paper flick, wheel ratchet. No samples, no music, nothing downloaded, so there is no licence issue. Regenerate with `bash scripts/make-sfx.sh`.
- **Optional soundtrack or voice-over slot:** drop `public/audio/soundtrack.mp3` (or `.wav`/`.m4a`) and it plays under the whole video.
  Only use audio you made or have a licence for.
- Set `sound: false` for a silent render.

## Data honesty

`scripts/build-data.mjs` loads `../data/survey_stats.json`, `../data/facts.js` and the games' own helper `../shared/survey.js` (in a
Node sandbox, so the semantics are the same as in the games) and writes `src/data/generated.ts`. It prints an audit table when it runs.
Rules we followed:

- The survey is always described as "200 people in Ireland (Maynooth University survey)", never "Ireland thinks". Percentages are of
  the people who answered that question, and the "answered" counts are shown.
- Every fact has a source line on screen. Cross-tab groups under 30 people carry a visible "small group" tag (n = 20 and n = 28).
- Multi-select q88 is never drawn as parts of a whole, and its caveat is on screen. q89-q94 are not used.
- Things that are **not data** are labelled: sample play (anchor 72, estimate 38%, guess 45%, the sample package), game design
  constants (12 cards, 1-3 point bets, 6 planning points, wheel ranges 6-12 / 65-85, 6 of 8 alarming posts, fake 80% crowd) and the
  town-hall **model** (the game's own simplified formula, labelled "not a prediction").

### Every number on screen and where it comes from

| Number | Source |
|---|---|
| 5, 6, 7, 8, 9, 11, 14, 18, 21, 22, 23 % (2015-2025) | `facts.js` `csoSeries`: CSO, *Data Centres Metered Electricity Consumption 2025* |
| 28% all homes, 18% urban homes (2025) | `facts.js` `csoSeries.compare2025` (CSO) |
| 200 respondents, 104 questions | `survey_stats.json` `meta.respondents`, number of questions |
| 56% support sustainable data centres (198 answered) | q96, "Somewhat" + "Strongly supportive" |
| 30% would accept one within 5 km (195 answered) | q77, value ≥ 4 ("Somewhat" + "Completely acceptable") |
| 38% of the strongly supportive would accept one within 5 km (n = 47) | cross-tab q96 × q77 |
| 52% true / 29% false / 20% don't know (195 answered) | q18 "All data centres in Ireland run on fossil fuels" |
| "about 41% … renewable in 2024", "RES-E 41.3% in 2024" | `facts.js` `trueFalse.q18` (SEAI) |
| 46% (n 28), 51% (n 51), 40% (n 58), 57% (n 37), 90% (n 20) | cross-tab q17 × q18 "True" |
| 17 / 19 / 34 / 21 / 9 residents | q77 scaled to 100 (largest-remainder rounding, as in the 5 KM game) |
| 54%, 41%, 25% top-three picks (waste heat, local jobs, monitoring) | q88 (195 answered, pick three) |
| 64 / 100 accept (30 + 27 + 7) | the 5 KM game's model applied to the sample package (MODEL, not a prediction) |
| Rated 36-50% vs picked 7-54%; bills 50% → 13%; renewables 36% → 49% | q78-q87 (value ≥ 4) vs q88; the two biggest rank mismatches are computed |
| 25 / 22 / 53 % (190), 37 / 15 / 48 % (186), 28 / 23 / 49 % (189) | q62, q55, q61 agree / neither / disagree |
| 29% (n 111) vs 39% (n 56) | cross-tab q7 × q77 |
| 23% truth in Rigged | CSO 2025 (as above) |
| Facts checked 2026-09-22 | `facts.js` `checked` |

**Sources shown:** Maynooth University survey *Social Acceptance of Sustainable Data Centres in Ireland* (200 respondents);
CSO; SEAI; EirGrid; CRU; IEA; Uisce Éireann (via TheJournal.ie); Pronin, Lin & Ross (2002) for the term "bias blind spot".

## Files

```
video/
  remotion.config.ts        render settings (H.264, CRF 16, yuv420p, BT.709, JPEG 95 frames)
  scripts/build-data.mjs    computes every number from ../data (run: npm run data)
  scripts/stills.mjs        bundle once and render several stills
  scripts/capture-screens.sh  refresh public/screens with tools/qa_shot.sh
  scripts/make-sfx.sh       synthesise public/sfx/*.wav
  src/Root.tsx              compositions + editable defaultProps
  src/Video.tsx             the TransitionSeries that strings the scenes together
  src/schema.ts             zod schema for the editable props
  src/theme.ts              fonts and colour tokens (launcher + each game's spec)
  src/anim.ts               frame-driven easing helpers
  src/components/           Words (kinetic type), ui (chrome, chips, ≠, source line), Footage, Sfx
  src/scenes/               Open, TheData, WhatWeMade, BubbleSort, FiveKm (+ fivekm/ maps), Rigged, Findings, WorkedDidnt, EndCard
  src/transitions/sweep.tsx custom colour-bar wipe
  src/data/generated.ts     AUTO-GENERATED, do not edit
  public/screens, public/sfx, public/footage (empty slot)
```

Every scene is also registered on its own in Studio (folder **Scenes**), so you can preview and tweak one part at a time.

## Licences

- **Remotion** is free for individuals, for-profit organisations with up to 3 employees, and non-profits
  ([remotion.dev/license](https://www.remotion.dev/docs/license)). A student hackathon team making a submission video fits the free
  licence. A company licence is only needed if a for-profit company with more than 3 employees adopts it.
- **Fonts:** Schibsted Grotesk, IBM Plex Mono, Bricolage Grotesque, Atkinson Hyperlegible, JetBrains Mono, Archivo, Archivo Black,
  Public Sans, Chivo, Chivo Mono and Caveat, all from Google Fonts under the SIL Open Font License.
- **Sound:** synthesised by `scripts/make-sfx.sh`. **Images:** our own game screenshots. No stock footage, no music.

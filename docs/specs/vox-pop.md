# Game 4 - VOX POP
**Tagline:** Ask the street. Guess the town. Then meet the 200.
**Page:** `vox-pop.html` · **Folder:** `games/vox-pop/`
**Genre:** isometric walk-and-talk reporting game. Three stories, about 5 minutes.
**Why it exists:** news reports often lean on a *vox pop* - a reporter asks five people on a street and the result sounds like "what people think". This game makes the player that reporter. They walk around a made-up Irish town next to a data-centre campus, interview residents, file a headline number, and then see their handful of answers next to the real survey of 200. The lessons are sampling error ("six people is not a town"), sampling bias ("where you ask changes what you hear") and the thread of the whole project: **DATA ≠ OPINION ≠ ASSUMPTION**.

## Honesty rules this game is designed around
- The survey file holds only totals and two-way cross-tabs. There are **no individual respondents**, so the residents are **synthetic**. Say it plainly on the start screen and in "How this works": *"The residents of Ballinacloud are made up. Their answers are drawn from how the 200 real respondents answered."*
- **District = survey q4 (local area).** The town has three districts: the town centre (urban), the Oakfield estate (suburban) and the farms (rural). Resident numbers per district follow q4's split. When a resident answers question X, the answer is drawn from the q4 × X cross-tab row for their district (people who described their area the same way). People in that row who skipped X give the chance of "I'd rather not say".
- **Answers to different questions are drawn independently.** The survey does not say how one person answered two questions, so a resident's answers are not linked. Explained in "How this works".
- If a cross-tab row is missing or has a suppressed cell (`null`), the game falls back to the question's overall answers for that district and says so in "How this works".
- The **crowd reveal** shows the survey's real counts as 200 figures (one per respondent, counts only, placed by q4 district). Nobody in it is a real person; it is a unit chart.
- The **"100 parallel vox pops"** strip is a simulation, labelled as one, with a "How this is calculated" panel.
- Cross-tab results are a pattern, not a cause - said wherever one is shown. All q4 groups used have n ≥ 35 (no small-group caveat needed; the code still adds one automatically if a group is under 30).
- Survey numbers come only from `window.Survey`; facts only from `window.DC_FACTS`, always with a source link and a confidence note for medium/low facts.

## Survey questions used
| Where | Ids | How |
|---|---|---|
| District mix and conditioning | q4 | resident count per district; cross-tab row for every answer |
| Story 1 "The new hall" (player picks one) | q67 (affect: uneasy about data centres near home), q77 (acceptable within 5 km) | headline measure: agree / acceptable (value ≥ 4) |
| Story 2 "Life online" (player picks one) | q11 (AI tools use), q8 (streaming use) - unused digital-habits block | headline measure: often or daily (value ≥ 4) |
| Story 3 "The six o'clock news" (two of three offered) | q97 (view change over two years), q99 (keep attracting investment), q104 (benefits can outweigh costs) - unused blocks | q97: became more negative (value ≤ 2); q99/q104: agree (value ≥ 4) |
| Story 2 extra insight (if q11 chosen) | q11 × q96 cross-tab | supportive share among daily vs never AI-tool users, with n |

## Facts used (all from `DC_FACTS.facts`, shown with source links)
Evidence points on the map. Reading one costs clock time and adds it to the notebook's DATA page.
| Place | Fact ids |
|---|---|
| Data hall (inside the campus) | `ie-share-2025` + `csoSeries` sparkline |
| Substation (campus) | `ie-share-2034` |
| Campus gate notice | `ie-cru-2025` |
| Water tank (campus) | `ie-water` (medium) |
| Energy centre + heat pipe to the estate | `ie-tallaght` |
| Wind farm on the hill | `ie-wind-dd`, `ie-rese` |
| Library | `prompt-gemini` (medium), `streaming`, `global-2030` |
| Credit union | `ie-gva` (medium), `ie-jobs` (medium) |
| Estate community noticeboard | `ie-bills` (low - caveat shown) |

Each story question lists the facts that are relevant to it (e.g. q11 → `prompt-gemini`, `global-2030`). If the player collected one before filing, the story is "Sourced".

## Minute by minute
1. **Start (0:00-0:20).** Floating isometric diorama of Ballinacloud behind a start card: what you'll do, the honesty line, "Built on a survey of 200 people in Ireland (Maynooth University)", DATA / OPINION / ASSUMPTION legend, controls, an optional **Relaxed mode** (no deadline). Button: *Start reporting*.
2. **Brief (per story, 10 s).** The editor's note and two question cards to choose from (exact survey wording + what the headline will measure). The deadline: 2 game hours.
3. **Reporting (per story, about 60-70 s).** Walk with WASD / arrow keys (or click to walk). Residents wander in their district. Near someone: an "E" bubble and a *Talk* button. The interview is a recorder-style dialogue: you read the survey question, they answer with a survey option (or decline). Their answer badge floats over their head; the notebook tally updates with a fly-in dot. Interviews cost 8 game minutes, reading a DATA point costs 12; walking uses real time. Sheep can be "interviewed" (they weren't surveyed). *File story* (F) any time; at the deadline the file panel opens by itself.
4. **File (10-20 s).** Your vox pop so far (OPINION, n people, by district) → set your headline number with a slider (ASSUMPTION); the headline sentence writes itself live. Relevant facts you hold are listed (DATA). *Go on air*.
5. **Signature moment - "Meet the 200" (5 s).** An ON AIR banner reads your headline. The camera pulls back to the whole town, the residents fade, and 200 little figures pop up across the districts, one per survey answer, placed by the real q4 cross-tab counts and marked ● (counts toward your headline) / ○ (other answer) / ◌ (didn't answer). A counter runs up to the survey figure.
6. **Story report (20-30 s).** Three numbers side by side: your headline (ASSUMPTION), your vox pop (OPINION, n), the survey (OPINION, n answered). Stars for accuracy. **100 parallel vox pops**: a dot strip of 100 simulated reporters asking the same number of random residents, with yours marked, plus the spread you'd get with 30 people. **Where you asked** vs the survey's district results (q4 cross-tab, with n). Relevant DATA facts (found ✓ / missed, and where they were).
7. Stories 2 and 3 repeat 2-6 with new questions; the light moves from morning to evening (street lamps on for the six o'clock news).
8. **End (30 s).** Press card with a rank, a table of the three stories (question id, people asked, headline vs vox pop vs survey, miss, sourced), the lesson drawn from the player's own run (e.g. biggest miss and how many people it came from), a DATA / OPINION / ASSUMPTION recap, "Reporters on this device" (localStorage, labelled honestly), "How this works", every source used, *Play again* (new residents, new question offers) and *All games*.

## Scoring
- Miss = |headline − survey| in percentage points. ★★★ ≤ 5, ★★ ≤ 12, ★ ≤ 20. +1 "Sourced" if a relevant fact was collected. Max 12.
- Ranks: 0-3 Work-experience intern · 4-6 Cub reporter · 7-9 Staff reporter · 10-12 Data desk editor.
- Copy says clearly that luck plays a big part with small samples - that is the lesson, not a flaw.

## Design direction
- **Concept:** local radio reporter on a bright, showery Irish day. The town is a floating isometric diorama on an Atlantic sea-glass background: painted shopfronts, a green post box, a GAA pitch, dry-stone walls, silage bales, sheep, a round tower on the hill, wind turbines, and a pale data-centre campus with rooftop chillers and a green heat pipe running to the estate. The UI is the reporter's kit: a recorder-style dialogue with a REC dot and a waveform, a notebook, an ON AIR light.
- **Palette (`:root`):** `--sea #CFE4E4` → `--sea-deep #9CC7CB` (page), `--ink #241C17` (peat, text), `--panel #FFFFFF`, `--line #E2DCD3`, `--coat #FFC933` (the reporter's raincoat: the player, "you" markers, ASSUMPTION chips), `--onair #E0474C` (ON AIR light and the deadline only), `--data #00727C` (teal), `--opinion #9B3D8F` (heather). Label chips: DATA teal with a bar icon, OPINION heather with a speech icon, ASSUMPTION coat-yellow with a pencil icon - always icon + word.
- **Type (Google Fonts):** `Unbounded` (titles, big numbers), `Figtree` (body), `DM Mono` (clock, n-values, sources), `Kalam` (notebook handwriting only). Fallbacks `system-ui` / `ui-monospace` / `cursive`.
- **Signature moment:** the pull-back to "Meet the 200". Everything else stays calm.
- Canvas 2D for the world (tiles, buildings, people, all drawn in code), DOM for every control and panel (real buttons, visible focus). Reduced motion: no camera shake or bobbing, crowd appears at once, the parallel-vox-pop dots appear without falling, turbines turn slowly.
- Laptop first (1280×800+). Narrow windows: panels become full-width sheets; no horizontal scroll.

## Debug screens
`#screen=` `start`, `brief`, `play`, `talk`, `fact`, `notebook`, `file`, `crowd`, `report`, `end`, `help`.

---

## Runner-up concepts (for the team to redirect to)
**B. Liaison Officer (build + negotiate).** You are the new community liaison officer for a data-centre campus in an isometric town. Walk around and collect residents' worries (q52 negative-impact areas) and wishes (q88 top-three conditions), then spend a budget placing things on the map - a heat pipe, a community hall, solar panels, a public path - and watch a simulated town meeting vote. Insight: people *rate* every condition as helpful but *choose* very different ones when forced (q78-q87 vs q88). Rejected because it overlaps with 5 KM's town hall.

**C. Rumour Mill (spread + correct).** A false belief ("all data centres run on fossil fuels", q18) spreads between wandering residents like a contagion, seeded by the survey's true/false shares (q18-q25). You carry DATA cards from the campus buildings to residents to correct them, but the survey says many people find it hard to change their view (q64), so corrections only stick sometimes. Insight: a fact reaching someone is not the same as a mind changing. Rejected because the spreading and persuasion rules would be invented (no data behind them) and it overlaps with Bubble Sort's true/false round.

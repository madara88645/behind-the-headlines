# Game 4 - VOX POP
**Tagline:** Ask the street. Guess the town. Then meet the 200.
**Page:** `vox-pop.html` · **Folder:** `games/vox-pop/`
**Genre:** isometric walk-and-talk reporting game. Three stories, about 5 minutes.
**Why it exists:** news reports often lean on a *vox pop* - a reporter asks five people on a street and the result sounds like "what people think". This game makes the player that reporter. They walk around a made-up Irish town next to a data-centre campus, interview residents, file a headline number, and then see their handful of answers next to the real survey of 200. The lessons are sampling error ("six people is not a town"), sampling bias ("where you ask changes what you hear") and the thread of the whole project: **DATA ≠ OPINION ≠ ASSUMPTION**.

## Honesty rules this game is designed around
- The survey file holds only totals and two-way cross-tabs. There are **no individual respondents**, so the residents are **synthetic**. Say it plainly on the first screen (the caption under the phone) and in "How this works": *"The residents of Ballinacloud are made up. Their answers are drawn from how the 200 real respondents answered."*
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
1. **Start: how to play, in three steps (0:00-0:10).** The living town diorama fills the screen; on the left, the reporter's phone. The top of the thread shows the game's name ("Vox Pop"), then a small card, "How to play", with three rows - an icon, a word and one short line each:
   - **1 · Ask** - "Interview people around town." (microphone)
   - **2 · Guess** - "What does the whole town think?" (a % sign in raincoat yellow)
   - **3 · Compare** - "Check your guess against a real survey." (a yellow bar next to a heather bar: your guess vs the survey)
   Under the phone a fixed caption says *"Built on a survey of 200 people in Ireland (Maynooth University). Residents are made up; their answers are drawn from how real respondents answered."* (200 from `Survey.n`). Behind the phone, the camera shows the whole town and a dashed yellow outline of the planned new data hall draws itself next to the campus, tagged "New data hall? · planning application" (the one memorable touch; decoration only). One button, *Start reporting* (focused; Enter, Space or Escape also start). No legend and no controls list: each label and each control is explained when the player first needs it (see 3-4). Reduced motion: the three rows and the outline appear at once.
2. **Brief (per story, 10 s).** The next message in the same thread: a "Story 1/3" divider, one line from the editor ("First up: the data centre wants a new hall. What will you ask?") and two reply buttons, each with a short title and the exact question the reporter will read out (`Sim.askText`). A *Details* disclosure holds what each headline measures (ASSUMPTION chip: "your guess: the % who answer …"), where the relevant DATA is on the map, and the survey question id. The phone's footer shows the deadline in one line ("On air at 11:00") and a *No deadline* switch (= relaxed mode, also in "How this works"); for a moment after it appears the footer ignores clicks, so a double-click on *Start reporting* can't flip the switch. Keyboard focus lands on the pair of questions, not on one of them: Enter/Space started the game, so pressing them again only shows a hint ("Choose with ↑↓ or Tab, then Enter") and never picks a question by accident; the arrow keys or Tab step into the two questions. If "How this works" is open when the questions arrive, focus stays in it and moves to the questions when it closes. Picking a reply sends it as a yellow bubble, the phone slides away and the camera glides down to the reporter. Stories 2 and 3 open a fresh, short thread in the same format (their own time in the phone's status bar, no replay of the three steps). *Play again* also starts here, at the story-1 brief.
3. **Reporting (per story, about 60-70 s).** Walk with WASD / arrow keys (or click to walk). Residents wander in their district. Near someone: an "E" bubble and a *Talk* button. On the first story the HUD arrives a piece at a time: at first only the story, the clock and *File story*, plus a note from the editor at the top ("Find someone to interview: walk with ←↑↓→ or click, then press E."), the yellow "You" ring at the reporter's feet until they first move (drawn over the bus shelter), and a yellow arrow and feet ring over a nearby resident the player can actually see (one not hidden behind a building or tree). These stay until the first interview, even if the player reads a data point or opens *File story* first. The tally appears after the first interview, the notebook and minimap after the first interview or data point (whichever comes first), and the editor's note changes to "Nice! Ask a few more people, then press F to file your story." The interview is a recorder-style dialogue: you read the survey question, they answer with a survey option (or decline). The first answer of the game carries a one-line explanation of OPINION; the first data point one of DATA. Their answer badge floats over their head; the notebook tally updates with a fly-in dot. Interviews cost 8 game minutes, reading a DATA point costs 12; walking uses real time. Sheep can be "interviewed" (they weren't surveyed). *File story* (F) any time; at the deadline the file panel opens by itself.
4. **File (10-20 s).** Your vox pop so far (OPINION, n people, by district) → set your headline number with a slider (ASSUMPTION - explained in one line the first time); the headline sentence writes itself live. Relevant facts you hold are listed (DATA). *Go on air*.
5. **Signature moment - "Meet the 200" (5 s).** An ON AIR banner puts your headline (ASSUMPTION) next to the survey result (OPINION) and says in one sentence how far apart they are; the full headline sentence and the crowd details sit under a *Headline and crowd details* disclosure. The camera pulls back to the whole town, the residents fade, and 200 little figures pop up across the districts, one per survey answer, placed by the real q4 cross-tab counts and marked ● (counts toward your headline) / ○ (other answer) / ◌ (didn't answer). A counter runs up to the survey figure.
6. **Story report (20-30 s).** Three numbers side by side: your headline (ASSUMPTION), your vox pop (OPINION, n), the survey (OPINION, n answered). Stars for accuracy. **100 parallel vox pops**: a dot strip of 100 simulated reporters asking the same number of random residents, with yours marked, plus the spread you'd get with 30 people. **Where you asked** vs the survey's district results (q4 cross-tab, with n). Relevant DATA facts (found ✓ / missed, and where they were).
7. Stories 2 and 3 repeat 2-6 with new questions; the light moves from morning to evening (street lamps on for the six o'clock news).
8. **End (30 s).** Press card with a rank, a table of the three stories (question id, people asked, headline vs vox pop vs survey, miss, sourced), the lesson drawn from the player's own run (e.g. biggest miss and how many people it came from), a DATA / OPINION / ASSUMPTION recap, "Reporters on this device" (localStorage, labelled honestly), "How this works", every source used, *Play again* (new residents, new question offers) and *All games*.

## Scoring
- Miss = |headline − survey| in percentage points. ★★★ ≤ 5, ★★ ≤ 12, ★ ≤ 20. +1 "Sourced" if a relevant fact was collected. Max 12.
- Ranks: 0-3 Work-experience intern · 4-6 Cub reporter · 7-9 Staff reporter · 10-12 Data desk editor.
- Copy says clearly that luck plays a big part with small samples - that is the lesson, not a flaw.

## Design direction
- **Concept:** local radio reporter on a bright, showery Irish day. The town is a floating isometric diorama on an Atlantic sea-glass background: painted shopfronts, a green post box, a GAA pitch, dry-stone walls, silage bales, sheep, a round tower on the hill, wind turbines, and a pale data-centre campus with rooftop chillers and a green heat pipe running to the estate. The UI is the reporter's kit: a phone with how to play and every brief from the editor, a recorder-style dialogue with a REC dot and a waveform, a notebook, an ON AIR light.
- **Palette (`:root`):** `--sea #CFE4E4` → `--sea-deep #9CC7CB` (page), `--ink #241C17` (peat, text), `--panel #FFFFFF`, `--line #E2DCD3`, `--coat #FFC933` (the reporter's raincoat: the player, "you" markers, ASSUMPTION chips), `--onair #E0474C` (ON AIR light and the deadline only), `--data #00727C` (teal), `--opinion #9B3D8F` (heather). Label chips: DATA teal with a bar icon, OPINION heather with a speech icon, ASSUMPTION coat-yellow with a pencil icon - always icon + word.
- **Type (Google Fonts):** `Unbounded` (titles, big numbers), `Figtree` (body), `DM Mono` (clock, n-values, sources), `Kalam` (notebook handwriting only). Fallbacks `system-ui` / `ui-monospace` / `cursive`.
- **Signature moment:** the pull-back to "Meet the 200". Everything else stays calm.
- Canvas 2D for the world (tiles, buildings, people, all drawn in code), DOM for every control and panel (real buttons, visible focus). Reduced motion: no camera shake or bobbing, crowd appears at once, the parallel-vox-pop dots appear without falling, turbines turn slowly.
- Laptop first (1280×800+). Narrow windows: panels become full-width sheets; no horizontal scroll.

## Sound (on hold)
Built, then put on hold by the team on 24 Sep: the game loads no sound. `games/vox-pop/audio.js` (Web Audio engine: music bed, ducking, one *Sound* switch + <kbd>M</kbd>, remembered in `localStorage`), `music.js` ("Etirwer" by Kistol, CC0) and `voices.js` (the characters' direct speech, computer-generated with Kokoro-82M, Apache-2.0, by `tools/make_vox_pop_voices.py` from `tools/vox_pop_voice_lines.json`) stay in the repo. game.js keeps its null-safe hooks (`VP.Audio` is optional), so adding the script tags back to `vox-pop.html` turns sound on again - regenerate `voices.js` first, because two answer lines were reworded afterwards.

## Debug screens
`#screen=` `start` (how to play), `brief` (story-1 brief after it), `brief2` (story-2 brief), `first-walk` (walking before the first interview), `play`, `talk`, `fact`, `notebook`, `file`, `crowd`, `report`, `end`, `help`, `evening` (story 3 at dusk).

---

## Runner-up concepts (for the team to redirect to)
**B. Liaison Officer (build + negotiate).** You are the new community liaison officer for a data-centre campus in an isometric town. Walk around and collect residents' worries (q52 negative-impact areas) and wishes (q88 top-three conditions), then spend a budget placing things on the map - a heat pipe, a community hall, solar panels, a public path - and watch a simulated town meeting vote. Insight: people *rate* every condition as helpful but *choose* very different ones when forced (q78-q87 vs q88). Rejected because it overlaps with 5 KM's town hall.

**C. Rumour Mill (spread + correct).** A false belief ("all data centres run on fossil fuels", q18) spreads between wandering residents like a contagion, seeded by the survey's true/false shares (q18-q25). You carry DATA cards from the campus buildings to residents to correct them, but the survey says many people find it hard to change their view (q64), so corrections only stick sometimes. Insight: a fact reaching someone is not the same as a mind changing. Rejected because the spreading and persuasion rules would be invented (no data behind them) and it overlaps with Bubble Sort's true/false round.

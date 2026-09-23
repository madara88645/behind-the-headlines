# Game 1 - BUBBLE SORT
**Tagline:** Data, opinion or assumption? Sort the claims, bet on yourself, then find out whose bubble you're in.
**Folder:** `games/bubble-sort/`
**Genre:** card-sorting game with confidence bets. 12 cards, about 4 minutes.
**Why it exists:** the brief's key idea is DATA ≠ OPINION ≠ ASSUMPTION. This game turns that sentence into the core mechanic: every card must be dropped into one of three bubbles. Surface wording alone must not give the answer away.

## Definitions shown to the player (on the start screen, and in a "?" help popover)
- **DATA** - something that was measured and has a source you can check. ("The CSO measured…")
- **OPINION** - a judgement about what is good, bad, fair or what should happen. It can't be proven true or false - but how many people hold it is itself data.
- **ASSUMPTION** - a claim about how the world is that could be checked, stated without evidence. It might turn out true, false or half-true.

## Flow
1. **Start screen** - title, one-line pitch, the three definitions as three bubbles, "Start sorting" button. Small line: "Built on a survey of 200 people in Ireland (Maynooth University) and official statistics."
2. **Sorting rounds (12 cards, shuffled each run but always 4 of each type).** For each card:
   - The card shows the statement. DATA cards show their source name in small type ("Source: CSO") - this is the realistic cue; ASSUMPTION cards show "Heard in conversation", "Seen on social media", etc.; OPINION cards show "Said at a public meeting", "Letter to the editor", etc. (these attribution tags are flavour; they must not be misleading: never attach a real person's name).
   - **Bet:** before dropping, the player picks how sure they are: *Hunch* (1 pt), *Fairly sure* (2 pts), *Certain* (3 pts). Right = +bet, wrong = −bet. Default is Hunch so fast players are not blocked.
   - **Drop:** drag the card into one of the three bubbles OR press the bubble's button (keyboard: 1 / 2 / 3). Both must work; on touch, tap-to-select then tap bubble.
   - **Reveal panel** (slides up, "Next card" button, Enter to continue):
     - Right/wrong with icon + word, points change.
     - Why this bin (1-2 sentences, plain English).
     - For **ASSUMPTION** cards built from survey items q18-q25: the verdict chip from `DC_FACTS.trueFalse[qid]` (`tag`: True / False / Partly true / Missing context / Mostly false), the `short` explanation, a "Read more" toggle with `explain` and source links, AND the survey line: "In the survey, **{Survey.fmt(Survey.pct(qid,'True'))}** said this was true, {pct False} false, {pct Don't know} didn't know." Draw it as a small 3-segment bar (True / False / Don't know).
     - For **OPINION** cards built from Likert items: "In the survey, {agree}% agreed and {disagree}% disagreed (200 people in Ireland). That split is data about people - not about data centres." Draw a 5-segment diverging bar using the option percentages in order.
     - For **DATA** cards: the source name + link, and the year.
3. **Finale sequence** (3 short screens, each with a "Next" button):
   a. **Your score & calibration** - total points; a small table: for each bet level, how many right/total ("When you said *Certain* you were right 3 of 4 times"). One sentence verdict: "well calibrated", "overconfident" (lost points on Certain bets) or "too modest" (right on most Hunches).
   b. **The confidence paradox** - "People who were most sure were not the most right." Build a bar chart of `Survey.within('q17', label, 'q18', 'True')` for each of the five q17 options (x-axis in q17 order: Nothing at all → A great deal). Each bar labelled with its % and `n`. Any bar with n < 30 gets a visible "small group (n = X)" tag, and a line under the chart: "The 'a great deal' group is only {n} people - treat this as a clue, not a law." Headline copy: "{pct}% of people who said they know 'a great deal' about data-centre energy believed that all Irish data centres run on fossil fuels - which is false." Compute every number at runtime.
   c. **Whose bubble are you in?** - ask the player two quick questions using the survey's own options: "Where have you mostly formed your view on data centres?" (single choice from `Survey.q('q16').options`, excluding "Something else (written in)") and "How much do you feel you know about how data centres use energy?" (`Survey.q('q17').options`). Then show a **bubble portrait card** (styled like a collectible/trading card): the cohort name ("The Social Media bubble"), and two stats from the cross-tabs for people in the survey who chose the same information source: support for sustainable data centres (`Survey.within('q16', src, 'q96', /supportive/)`) and belief in the fossil-fuel myth (`Survey.within('q16', src, 'q18', 'True')`), each with n; plus the same two for their q17 answer. Then the player's own result line: "You sorted {x}/12 correctly." State clearly: "Matched on the two answers you just gave - it's a comparison with people who answered the same way, not a prediction about you." If a cross-tab returns null, show "too few people to show".
4. **End screen** - "Play again" (reshuffles), "Back to all games", and a **Sources** list: the survey (200 respondents, Maynooth University), plus every fact source used in this run (dedupe by URL).

## The deck (write the final card text in plain English; keep each under ~20 words)
Pick at runtime: 4 DATA + 4 OPINION + 4 ASSUMPTION, shuffled, from these pools (so replays differ):

**DATA pool** (from `DC_FACTS.facts`, use `text`, `source`, `year`, `url`; pick ids): `ie-share-2025`, `ie-wind-dd`, `ie-tallaght`, `ie-jobs`, `ie-water`, `global-2024`, `streaming`, `ie-rese`. At least one DATA card must sound alarming (e.g. `ie-share-2025`) and at least one must sound like an opinion but be measured.

**OPINION pool** (Likert items from the survey; show the item text lightly edited into a spoken sentence; the reveal uses the real distribution of that id): `q26` (unacceptable strain on the grid), `q42` (land should go to housing instead), `q46` (necessary infrastructure for a modern digital economy), `q50` (Ireland benefits economically from being a hub), `q69` (tech companies' interests outweigh ordinary people's), `q101` (community consent should be a legal requirement), `q31` (should be required by law to use 100% renewable energy). Note q46/q50 sound factual - that is intended; the reveal explains that "benefits" and "necessary" are judgements.

**ASSUMPTION pool** (the survey's true/false items; card text = statement; reveal uses `DC_FACTS.trueFalse[qid]` + the survey split): `q18`, `q19`, `q20`, `q21`, `q22`, `q23`, `q24`, `q25`. Make sure every run includes `q18` (false) and at least one TRUE one (q20, q23, q24 or q25), so players learn an assumption can be true.

## Scoring
Points = sum of (+bet if right, −bet if wrong). Show a running score chip. No timer.

## Design direction (follow exactly - it was chosen to avoid generic looks)
- **Concept:** a bright science-museum "bubble lab": three big soap bubbles float at the bottom of the screen; cards drop into them and the bubble wobbles and swallows the card.
- **Palette (CSS custom properties on :root):**
  - `--sky: #EEF0FF` (page background, a pale periwinkle, NOT cream)
  - `--ink: #1B1B3A` (text)
  - `--data: #1F5BFF` (cobalt - DATA bubble)
  - `--opinion: #D6246E` (raspberry - OPINION bubble)
  - `--assume: #F2A007` (marigold - ASSUMPTION bubble)
  - `--card: #FFFFFF`, `--muted: #5D5F86`, `--right: #0B8A4A`, `--wrong: #C8102E`
- **Type (Google Fonts):** display `Bricolage Grotesque` (700/800, used for titles, bubble labels, big numbers); body `Atkinson Hyperlegible` (400/700); data/sources `JetBrains Mono` (400/500, small caps-like labels for n, sources, percentages). Fallbacks: `system-ui, sans-serif` and `ui-monospace, monospace`.
- **Signature element:** the three bubbles - circles with an iridescent sheen (layered `radial-gradient` + a slowly rotating `conic-gradient` highlight at low opacity, a thin rim in the bubble's colour, a small white specular highlight). On drop: a squash-and-stretch "gulp" animation (scale 1 → 1.12/0.9 → 1 over ~450 ms) and the card shrinks into the bubble. When reduced motion is on: a simple fade.
- Cards: white, 20px radius, soft shadow, slight random tilt (±2°) that straightens on hover/focus.
- Keep everything else quiet: no gradients on the page background, no decorative stripes.
- Layout: desktop - card centred top half, bubbles in a row bottom; mobile (360px) - card on top, bubbles become three large pill buttons in a row (still coloured, still labelled), reveal panel is a bottom sheet.

## Copy tone
Friendly, curious, never preachy. Example: "Sounds like a fact, right? It's a judgement - 'benefits' depends on who you ask."

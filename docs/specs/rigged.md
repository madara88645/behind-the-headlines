# Game 3 - RIGGED
**Tagline:** Three experiments. All of them fixed. You'll still fall for it.
**Folder:** `games/rigged/`
**Genre:** psychology-lab mini-games with a debrief after each. Three experiments + finale, about 4 minutes.
**Why it exists:** the survey asked 200 people whether classic biases affect *them* (anchoring, availability, social proof). Most said no. This game rigs each bias against the player, shows them the trick straight away, and then puts their measured behaviour next to what the survey respondents believed about themselves. It is the brief's "an assumption is not data" idea turned on the player.

## Ethics line (show on the start screen and in the finale)
"Every experiment here is rigged, and you'll be told how right after. Real news feeds and comment sections don't tell you."

## Flow
### Start screen - "Participant briefing"
Lab-style consent card: "Participant #{random 4 digits}", "Duration: about 4 minutes", "You will be mildly misled for science and debriefed after each experiment." Button: "Enter the lab". (Not a real consent form - no personal data is collected.)

### Experiment 1 - THE WHEEL (anchoring)
1. A wheel of fortune (inline SVG, numbers 0-100 around the rim) spins when the player presses "Spin". It is rigged: it lands 50/50 on a **low anchor** (random integer 6-12) or a **high anchor** (random integer 65-85). Record which.
2. Question A: "Do data centres use more or less than **{anchor}%** of Ireland's electricity?" Buttons: More / Less.
3. Question B: "Your best estimate?" - a 0-100 slider that shows **no value and no thumb until the player first interacts** (otherwise the slider's starting point becomes a second anchor). Require interaction before "Lock in".
4. **Debrief** (the signature flip - see Design): red-ink annotation "The wheel only ever lands on 6-12 or 65-85." Then:
   - DATA: `DC_FACTS.csoSeries` 2025 value (23%) with source link. Show their estimate vs the truth on a 0-100 line, with the anchor marked.
   - Classic evidence (static copy, this is a published study, OK to hard-code): "In a famous 1974 experiment, people who spun a 10 guessed a median of 25%; people who spun a 65 guessed 45% - for the same question. (Tversky & Kahneman, *Science*, 1974)."
   - This device: store `{anchorType, guess}` in localStorage; if there is at least one low and one high result stored, show "Players on this device: low anchor → average {x}%, high anchor → average {y}%". Otherwise: "Play again to get the other anchor and test yourself."
   - OPINION mirror: "In the survey, only **{Survey.agree('q62')}%** agreed their first impression of data centres stayed with them, and **{Survey.agree('q65')}%** that they trust the first source they encounter." Show agree/neither/disagree bars for q62 and q65 (use the ordered options).

### Experiment 2 - THE FEED (availability)
1. A phone-shaped frame shows a social feed. 8 posts auto-advance (about 1.8 s each; a "Pause" button and a "Next" button for accessibility; reduced motion = manual only). The feed is rigged **6 alarming : 2 reassuring**, built from `DC_FACTS.claims`: alarming = ids `c5` (water use doubled in the hot summer - always include, it's the key vivid item), `c2`, `c17`, `c18`, `c16`, `c11`; reassuring = `c7`, `c4`. Each post shows the outlet name and date as the "account", the paraphrased claim as the post text, and fake-but-generic engagement numbers (likes/shares) - NO real people's names or handles.
2. Question A: "What share of Ireland's public drinking water do data centres use?" - slider 0% to 30% in 0.1 steps, no default thumb (same rule as above). 
3. Question B: "Thinking back, were the posts mostly negative, mostly positive, or balanced?" (3 buttons).
4. **Debrief:** red-ink annotation "6 of the 8 posts were picked to be alarming." Then:
   - DATA: fact `ie-water` → "under 0.3%" (source link). Both water numbers are true: "200 million litres in one month (true, vivid) and under 0.3% of supply (true, boring). The vivid one sticks." Show their guess vs 0.3% on the 0-30% line.
   - OPINION mirror: `Survey.agree('q55')` ("News stories about data centres using excessive energy have strongly shaped my views"), `Survey.agree('q57')` ("The information I have encountered about data centres has mostly been negative"). Bars for both.

### Experiment 3 - THE CROWD (social proof)
1. A "Live: what other players said" panel with an animated bar that fills to a rigged **80%** - randomly either 80% "unacceptable" or 80% "acceptable" (record which). Add a pulsing "live" dot and a ticking player counter so it feels real.
2. Question: the survey's own q77 question text with its 5 options ("How acceptable would it be for a sustainable data centre to be built within 5 km of your home?").
3. **Debrief:** red-ink annotation "There were no other players. That bar was made up." Then:
   - "Answer again - no crowd this time." Re-ask the same question on a clean card. Show both answers and the shift (e.g. "You moved one step towards the fake crowd" / "You didn't move - nice").
   - OPINION (real): the survey's actual q77 distribution (5-segment bar, labelled "200 people in Ireland").
   - OPINION mirror: `Survey.agree('q59')` ("If my local community opposed a data centre development, I would also oppose it") and `Survey.agree('q61')` ("Public protests against data centres have influenced my own views").

### Finale - THE BLIND SPOT
1. **Lab report** styled as a filled-in results sheet. One row per experiment:
   - What was rigged / What you did (measured: estimate vs truth, whether your answer moved toward the crowd) / What the survey respondents said about themselves (agree % and disagree %, from the ids above).
2. Headline: "Most people in the survey said these biases don't affect them. {Survey.disagree('q62')}% disagreed that first impressions stick. Psychologists call this the *bias blind spot*: we spot bias in others more easily than in ourselves (Pronin, Lin & Ross, 2002)."
3. **Gut check** (contribute): ask q66 "Which word best describes your gut-level feeling about data centres?" with its 5 options; show the survey distribution with a "You" marker. Save to localStorage and show "players on this device" alongside, labelled honestly.
4. Ethics line again, Play again, Back to all games, Sources (survey; CSO; Uisce Éireann/TheJournal; every claim outlet used in the feed; Tversky & Kahneman 1974; Pronin, Lin & Ross 2002).

## Design direction (follow exactly)
- **Concept:** a psychology lab's paperwork. Each experiment is a protocol sheet on pale graph paper; the debrief is the *researcher's copy* of the same sheet, marked up in red pen. The signature moment: after the player locks in an answer, the sheet flips over (3D rotateY, 600 ms) to the researcher's side: the hidden rig is circled in red, a handwritten note explains it, and a red rubber stamp **RIGGED** thumps down (scale 1.4 → 1 with slight rotation). Reduced motion: crossfade, stamp fades in.
- **Palette (CSS custom properties):**
  - `--paper: #E6F0EA` (pale lab-mint), graph grid lines via `repeating-linear-gradient` in `--grid: #C9DDD1` (1px every 24px), very subtle
  - `--ink: #14213D` (navy ink, all main text)
  - `--pencil: #5B6B7F` (secondary text)
  - `--red: #D62828` (red pen + RIGGED stamp; used ONLY in debriefs)
  - `--marker: #FFE45C` (highlighter for key numbers)
  - `--data: #1D6FA5`, `--opinion: #7A3DB8`, `--assume: #C27100` (label chips DATA / OPINION / ASSUMPTION)
- **Type (Google Fonts):** display + body `Chivo` (400/700/900; headings 900, tight letter-spacing); protocol fields, numbers and sources `Chivo Mono`; the researcher's red-pen notes `Caveat` (600, only in debriefs, never for body copy). Fallbacks `system-ui` / `ui-monospace` / `cursive`.
- Protocol sheets: white-ish card on the graph paper, header row with "EXPERIMENT 01 · ANCHORING · Participant #0427" in mono, hairline form fields. Numbers the player produces get a highlighter swipe.
- The wheel: inline SVG, 12 segments alternating two ink tints, a pointer at top; spin with CSS rotation + ease-out (2.2 s); final angle computed so the pointer lands on the rigged number.
- The feed: a phone frame (rounded rect) with posts as simple cards; avatars are coloured initials of the outlet (e.g. "RT", "IT") - no logos.
- Mobile 360px: one column; the flip still works; the wheel scales down.

## Copy tone
Dry lab humour, never mean. "Interesting. Very interesting." "For science." After each debrief, reassure: falling for it is normal - that's why these effects are famous.

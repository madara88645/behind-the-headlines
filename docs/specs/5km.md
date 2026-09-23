# Game 2 - 5 KM
**Tagline:** Ireland says yes. Would your street?
**Folder:** `games/5km/`
**Genre:** cinematic zoom + planning negotiation. Three acts, about 4-5 minutes.
**Why it exists:** the survey's most striking finding is a gap between general support and local acceptance (the "not in my back yard" gap), and a second gap between how people *rate* conditions one by one and what they *pick* when forced to choose three. The player lives both gaps instead of reading them.

## Key survey numbers (compute ALL at runtime via `window.Survey`; never hard-code)
- National support: `Survey.pct('q96', /supportive/)` (≈56%). Opposed: `/opposed/`.
- Accept a sustainable data centre within 5 km: `const ACCEPT = o => o.value >= 4;` → `Survey.pct('q77', ACCEPT)` (≈30%). Unacceptable: `o => o.value <= 2`. Do NOT use the regex /unacceptable/ - it also matches "Neither acceptable nor unacceptable". Option labels in order (value 1-5): "Completely unacceptable", "Somewhat unacceptable", "Neither acceptable nor unacceptable", "Somewhat acceptable", "Completely acceptable". Every ordered question's options carry a 1-based `value` (q96: 1 Strongly opposed … 5 Strongly supportive; "I don't have enough information…" has value null).
- Accept within 5 km by area type: `Survey.within('q4', /^Urban/, 'q77', ACCEPT)`, `/^Suburban/`, `/^Rural/` (each returns {pct, n}).
- Accept within 5 km by "is there already a data centre within 10 km?": `Survey.within('q7', 'Yes', 'q77', ACCEPT)` vs `'No'` (and "I don't know").
- Accept within 5 km among the strongly supportive: `Survey.within('q96', 'Strongly supportive', 'q77', ACCEPT)`.
- Self-reported familiarity: `Survey.agree('q74')` ("If I had visited a data centre in person, I think I would feel more comfortable").
- The ten conditions q78-q87 (use `Survey.label(id)` for the text). Rating strength = % "Large (4)" + "Fully accepting (5)" = `Survey.pct(id, o => o.value >= 4)`.
- Forced top-3 priorities: `Survey.q('q88').options` - match each of the ten conditions to its q88 option by text (the q88 labels equal the q78-q87 item texts; match case-insensitively on the first ~25 characters). Exclude the "Something else" option if present.

## Flow
### Act 1 - Zoom (the national-to-local drop)
1. **Your view, zoomed out.** Ask the player the survey's q96 question with its exact options (skip the "I don't have enough information" option or keep it - your choice, but handle it). Their answer is the first pin on a "You" rail.
2. **National meter.** A large meter/gauge shows "{56}% of 200 people surveyed in Ireland support sustainable data centres" labelled OPINION (it is what people said), with a DATA context line from facts: `DC_FACTS.facts` id `ie-share-2025` (with source link).
3. **Predict.** "Now we zoom in to 5 km from home. What share do you think will still say yes?" - a slider 0-100 (their ASSUMPTION, locked).
4. **Zoom.** Hold a button (or press once; must be keyboard accessible) to zoom through 4 discrete scenes that crossfade with a CSS scale transform: *Ireland* → *your county* → *your town* → *your street*. The meter falls in steps and lands on the q77 figure (≈30%) with a short screen-shake and a stamp: "The 5 km gap: 56% → 30%". Show their prediction next to the real number ("You guessed 45%").
5. **Your view, zoomed in.** Ask the player q77 themselves (5 options). Show both of their answers side by side as two pins joined by an elastic line - if their answers diverge, the line stretches visibly. Copy: "You just did what the survey found" if their local answer is less accepting than their national one; otherwise "You're consistent - most people in the survey weren't".
6. **Where do you live?** Player picks Urban / Suburban / Rural → show the cross-tab acceptance for that area, with n, and the other two for comparison (small bar trio).

### Act 2 - The town hall (the negotiation)
The player now works for a developer proposing a sustainable data centre near a town. They must win over a town hall of **100 residents**.
1. **The room.** 100 dots (people icons, simple circles with a head) in a grid/hall layout, coloured by stance. Starting stances come from q77, scaled to 100 with largest-remainder rounding: Completely unacceptable / Somewhat unacceptable / Neither / Somewhat acceptable / Completely acceptable. Legend with counts.
2. **The package.** Ten condition cards (q78-q87). Each card front shows the condition, an icon (inline SVG), a cost in *planning points*, and its **rating strength** (% large/fully accepting) as a small bar. Budget: **6 points**. Costs (game design assumptions - say so in the How-it-works panel): renewables 3, waste heat 3, lower local bills 3, local jobs 2, community fund 2, landscape-friendly architecture 2, independent monitoring 1, open days 1, STEM schools 1, liaison committee 1. Player toggles cards on/off; a budget bar shows remaining points; can't exceed 6.
3. **Predict again.** Before the vote: "How many of the 100 will accept your package?" slider (ASSUMPTION).
4. **The vote** (animate dots changing colour one by one, fast). Model - shown in a "How this is calculated" panel in plain English:
   - Each condition's *pull* p = share of survey respondents who put it in their **top three** (q88) / 100.
   - "Neither" residents are won over if at least one of their top-three priorities is in your package: P = 1 − Π(1 − p).
   - "Somewhat unacceptable" residents need at least two of their top three in your package: P(at least 2 of the independent events).
   - "Completely unacceptable" residents don't move ("they told the survey it was completely unacceptable").
   - Already-accepting residents stay.
   - Converted count = round(P × group size) per group.
   - Panel must say: "This is a simplified model built from the survey's answers, not a prediction. It assumes people's priorities are independent of each other."
5. **The reveal.** Result: "{accepting}/100 would accept" vs their prediction. Then flip every card to show its back: **top-three share** (q88) next to its **rating strength** (q78-q87). Highlight the two biggest mismatches automatically (compute: largest positive and negative difference between rating strength rank and q88 rank) - with the current data these will be e.g. lower local bills (rated highest, rarely picked) and renewables (rated lowest, picked second most). Copy: "Rated one by one, most conditions look alike. Forced to choose three, people show their real priorities."
6. **One more try.** Offer a second attempt with the new knowledge ("Revise your package"); keep the best score. After the second vote, move on.

### Act 3 - The twist and the report card
1. **Living next door.** "Does living near one make people more comfortable?" Show the self-reported belief: "{q74 agree}% agreed that visiting a data centre would make them more comfortable" (OPINION), then the cross-tab: acceptance within 5 km for people who already have a data centre within 10 km vs those who don't (DATA from the survey, with n). Add a caveat line: "This shows a pattern, not a cause - people near data centres may have more reasons to be wary, or live in busier places."
2. **Report card.** Three rows, each clearly labelled:
   - **ASSUMPTION** - your predictions (street-level %, package votes) vs the survey/model results.
   - **OPINION** - your q96 and q77 answers next to the survey's distribution for each (small stacked bar with a "You" marker).
   - **DATA** - two facts from `DC_FACTS` (e.g. `ie-share-2025`, `ie-cru-2025`) with links.
   Also "Your best town hall result: {n}/100".
3. **Add your answer (this device).** Save the player's q77 answer to localStorage and show a small bar "Players on this device" next to the survey's q77 bar, labelled honestly. Wrap storage in try/catch.
4. Buttons: Play again, Back to all games. Sources list.

## Design direction (follow exactly)
- **Concept:** an Irish planning notice meets an Ordnance Survey map. Irish planning site notices are bright yellow A3 sheets nailed to a post at the site - that yellow notice is the game's key surface for questions and the package. Maps are drawn in flat, calm field greens with contour-line texture.
- **Palette (CSS custom properties):**
  - `--field: #DDE8CF` (page background - pale field green; NOT cream)
  - `--field-deep: #9DBF86`, `--hedge: #3E6B3A` (map layers)
  - `--notice: #FFD400` (planning-notice yellow)
  - `--ink: #151A14` (text)
  - `--road: #E4572E` (alert orange - reserved for the meter drop and the stamp)
  - `--against: #B8322A`, `--neutral: #8C8F86`, `--accept: #1F6E8C` (resident stances; always pair colour with a legend/pattern)
- **Type (Google Fonts):** display `Archivo` in its expanded/condensed widths if available (use `Archivo Black` for the big meter numbers and stamps); body `Public Sans`; utility `IBM Plex Mono` for grid references, n-values and source lines. Fallbacks `system-ui` / `ui-monospace`.
- **Signature element:** the zoom with the falling meter. Build the four scenes as inline SVG: Ireland outline (simplified polygon is fine, drawn by hand in SVG), a county blob with a few towns, a town grid with roads, a street with houses and a small wind turbine. Crossfade + scale between them (600-800 ms each). The meter is a big number in Archivo Black that counts down between scenes. Reduced motion: crossfade only.
- Question cards are styled as yellow planning notices: heading "NOTICE" in Archivo, black rules, a small "Grid ref" mono line (fake coordinates are fine as decoration), subtle paper texture via CSS (no images).
- The town hall: 10×10 grid of people-dots on a pale floor; when a dot flips, a tiny pop. Colours + a small shape difference (against = square, neutral = circle outline, accept = filled circle) so it isn't colour-only.
- Mobile: scenes stack; the package cards become a 2-column grid; the town hall grid shrinks to fit 360px.

## Copy tone
Warm, a bit wry, local. "Ireland says yes. Your street? Let's see." Never mock the player for being inconsistent - the survey shows most people are.

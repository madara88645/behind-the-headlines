# Build rules for all three games

These apply to every game in `games/`. They exist so the games work on any laptop at the hackathon, look finished, and never misrepresent the data.

## Tech
- Plain HTML + CSS + JavaScript. No build step, no npm, no frameworks. Each game's page is `<slug>.html` in the project root; its `style.css`, `game.js` (and any helper JS) live in `games/<slug>/`.
- Why the page is in the root: Safari only lets a file:// page load files from its own folder and below. A page inside `games/<slug>/` could not load `../../data/` in Safari.
- Must work by double-clicking `index.html` (file://). So: no `fetch()` of local files, no ES modules (`type="module"` breaks on file://). Load data with classic `<script src>` tags in this order:
  ```html
  <script src="data/survey_stats.js"></script>
  <script src="data/facts.js"></script>
  <script src="shared/survey.js"></script>
  <script src="games/<slug>/game.js"></script>
  ```
- Allowed external resources: Google Fonts only (with a sensible local fallback stack). No other CDNs, no images from the web. Draw illustrations with inline SVG / CSS.
- No backend. If a game "remembers" player answers, use `localStorage` wrapped in try/catch, and label it honestly ("answers from this device", never "live poll").
- Every page links back to the launcher: `index.html`.

## Data honesty (the hackathon rules say "don't misrepresent the data")
- Survey numbers come ONLY from `window.Survey` (see `shared/survey.js`) at runtime - never hard-code a survey percentage in HTML or JS. Hard-coded copy may reference a question id and compute the number, e.g. `Survey.fmt(Survey.pct('q77', /Somewhat acceptable|Completely acceptable/))`.
- Facts, policies and news claims come ONLY from `window.DC_FACTS` (`data/facts.js`). Show the source name and link for every fact the player sees (a small "Source" link is enough).
- Always say who the survey people are: "200 people in Ireland (Maynooth University survey)". Never "Irish people think…" or "Ireland thinks…" as a universal claim - say "in this survey".
- Keep three things visibly separate wherever the game shows them: DATA (measured facts with a source), OPINION (what survey respondents said), ASSUMPTION (the player's own guess). Use consistent labels.
- Cross-tab groups with fewer than 30 people must show a visible "small group (n = X)" caveat. Suppressed cells (`null`) must never be shown as 0.
- Multi-select questions (q16, q52, q53, q88) sum to more than 100% - never draw them as a pie or as parts of a whole.
- q89–q94 (trust ratings) have an unknown scale direction - do not use them.
- A game model (e.g. an "acceptance meter") is a simplification. Say so in the UI with a short "How this is calculated" panel that states which questions feed it.

## Debug screens (for automated screenshots)
- Support a URL hash `#screen=<name>` that jumps straight to a representative state of each major screen with plausible sample player answers already filled in (e.g. `#screen=start`, `#screen=round`, `#screen=reveal`, `#screen=finale`, `#screen=end` - name them after your own screens). Normal play (no hash) must be unaffected.
- Check your work with `tools/qa_shot.sh games/<slug>/index.html /path/out.png 1280 800 "#screen=<name>"` and again at `390 844` (phone). It saves a screenshot and prints console errors. Open the PNG with the Read tool and look at it critically.

## Quality floor
- English only, plain and friendly, sentence case. No lorem ipsum, no TODOs, no placeholder text.
- Responsive from 360 px phone width to a 1440 px laptop, no horizontal scroll. Test mentally at both.
- Keyboard playable: every control is a real `<button>`/`<input>`, visible focus ring, Enter/Space work.
- Respect `prefers-reduced-motion` (turn big animations into fades).
- Colour contrast AA for text. Don't rely on colour alone for right/wrong - add an icon or word.
- No console errors. Guard against missing data (if a question id is missing, skip that round rather than crash).
- Game length: 3–6 minutes for a full run, with a clear start screen, a clear end screen with a summary, and a "Play again" button.
- The end screen should show the player something about themselves compared with the survey, and list the sources used.

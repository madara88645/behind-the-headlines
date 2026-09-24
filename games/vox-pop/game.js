/*
 * Vox Pop - game.js
 * Ask the street. Guess the town. Then meet the 200.
 *
 * Survey numbers only come from window.Survey (via sim.js); facts only from window.DC_FACTS.
 * The residents are made up - see sim.js for how their answers are drawn from the survey.
 *
 * The opening is a short thread of messages from your editor on the reporter's phone (one sentence
 * per beat, the camera gliding to each place), and the same thread then carries each story's brief.
 *
 * Debug screens: add #screen=<name> to the URL:
 *   start (the new-message notice), beat1, beat2, beat3, beat4  - the intro beats on the phone
 *   brief (story 1 brief, after the intro), brief2 (story 2 brief), first-walk (walking, before the first interview)
 *   play, talk, fact, notebook, file, crowd, report, end, help, evening (story 3 at dusk)
 */
(function () {
  'use strict';

  const S = window.Survey, F = window.DC_FACTS || { facts: [] };
  const VP = window.VP || {};
  const Wd = VP.World, Art = VP.Art, Sim = VP.Sim, People = VP.People;
  const Snd = VP.Audio || null;            // music and voices (audio.js); optional
  const sayLine = (who, text) => { if (Snd && who && text) Snd.say(who, text); };
  if (!S || !Wd || !Art || !Sim || !People) return;

  /* ============================================================ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => !!RM.matches;
  const pc = (p) => S.fmt(p);
  const r0 = (p) => Math.round(p);
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0');
  const TOWN = Sim.TOWN;
  const joinList = (a, last) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' ' + (last || 'and') + ' ' + a[a.length - 1]);

  const CHIP = {
    data: '<span class="chip data"><i aria-hidden="true" class="ico ico-bars"></i>Data</span>',
    opinion: '<span class="chip opinion"><i aria-hidden="true" class="ico ico-talk"></i>Opinion</span>',
    assume: '<span class="chip assume"><i aria-hidden="true" class="ico ico-pencil"></i>Assumption</span>',
  };
  const CONF = {
    high: 'Official statistics, regulator or IEA.',
    medium: 'Reputable reporting, not official statistics.',
    low: 'A single or contested estimate - treat with care.',
  };

  /* ============================================================ tuning */
  const RESIDENTS = 30, SHEEP = 7;
  const STORY_MIN = 120;          // two game hours per story
  const SEC_PER_MIN = 0.55;       // real seconds per game minute while you walk (~66 s a story)
  const COST_TALK = 8, COST_FACT = 12;
  const TALK_RANGE = 1.5, FACT_RANGE = 1.55, SHEEP_RANGE = 1.3;
  const SPEED_PX = 150;           // walking speed on screen, px per second at zoom 1
  const PLAYER_R = 0.24;
  const REPORT_W = 470;

  /* ============================================================ canvas */
  const cv = $('#world');
  const ctx = cv.getContext('2d');
  const mm = $('#minimap');
  const mmx = mm.getContext('2d');
  let vw = 0, vh = 0, dpr = 1, dprCap = 2, baseZoom = 1, ground = null, mmBase = null;
  const view = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };
  const MAP_C = Wd.iso(Wd.W / 2, Wd.H / 2);

  /* ============================================================ state */
  let G = null;
  function newState(seed) {
    return {
      seed,
      ansRng: Sim.rng(seed),
      aiRng: Sim.rng(seed ^ 0x9E3779B9),
      mode: 'boot',
      debug: false,
      relaxed: G ? G.relaxed : false,
      // what the player has already been shown: the full HUD and each label's one-line explanation
      taught: G ? G.taught : { hud: false, opinion: false, data: false, assume: false, next: false },
      cam: 'town',             // camera spot during the intro and the briefs
      camShift: { sx: 0, sy: 0 },
      introBeat: -1,
      introSkipped: false,
      hallT: 0,                // when the planned hall started drawing itself
      chatty: [],              // residents with a speech bubble on beat 3
      glideUntil: 0,
      residents: People.makeResidents(Sim.rng(seed + 11), RESIDENTS),
      sheep: People.makeSheep(Sim.rng(seed + 29), SHEEP),
      player: { x: Wd.spawn.x, y: Wd.spawn.y, dir: 'se', phase: 0, moving: false, moved: false, path: null, goal: null },
      guide: null,             // the resident the first-walk arrow points at
      story: -1,
      stories: [],
      facts: new Map(),        // fact id -> evidence point id where it was read
      visited: new Set(),      // evidence point ids read
      shown: new Set(),        // every fact id the player has been shown (for the sources list)
      clock: 0,
      crowd: null,
      fx: [],
      t: 0,
      talk: null,
      target: null,
      warned: false,
    };
  }
  const story = () => (G && G.story >= 0 ? G.stories[G.story] : null);

  /* ============================================================ sizing */
  function resize() {
    dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    baseZoom = clamp(Math.min(vw / 1280, vh / 800) * 1.05, 0.62, 1.45);
    const gs = Math.min(2.2, dpr * Math.max(1, baseZoom));
    if (!ground || Math.abs(ground.scale - gs) > 0.05) ground = Art.renderGround(gs);
    if (!mmBase) mmBase = renderMinimapBase();
  }
  function fitZoom(panel) {
    const w = vw - (panel ? Math.min(REPORT_W + 40, vw * 0.5) : 0) - 40;
    return clamp(Math.min(w / 2120, (vh - (panel ? 150 : 70)) / (panel ? 1300 : 1150)), 0.2, 1);
  }

  /* ============================================================ static drawables */
  const statics = [];
  const hulls = [];              // outlines on screen of buildings (roof included) and tall props: [footprint, polygon]
  (function buildStatics() {
    Wd.buildings.forEach((b) => {
      const extra = b.style === 'spire' ? 80 : b.style === 'church' ? 40 : b.style === 'dc' ? 20 : 30;
      const w0 = Wd.iso(b.x0, b.y1), e0 = Wd.iso(b.x1, b.y0), n0 = Wd.iso(b.x0, b.y0), s0 = Wd.iso(b.x1, b.y1);
      const up = b.h + extra * 0.6;
      hulls.push([b, [w0, { x: w0.x, y: w0.y - up }, { x: n0.x, y: n0.y - up }, { x: e0.x, y: e0.y - up }, e0, s0]]);
      statics.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, bx0: w0.x - 6, bx1: e0.x + 6, by0: n0.y - b.h - extra, by1: s0.y + 8, draw: (env) => Art.drawBuilding(ctx, b, env) });
    });
    Wd.props.forEach((p) => {
      const f = Art.propBox(p);
      const c = Wd.iso((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2);
      const w0 = Wd.iso(f.x0, f.y1), e0 = Wd.iso(f.x1, f.y0), n0 = Wd.iso(f.x0, f.y0), s0 = Wd.iso(f.x1, f.y1);
      const half = f.w || 0;
      if (f.h >= 48 && p.kind !== 'goal' && p.kind !== 'lamp') {
        const r = Math.max(half, 16);
        hulls.push([f, [{ x: c.x - r, y: c.y + 4 }, { x: c.x - r, y: c.y - f.h }, { x: c.x + r, y: c.y - f.h }, { x: c.x + r, y: c.y + 4 }]]);
      }
      statics.push({ x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1, bx0: Math.min(w0.x, c.x - half) - 16, bx1: Math.max(e0.x, c.x + half) + 16, by0: n0.y - f.h - 12, by1: s0.y + 6, draw: (env) => Art.drawProp(ctx, p, env) });
    });
  })();

  /* ============================================================ depth sorting */
  // Topological sort over items whose screen boxes overlap. a is behind b if it is fully on the far side in x or y.
  function behindCmp(a, b) {
    const aB = a.x1 <= b.x0 + 1e-3 || a.y1 <= b.y0 + 1e-3;
    const bB = b.x1 <= a.x0 + 1e-3 || b.y1 <= a.y0 + 1e-3;
    if (aB && !bB) return -1;
    if (bB && !aB) return 1;
    const da = a.x0 + a.x1 + a.y0 + a.y1, db = b.x0 + b.x1 + b.y0 + b.y1;
    return da <= db ? -1 : 1;
  }
  function depthSort(items) {
    items.sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0));
    const n = items.length;
    const deps = new Array(n);
    for (let i = 0; i < n; i++) deps[i] = [];
    for (let i = 0; i < n; i++) {
      const a = items[i];
      for (let j = i + 1; j < n; j++) {
        const b = items[j];
        if (a.bx1 < b.bx0 || b.bx1 < a.bx0 || a.by1 < b.by0 || b.by1 < a.by0) continue;
        if (behindCmp(a, b) < 0) deps[j].push(i); else deps[i].push(j);
      }
    }
    const out = [], st = new Uint8Array(n);
    const visit = (i) => { if (st[i]) return; st[i] = 1; const d = deps[i]; for (let k = 0; k < d.length; k++) visit(d[k]); out.push(items[i]); };
    for (let i = 0; i < n; i++) visit(i);
    return out;
  }

  /* ============================================================ input */
  const keys = new Set();
  const MOVE = { w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
  const openPanel = () => $$('.panel').find((p) => !p.hidden) || null;

  document.addEventListener('keydown', (e) => {
    if (!G || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const ae = document.activeElement;
    const onWorld = ae === cv || ae === document.body || !ae;
    if (k === 'm' && Snd) { toggleSound(); e.preventDefault(); return; }
    if (k === 'escape') {
      if (!$('#p-help').hidden) { closeHelp(); e.preventDefault(); return; }
      if (G.mode === 'intro') { skipIntro(); e.preventDefault(); return; }
      if (G.mode === 'talk') { endTalk(); e.preventDefault(); return; }
      if (G.mode === 'fact') { closeFact(); e.preventDefault(); return; }
      if (G.mode === 'notebook') { closeNotebook(); e.preventDefault(); return; }
      if (G.mode === 'file' && !G.fileForced) { closeFile(); e.preventDefault(); return; }
      return;
    }
    if (!$('#p-help').hidden) return;
    if (G.mode === 'intro') {
      // Enter / Space anywhere moves the messages on (the focused Next button handles its own keys)
      const onControl = ae && /^(BUTTON|A|INPUT|SUMMARY|SELECT|TEXTAREA|LABEL)$/.test(ae.tagName);
      if ((k === 'enter' || k === ' ') && !onControl) { introNext(); e.preventDefault(); }
      return;
    }
    if (G.mode === 'brief') {
      const wrap = $('#replies'), btns = wrap ? $$('.reply', wrap) : [];
      const i = btns.indexOf(ae), step = { arrowdown: 1, arrowright: 1, arrowup: -1, arrowleft: -1 }[k] || 0;
      if (step && btns.length && (ae === wrap || i >= 0)) {
        btns[ae === wrap ? (step > 0 ? 0 : btns.length - 1) : clamp(i + step, 0, btns.length - 1)].focus();
        e.preventDefault(); return;
      }
      if (k === 'enter' || k === ' ') {
        if (wrap && ae === wrap) { nudgeReplies(wrap); e.preventDefault(); }
        else if (ae === $('#ph-thread') || onWorld) { phFlush(); e.preventDefault(); }   // still typing: show the message now
      }
      return;
    }
    if (G.mode === 'play') {
      if (MOVE[k]) { keys.add(MOVE[k]); G.player.path = null; G.player.goal = null; e.preventDefault(); return; }
      if (k === 'e' || ((k === 'enter' || k === ' ') && onWorld)) { interact(); e.preventDefault(); return; }
      if (k === 'n') { openNotebook(); e.preventDefault(); return; }
      if (k === 'f') { openFile(false); e.preventDefault(); return; }
    } else if (G.mode === 'talk') {
      if (k === 'e' || ((k === 'enter' || k === ' ') && !(ae && ae.tagName === 'BUTTON'))) { advanceTalk(); e.preventDefault(); }
    } else if (G.mode === 'fact') {
      if (k === 'e') { closeFact(); e.preventDefault(); }
    } else if (G.mode === 'notebook') {
      if (k === 'n') { closeNotebook(); e.preventDefault(); }
    }
  });
  document.addEventListener('keyup', (e) => { const m = MOVE[e.key.toLowerCase()]; if (m) keys.delete(m); });
  window.addEventListener('blur', () => keys.clear());

  function screenToWorld(cx, cy) {
    const r = cv.getBoundingClientRect();
    return { x: (cx - r.left - vw / 2) / view.zoom + view.x, y: (cy - r.top - vh / 2) / view.zoom + view.y };
  }
  cv.addEventListener('click', (e) => {
    if (!G || G.mode !== 'play') return;
    cv.focus({ preventScroll: true });
    const w = screenToWorld(e.clientX, e.clientY);
    // a resident?
    let best = null, bd = 1e9;
    G.residents.forEach((p) => {
      const s = Wd.iso(p.x, p.y);
      if (w.x > s.x - 14 && w.x < s.x + 14 && w.y > s.y - 50 && w.y < s.y + 6) { const d = Math.abs(w.y - (s.y - 20)); if (d < bd) { bd = d; best = { kind: 'res', obj: p }; } }
    });
    if (!best) Wd.evidence.forEach((ev) => {
      const s = Wd.iso(ev.x, ev.y);
      if (Math.abs(w.x - s.x) < 16 && w.y > s.y - 76 && w.y < s.y + 10) best = { kind: 'ev', obj: ev };
    });
    if (!best) G.sheep.forEach((sh) => { const s = Wd.iso(sh.x, sh.y); if (Math.abs(w.x - s.x) < 14 && w.y > s.y - 22 && w.y < s.y + 5) best = { kind: 'sheep', obj: sh }; });
    const pl = G.player;
    if (best) {
      const o = best.obj;
      if (best.kind === 'res' && interviewed(o)) { toast(o.name + ' has already answered this story\'s question.'); return; }
      if (best.kind === 'res') { o.wait = Math.max(o.wait, 6); o.path = null; o.moving = false; }   // they spot you waving
      pl.goal = best;
      pl.tries = 0;
      pl.path = Wd.findPath(pl.x, pl.y, o.x, o.y) || null;
      if (inRange(best)) { pl.path = null; interactWith(best); pl.goal = null; }
      return;
    }
    const t = Wd.unIso(w.x, w.y);
    pl.goal = null;
    pl.path = Wd.findPath(pl.x, pl.y, t.x, t.y);
    if (pl.path) G.fx.push({ kind: 'ping', x: t.x, y: t.y, t0: G.t });
  });

  /* ============================================================ targets & interaction */
  const interviewed = (p) => { const st = story(); return !!(st && st.qid && st.interviews.some((i) => i.rid === p.id)); };
  function inRange(tg) {
    const pl = G.player, o = tg.obj;
    const d = Math.hypot(o.x - pl.x, o.y - pl.y);
    return d <= (tg.kind === 'res' ? TALK_RANGE : tg.kind === 'ev' ? FACT_RANGE : SHEEP_RANGE);
  }
  function findTarget() {
    const pl = G.player;
    let best = null, bd = 1e9;
    G.residents.forEach((p) => { if (interviewed(p)) return; const d = Math.hypot(p.x - pl.x, p.y - pl.y); if (d <= TALK_RANGE && d < bd) { bd = d; best = { kind: 'res', obj: p }; } });
    Wd.evidence.forEach((ev) => { const d = Math.hypot(ev.x - pl.x, ev.y - pl.y); if (d <= FACT_RANGE && d - 0.2 < bd) { bd = d - 0.2; best = { kind: 'ev', obj: ev }; } });
    if (!best) G.sheep.forEach((sh) => { const d = Math.hypot(sh.x - pl.x, sh.y - pl.y); if (d <= SHEEP_RANGE && d < bd) { bd = d; best = { kind: 'sheep', obj: sh }; } });
    return best;
  }
  function interact() { if (G.target) interactWith(G.target); }
  function interactWith(tg) {
    keys.clear();
    if (tg.kind === 'res') { if (interviewed(tg.obj)) { toast(tg.obj.name + ' has already answered this story\'s question.'); return; } startTalk(tg.obj); }
    else if (tg.kind === 'ev') openFact(tg.obj);
    else { toast('Baa. (Sheep weren\'t in the survey.)'); sayLine('sheep', 'Baa'); G.fx.push({ kind: 'bubble', x: tg.obj.x, y: tg.obj.y, t0: G.t, text: 'Baa' }); }
  }

  /* ============================================================ update */
  function updatePlayer(dt) {
    const pl = G.player;
    let ix = 0, iy = 0;
    if (keys.has('l')) ix -= 1; if (keys.has('r')) ix += 1; if (keys.has('u')) iy -= 1; if (keys.has('d')) iy += 1;
    pl.moving = false;
    if (ix || iy) {
      const l = Math.hypot(ix, iy);
      const dx = (ix / l) * SPEED_PX * dt, dy = (iy / l) * SPEED_PX * dt;
      const vx = dx / Wd.TW + dy / Wd.TH, vy = dy / Wd.TH - dx / Wd.TW;
      tryMove(pl, vx, vy);
      pl.dir = People.dirOf(vx, vy);
      pl.moving = true;
      pl.phase += dt * 11;
    } else if (pl.path && pl.path.length) {
      People.follow(pl, dt, 3.4);
      pl.phase += dt * 3.5;
      if (pl.goal && inRange(pl.goal)) { const g = pl.goal; pl.path = null; pl.goal = null; pl.moving = false; interactWith(g); return; }
      if (!pl.path.length) {
        pl.path = null;
        if (pl.goal) {
          const g = pl.goal;
          if (inRange(g)) { pl.goal = null; interactWith(g); }
          else if (g.kind === 'res' && (pl.tries = (pl.tries || 0) + 1) < 4) pl.path = Wd.findPath(pl.x, pl.y, g.obj.x, g.obj.y);
          else pl.goal = null;
        }
      }
    } else if (pl.goal) {
      if (inRange(pl.goal)) { const g = pl.goal; pl.goal = null; interactWith(g); }
      else pl.goal = null;
    }
    if (pl.moving) pl.moved = true;
    if (pl.moving && !reduced() && Math.random() < dt * 9) G.fx.push({ kind: 'dust', x: pl.x + (Math.random() - 0.5) * 0.2, y: pl.y + (Math.random() - 0.5) * 0.2, t0: G.t });
  }
  function tryMove(e, vx, vy) {
    if (Wd.free(e.x + vx, e.y + vy, PLAYER_R)) { e.x += vx; e.y += vy; return; }
    if (Wd.free(e.x + vx, e.y, PLAYER_R)) { e.x += vx; return; }
    if (Wd.free(e.x, e.y + vy, PLAYER_R)) { e.y += vy; }
  }

  function update(dt) {
    G.t += dt;
    const frozen = G.mode === 'crowd' || G.mode === 'report';
    if (!frozen) {
      G.residents.forEach((p) => People.updateResident(p, dt, G.aiRng));
      G.sheep.forEach((s) => People.updateSheep(s, dt, G.aiRng));
    }
    if (G.mode === 'play') {
      updatePlayer(dt);
      if (!G.relaxed) {
        G.clock += dt / SEC_PER_MIN;
        if (!G.warned && STORY_MIN - G.clock <= 20) { G.warned = true; toast('On air in 20 min.'); announce('On air in 20 minutes.'); }
        if (G.clock >= STORY_MIN) { G.clock = STORY_MIN; openFile(true); }
      }
      const tg = findTarget();
      if (!sameTarget(tg, G.target)) { G.target = tg; showTalkButton(); }
      if (tg && tg.kind === 'res') {
        // someone you walk up to stops and turns to you
        const p = tg.obj;
        if (p.wait < 1.2) p.wait = 1.2;
        p.path = null; p.moving = false;
        p.dir = People.dirOf(G.player.x - p.x, G.player.y - p.y);
      }
      updateClock();
    }
    // camera
    const pl = G.player, ps = Wd.iso(pl.x, pl.y);
    const intro = G.mode === 'intro' || G.mode === 'brief';
    if (intro) {
      const c = camTarget();
      view.tz = c.z; view.tx = c.x; view.ty = c.y;
    } else if (G.mode === 'crowd' || G.mode === 'report' || G.mode === 'end') {
      const side = G.mode === 'report' && vw > 900;
      const z = fitZoom(side);
      view.tz = z;
      view.tx = MAP_C.x + (side ? (Math.min(REPORT_W + 40, vw * 0.5) / 2) / z : 0);
      view.ty = MAP_C.y - (side ? 60 : 110);
    } else {
      view.tz = baseZoom;
      view.tx = ps.x; view.ty = ps.y - 20 + (G.mode === 'talk' ? vh * 0.2 / baseZoom : 0);
    }
    // the intro glides calmly between places; with reduced motion it cuts instead
    const rate = G.mode === 'crowd' ? 2.2 : intro ? 1.5 : G.t < G.glideUntil ? 2.4 : 5;
    const k = reduced() && G.mode !== 'play' ? 1 : 1 - Math.exp(-dt * rate);
    view.x += (view.tx - view.x) * k; view.y += (view.ty - view.y) * k;
    if (intro && view.zoom > 0 && view.tz > 0) view.zoom = Math.exp(Math.log(view.zoom) + (Math.log(view.tz) - Math.log(view.zoom)) * k);
    else view.zoom += (view.tz - view.zoom) * k;
    G.fx = G.fx.filter((f) => G.t - f.t0 < (f.kind === 'bubble' ? 1.6 : f.kind === 'ping' ? 0.7 : 0.6));
    if (G.crowd) updateCrowd();
  }
  const sameTarget = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.obj === b.obj);

  /* ============================================================ render */
  function eveningNow() {
    if (!G || G.story < 0) return 0.05;
    const st = story();
    if (G.story === 2) return clamp(0.4 + 0.6 * (G.clock / STORY_MIN), 0, 1);
    return st && G.story === 1 ? 0.08 : 0;
  }
  const bgCache = { key: null, fill: null };
  function render() {
    const env = { t: G.t, reduced: reduced(), evening: eveningNow() };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bgKey = cv.height + (env.evening > 0.5 ? 'e' : 'd');
    if (bgCache.key !== bgKey) {
      const bg = ctx.createLinearGradient(0, 0, 0, cv.height);
      bg.addColorStop(0, env.evening > 0.5 ? '#B7C4D6' : '#D5E8E7');
      bg.addColorStop(1, env.evening > 0.5 ? '#7E8DB0' : '#9CC7CB');
      bgCache.key = bgKey; bgCache.fill = bg;
    }
    ctx.fillStyle = bgCache.fill;
    ctx.fillRect(0, 0, cv.width, cv.height);
    const z = view.zoom * dpr;
    const ox = cv.width / 2 - view.x * z, oy = cv.height / 2 - view.y * z;
    ctx.setTransform(z, 0, 0, z, ox, oy);
    // sea ripples around the island
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const k = ((G.t * (env.reduced ? 0 : 0.08) + i / 3) % 1);
      ctx.globalAlpha = 0.6 * (1 - k);
      ctx.beginPath();
      const pad = 30 + k * 120;
      const n = Wd.iso(0, 0), e = Wd.iso(Wd.W, 0), s = Wd.iso(Wd.W, Wd.H), w = Wd.iso(0, Wd.H);
      ctx.moveTo(n.x, n.y - pad); ctx.lineTo(e.x + pad * 2, e.y); ctx.lineTo(s.x, s.y + pad + 44); ctx.lineTo(w.x - pad * 2, w.y); ctx.closePath(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // visible area in world px
    const L = view.x - vw / 2 / view.zoom - 60, R = view.x + vw / 2 / view.zoom + 60, T = view.y - vh / 2 / view.zoom - 60, B = view.y + vh / 2 / view.zoom + 260;
    // only copy the part of the pre-rendered ground that is on screen
    const g = ground, gw = g.canvas.width, gh = g.canvas.height;
    const sx0 = clamp(Math.floor((L + 60 - g.ox) * g.scale), 0, gw), sy0 = clamp(Math.floor((T + 60 - g.oy) * g.scale), 0, gh);
    const sx1 = clamp(Math.ceil((R - 60 - g.ox) * g.scale), 0, gw), sy1 = clamp(Math.ceil((B - 260 - g.oy) * g.scale), 0, gh);
    if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(g.canvas, sx0, sy0, sx1 - sx0, sy1 - sy0, g.ox + sx0 / g.scale, g.oy + sy0 / g.scale, (sx1 - sx0) / g.scale, (sy1 - sy0) / g.scale);
    waterGlints(env);

    const vis = (it) => !(it.bx1 < L || it.bx0 > R || it.by1 < T || it.by0 > B);
    const items = statics.filter(vis);
    const hideRes = G.crowd ? clamp(1 - (G.t - G.crowd.t0) / 0.6, 0, 1) : 1;
    if (hideRes > 0) G.residents.forEach((p) => items.push(personItem(p, env, hideRes)));
    G.sheep.forEach((s) => items.push(sheepItem(s, env)));
    items.push(playerItem(env));
    if (G.crowd) G.crowd.figs.forEach((f) => { if (f.k > 0) items.push(f.item); });
    const sorted = depthSort(items.filter(vis));
    for (let i = 0; i < sorted.length; i++) sorted[i].draw(env);

    // effects on the ground/air
    G.fx.forEach((f) => {
      const s = Wd.iso(f.x, f.y), k = (G.t - f.t0);
      if (f.kind === 'dust') Art.dust(ctx, s.x, s.y - 2, k / 0.6);
      else if (f.kind === 'ping') { ctx.strokeStyle = 'rgba(36,28,23,' + (0.6 * (1 - k / 0.7)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, 6 + k * 24, 3 + k * 12, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (f.kind === 'bubble') { Art.nameTag(ctx, s.x, s.y - 24 - k * 8, f.text); }
      else if (f.kind === 'pop') { const kk = clamp(k / 0.35, 0, 1); Art.badge(ctx, s.x, s.y - 58 - kk * 6, f.cat, 1 + (1 - kk) * 0.8); }
    });

    const early = G.mode === 'intro' || G.mode === 'boot';
    if (!early && G.mode !== 'end' && !G.crowd) overlays(env);
    if (G.mode === 'intro' || G.mode === 'brief') introOverlays(env);
    lighting(env, z, ox, oy);
    if (!early && G.mode !== 'brief' && G.mode !== 'crowd' && G.mode !== 'report' && G.mode !== 'end') drawMinimap();
  }

  function waterGlints(env) {
    if (env.reduced) return;
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 18; i++) {
      const y = (i * 1.77 + G.t * 0.9) % Wd.H;
      const x = 9.2 + ((i * 7) % 16) / 10;
      const s = Wd.iso(x, y);
      ctx.fillRect(s.x - 3, s.y, 6, 1.2);
    }
  }

  function personItem(p, env, alpha) {
    const s = Wd.iso(p.x, p.y);
    return {
      x0: p.x - 0.2, y0: p.y - 0.2, x1: p.x + 0.2, y1: p.y + 0.2, bx0: s.x - 14, bx1: s.x + 14, by0: s.y - 52, by1: s.y + 6,
      draw: () => Art.drawPerson(ctx, s.x, s.y, p.look, { dir: p.dir, phase: p.phase, moving: p.moving, reduced: env.reduced, alpha }),
    };
  }
  function sheepItem(sh, env) {
    const s = Wd.iso(sh.x, sh.y);
    return { x0: sh.x - 0.25, y0: sh.y - 0.25, x1: sh.x + 0.25, y1: sh.y + 0.25, bx0: s.x - 16, bx1: s.x + 16, by0: s.y - 24, by1: s.y + 6, draw: () => Art.drawSheep(ctx, s.x, s.y, sh, env) };
  }
  const REPORTER = { skin: '#E8B896', hair: '#5A3A22', hairStyle: 'short', top: '#FFC933', bottom: '#2E3440', reporter: true };
  function playerItem(env) {
    const pl = G.player, s = Wd.iso(pl.x, pl.y);
    return {
      x0: pl.x - 0.2, y0: pl.y - 0.2, x1: pl.x + 0.2, y1: pl.y + 0.2, bx0: s.x - 16, bx1: s.x + 16, by0: s.y - 54, by1: s.y + 8,
      draw: () => {
        // "you are here" ring
        const k = env.reduced ? 0.5 : (Math.sin(G.t * 3) + 1) / 2;
        ctx.strokeStyle = 'rgba(255,201,51,' + (0.55 + k * 0.35) + ')'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, 13 + k * 2, 6.5 + k, 0, 0, Math.PI * 2); ctx.stroke();
        Art.drawPerson(ctx, s.x, s.y, REPORTER, { dir: pl.dir, phase: pl.phase, moving: pl.moving, reduced: env.reduced });
      },
    };
  }

  function overlays(env) {
    const st = story();
    const relevant = new Set(st && st.qid ? Sim.Q[st.qid].facts : []);
    // evidence markers
    Wd.evidence.forEach((ev) => {
      const s = Wd.iso(ev.x, ev.y);
      const near = G.target && G.target.kind === 'ev' && G.target.obj === ev;
      Art.evidenceMarker(ctx, s.x, s.y, G.t, G.visited.has(ev.id), near || ev.facts.some((f) => relevant.has(f)), env.reduced);
    });
    // badges over interviewed residents
    if (st && st.qid) st.interviews.forEach((iv) => {
      const p = G.residents[iv.rid];
      if (!p) return;
      const s = Wd.iso(p.x, p.y);
      Art.badge(ctx, s.x, s.y - 56, iv.idx < 0 ? 'none' : Sim.isYes(st.qid, iv.idx) ? 'yes' : 'no', 1);
    });
    // prompt over the current target
    if (G.mode === 'play' && G.target) {
      const o = G.target.obj, s = Wd.iso(o.x, o.y);
      if (G.target.kind === 'res') { Art.keycap(ctx, s.x, s.y - 66, 'E', G.t, env.reduced); Art.nameTag(ctx, s.x, s.y - 80, o.name, Sim.D[o.district].name + ' · made-up resident'); }
      else if (G.target.kind === 'ev') { Art.keycap(ctx, s.x, s.y - 90, 'E', G.t, env.reduced); Art.nameTag(ctx, s.x, s.y - 104, o.name, G.visited.has(o.id) ? 'Data · read already' : 'Data · takes ' + COST_FACT + ' min'); }
      else Art.keycap(ctx, s.x, s.y - 30, 'E', G.t, env.reduced);
    }
    // the resident you're talking to
    if (G.mode === 'talk' && G.talk) { const p = G.talk.res, s = Wd.iso(p.x, p.y); Art.nameTag(ctx, s.x, s.y - 64, '…'); }
    // before the very first interview: "that's you" until you move, and an arrow over someone to talk to
    if (G.mode === 'play' && !G.taught.next && st && st.qid) {
      if (!G.player.moved) youRing(env, !G.target);
      if (!(G.target && G.target.kind === 'res')) {
        const p = guidePick();
        if (p) { const s = Wd.iso(p.x, p.y); feetRing(s.x, s.y, 12, 6, 2); guideArrow(s.x, s.y - 58, env); }
      }
    }
  }
  /** Is this resident (mostly) hidden behind a building or a tree from where the camera looks? */
  function hiddenBehind(p) {
    const s = Wd.iso(p.x, p.y);
    return hulls.some(([b, h]) => (p.x + 0.2 <= b.x0 || p.y + 0.2 <= b.y0) && (inHull(h, s.x, s.y - 4) || inHull(h, s.x, s.y - 26)));
  }
  function inHull(h, x, y) {
    let sign = 0;
    for (let i = 0; i < h.length; i++) {
      const a = h[i], b = h[(i + 1) % h.length];
      const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (c) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
    }
    return true;
  }
  /** The first-walk arrow points at a nearby resident you can see (re-checked twice a second, so it doesn't flicker). */
  function guidePick() {
    const pl = G.player, gd = G.guide;
    const cands = G.residents.filter((p) => !p.talking && !interviewed(p))
      .map((p) => ({ p, d: Math.hypot(p.x - pl.x, p.y - pl.y) })).sort((a, b) => a.d - b.d);
    if (!cands.length) return null;
    const cur = gd ? cands.find((c) => c.p.id === gd.id) : null;
    if (cur && G.t < gd.until) return cur.p;
    const open = cands.filter((c) => c.d <= cands[0].d + 4 && !hiddenBehind(c.p));
    let pick = open.length ? open[0] : cands[0];
    if (cur && open.includes(cur) && cur.d <= pick.d + 1.5) pick = cur;
    G.guide = { id: pick.p.id, until: G.t + 0.5 };
    return pick.p;
  }
  function feetRing(x, y, rx, ry, lw) {
    ctx.save();
    ctx.strokeStyle = 'rgba(36,28,23,.5)'; ctx.lineWidth = lw + 2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#FFC933'; ctx.lineWidth = lw; ctx.stroke();
    ctx.restore();
  }
  /** "That's you": a ring at the reporter's feet, drawn over the bus stop so it can't hide. */
  function youRing(env, tag) {
    const s = Wd.iso(G.player.x, G.player.y), k = env.reduced ? 0.5 : (Math.sin(G.t * 3) + 1) / 2;
    feetRing(s.x, s.y, 17 + k * 3, 8.5 + k * 1.5, 3);
    if (tag) Art.nameTag(ctx, s.x, s.y - 60, 'You', 'the reporter');
  }
  function guideArrow(x, y, env) {
    const b = env.reduced ? 0 : Math.abs(Math.sin(G.t * 3.2)) * -7;
    ctx.save();
    ctx.translate(x, y + b);
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-10, -15); ctx.lineTo(10, -15); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = '#FFC933'; ctx.strokeStyle = '#241C17'; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* ============================================================ intro overlays (drawn over the town) */
  // The planned new hall: a dashed outline between the campus fence and Main Street (decoration only).
  const NEW_HALL = { x0: 18.3, y0: 8.3, x1: 21.7, y1: 10.8, h: 70 };
  function introOverlays(env) {
    const b = G.introBeat, inIntro = G.mode === 'intro';
    if (inIntro && b === 0) youRing(env, true);
    if ((inIntro && b >= 1) || (G.mode === 'brief' && G.story === 0)) ghostHall(env, inIntro && b === 1);
    if (inIntro && b === 2) G.chatty.forEach((id) => { const p = G.residents[id]; if (p) { const s = Wd.iso(p.x, p.y); Art.nameTag(ctx, s.x, s.y - 58, '…'); } });
  }
  function ghostHall(env, label) {
    const g = env.reduced ? 1 : clamp((G.t - G.hallT) / 1.1, 0, 1);
    const h = NEW_HALL.h * (1 - Math.pow(1 - g, 3));
    const n = Wd.iso(NEW_HALL.x0, NEW_HALL.y0), e = Wd.iso(NEW_HALL.x1, NEW_HALL.y0), s = Wd.iso(NEW_HALL.x1, NEW_HALL.y1), w = Wd.iso(NEW_HALL.x0, NEW_HALL.y1);
    const up = (p) => ({ x: p.x, y: p.y - h });
    const face = (pts, fill) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    ctx.save();
    face([n, e, s, w], 'rgba(255,201,51,.22)');
    face([w, s, up(s), up(w)], 'rgba(255,201,51,.16)');
    face([s, e, up(e), up(s)], 'rgba(255,201,51,.10)');
    face([up(n), up(e), up(s), up(w)], 'rgba(255,255,255,.28)');
    const edges = () => {
      ctx.beginPath();
      [n, e, s, w].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      [n, e, s, w].map(up).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      [w, s, e].forEach((p) => { ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - h); });
      ctx.stroke();
    };
    const lw = Math.max(2.2, 1.8 / view.zoom);
    ctx.setLineDash([7, 5]);
    ctx.lineDashOffset = env.reduced ? 0 : -G.t * 16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(36,28,23,.6)'; ctx.lineWidth = lw + 2.4; edges();
    ctx.strokeStyle = '#FFC933'; ctx.lineWidth = lw; edges();
    ctx.restore();
    if (label && g >= 1) Art.nameTag(ctx, (w.x + e.x) / 2, n.y - h - 8, 'New data hall?', 'planning application');
  }
  function chattyResidents() {
    const c = { x: 17.5, y: 15.5 };
    return G.residents.filter((p) => p.district === 'urban')
      .map((p) => [Math.hypot(p.x - c.x, p.y - c.y), p.id]).sort((a, b) => a[0] - b[0]).slice(0, 4).map((p) => p[1]);
  }

  function lighting(env, z, ox, oy) {
    const e = env.evening;
    if (e <= 0.02) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = Art.mix('#FFFFFF', e > 0.6 ? '#A99BD0' : '#F3C8A4', clamp(e * 0.85, 0, 0.8));
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.restore();
    if (e > 0.45) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = clamp((e - 0.45) * 1.4, 0, 0.55);
      Wd.props.forEach((p) => {
        if (p.kind !== 'lamp') return;
        const s = Wd.iso(p.x + 0.5, p.y + 0.5);
        const g = ctx.createRadialGradient(s.x, s.y - 30, 2, s.x, s.y - 10, 60);
        g.addColorStop(0, 'rgba(255,214,140,' + a + ')');
        g.addColorStop(1, 'rgba(255,214,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(s.x - 60, s.y - 80, 120, 110);
      });
      ctx.restore();
    }
  }

  /* ============================================================ minimap */
  const MM_S = 190 / ((Wd.W + Wd.H) * Wd.TW / 2);
  function renderMinimapBase() {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 110;
    const x = c.getContext('2d');
    x.translate(100, 6);
    x.scale(MM_S, MM_S);
    const col = { grass: '#8CC063', heather: '#9AA56C', road: '#6B7277', pave: '#D7D1C5', water: '#4A9CC0', bridge: '#B6AC9C', field: '#A4CB72', crop: '#B39B64', bog: '#7A5C40', concrete: '#CDD3D7', pitch: '#74C458', dirt: '#C4A776' };
    for (let y = 0; y < Wd.H; y++) for (let xx = 0; xx < Wd.W; xx++) {
      const a = Wd.iso(xx, y), b = Wd.iso(xx + 1, y), cc = Wd.iso(xx + 1, y + 1), d = Wd.iso(xx, y + 1);
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(cc.x, cc.y); x.lineTo(d.x, d.y); x.closePath();
      x.fillStyle = col[Wd.ground[y][xx]] || '#8CC063'; x.fill();
    }
    Wd.buildings.forEach((bd) => {
      const a = Wd.iso(bd.x0, bd.y0), b = Wd.iso(bd.x1, bd.y0), cc = Wd.iso(bd.x1, bd.y1), d = Wd.iso(bd.x0, bd.y1);
      x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.lineTo(cc.x, cc.y); x.lineTo(d.x, d.y); x.closePath();
      x.fillStyle = bd.style === 'dc' ? '#EEF2F5' : '#5B524B'; x.fill();
    });
    return c;
  }
  let mmTick = 0;
  function drawMinimap() {
    if ((mmTick++ % 3) !== 0) return;
    mmx.setTransform(1, 0, 0, 1, 0, 0);
    mmx.clearRect(0, 0, 200, 110);
    mmx.drawImage(mmBase, 0, 0);
    mmx.translate(100, 6);
    const pt = (x, y) => { const s = Wd.iso(x, y); return [s.x * MM_S, s.y * MM_S]; };
    Wd.evidence.forEach((ev) => { const p = pt(ev.x, ev.y); mmx.fillStyle = G.visited.has(ev.id) ? '#FFFFFF' : '#00727C'; mmx.strokeStyle = '#00727C'; mmx.beginPath(); mmx.moveTo(p[0], p[1] - 4); mmx.lineTo(p[0] + 4, p[1]); mmx.lineTo(p[0], p[1] + 4); mmx.lineTo(p[0] - 4, p[1]); mmx.closePath(); mmx.fill(); mmx.stroke(); });
    G.residents.forEach((r) => { const p = pt(r.x, r.y); mmx.fillStyle = interviewed(r) ? '#9B3D8F' : '#241C17'; mmx.beginPath(); mmx.arc(p[0], p[1], interviewed(r) ? 2.2 : 1.6, 0, Math.PI * 2); mmx.fill(); });
    const p = pt(G.player.x, G.player.y);
    mmx.fillStyle = '#FFC933'; mmx.strokeStyle = '#241C17'; mmx.lineWidth = 1.5; mmx.beginPath(); mmx.arc(p[0], p[1], 4, 0, Math.PI * 2); mmx.fill(); mmx.stroke();
  }

  /* ============================================================ loop */
  // If a machine can't keep up (e.g. a Retina screen without GPU canvas), render at a lower resolution.
  let last = 0;
  const perf = { acc: 0, n: 0 };
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    try { update(dt); render(); } catch (err) { console.error(err); }
    perf.acc += dt; perf.n++;
    if (perf.acc > 2.5) {
      if (perf.acc / perf.n > 0.028 && dpr > 1 && !document.hidden) { dprCap = Math.max(1, dpr - 0.5); resize(); }
      perf.acc = 0; perf.n = 0;
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================ UI helpers */
  function show(id, on) { const el = $(id); if (el) el.hidden = !on; }
  function hideAllPanels(keep) { document.body.classList.remove('interviewing'); $$('.panel').forEach((p) => { if (p.id !== 'p-help' && p.id !== keep) p.hidden = true; }); }
  function focusIn(el) {
    const f = el.querySelector('[data-autofocus]') || el.querySelector('h1[tabindex],h2[tabindex]') || el.querySelector('button, [href], input');
    if (f) grab(f);
  }
  function focusWorld() { grab(cv); }
  /** Move focus soon - unless "How this works" is open over the game: then focus goes there when it closes. */
  function grab(el) {
    setTimeout(() => {
      if (!document.body.contains(el)) return;
      const help = $('#p-help');
      if (!help.hidden && !help.contains(el)) { helpReturn = el; return; }
      el.focus({ preventScroll: true });
    }, 30);
  }
  let toastT = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  let annT = null;
  function announce(msg) { clearTimeout(annT); annT = setTimeout(() => { $('#announcer').textContent = msg; }, 60); }
  /**
   * The HUD arrives a piece at a time on the first story: story, clock and "File story" first;
   * the tally once you have an answer; notebook and minimap after your first interview or data point.
   */
  function setHud(on) {
    show('#story-chip', on); show('#clock', on); show('#actions', on);
    show('#tally', on && G.taught.opinion);
    show('#minimap-wrap', on && G.taught.hud && vw > 700);
    show('#btn-notebook', G.taught.hud);
    if (!on) coach(null);
  }
  /** After an interview or a data point: show everything the player has met so far (safe to call again). */
  function revealHud() {
    G.taught.hud = true;
    setHud(true);
  }
  /** While a panel is open during reporting, the walk-around buttons step aside. */
  function playHud(on) {
    document.body.classList.toggle('interviewing', !on && G.mode === 'talk');
    show('#actions', on);
    if (!on) $('#coach').hidden = true;
    else if (G.mode === 'play' && !G.taught.next) coach(COACH.first);
  }
  /** A short note from your editor at the top of the screen while you walk. */
  const COACH = {
    first: 'Find someone to interview: walk with <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> or click, then press <kbd>E</kbd>.',
    next: 'Nice! Ask a few more people, then press <kbd>F</kbd> to file your story.',
  };
  let coachT = null;
  function coach(html, secs) {
    const c = $('#coach');
    clearTimeout(coachT);
    if (!html) { c.hidden = true; c.dataset.msg = ''; return; }
    const same = !c.hidden && c.dataset.msg === html;
    c.dataset.msg = html;
    $('#coach-text').innerHTML = html;
    c.hidden = false;
    if (!same) { c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); }
    if (secs) coachT = setTimeout(() => { c.hidden = true; c.dataset.msg = ''; }, secs * 1000);
  }
  function showTalkButton() {
    const b = $('#btn-talk'), tg = G.target;
    if (!tg || G.mode !== 'play') { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = tg.kind === 'res' ? 'Interview ' + esc(tg.obj.name) + ' <kbd>E</kbd>' : tg.kind === 'ev' ? 'Read: ' + esc(tg.obj.name) + ' <kbd>E</kbd>' : 'Talk to the sheep <kbd>E</kbd>';
    if (tg.kind === 'res') announce(tg.obj.name + ' is nearby. Press E to interview.');
    else if (tg.kind === 'ev') announce(tg.obj.name + ' nearby. Press E to read the data.');
  }
  function updateClock() {
    const st = story();
    if (!st) return;
    const slot = st.slot;
    if (G.relaxed) {
      $('#onair-light').textContent = 'No deadline';
      $('#clock-time').textContent = hhmm(slot.start + G.clock);
      $('#clock-left').textContent = 'file when ready';
      $('#clock').classList.remove('hurry');
      $('#clock').style.setProperty('--left', 1);
    } else {
      const left = STORY_MIN - G.clock;
      $('#onair-light').textContent = 'On air in';
      $('#clock-time').textContent = Math.max(0, Math.ceil(left)) + ' min';
      $('#clock-left').textContent = '';
      $('#clock').classList.toggle('hurry', left <= 20);
      $('#clock').style.setProperty('--left', clamp(left / STORY_MIN, 0, 1));
    }
  }

  /* ============================================================ story model */
  function tallyOf(st) {
    const q = S.q(st.qid);
    const counts = q.options.map(() => 0);
    let yes = 0, k = 0, decl = 0;
    const by = {};
    Sim.DISTRICTS.forEach((d) => { by[d.key] = { asked: 0, k: 0, yes: 0 }; });
    st.interviews.forEach((iv) => {
      const b = by[iv.d];
      b.asked++;
      if (iv.idx < 0) { decl++; return; }
      counts[iv.idx]++; k++; b.k++;
      if (Sim.isYes(st.qid, iv.idx)) { yes++; b.yes++; }
    });
    return { counts, yes, k, decl, asked: st.interviews.length, pct: k ? (100 * yes) / k : null, by };
  }

  function renderTally() {
    const st = story();
    const el = $('#tally');
    if (!st || !st.qid) { el.innerHTML = ''; return; }
    const q = S.q(st.qid), t = tallyOf(st);
    const max = Math.max(1, ...t.counts);
    el.innerHTML =
      '<p class="t-head">' + CHIP.opinion + '<span>Your vox pop</span></p>' +
      '<p class="t-q">' + esc(Sim.Q[st.qid].title) + ' <span class="mono">q' + esc(st.qid.slice(1)) + '</span></p>' +
      '<ol class="t-bars">' + q.options.map((o, i) => {
        const yes = Sim.isYes(st.qid, i);
        return '<li class="' + (yes ? 'yes' : 'no') + '" data-opt="' + i + '"><span class="t-l">' + esc(o.short || o.label) + '</span><span class="t-b"><i style="width:' + (100 * t.counts[i] / max) + '%"></i></span><span class="t-n">' + t.counts[i] + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="t-sum">' + (t.k ? '<b>' + t.yes + ' of ' + t.k + '</b> = <b>' + pc(t.pct) + '</b> ' + esc(Sim.measureText(st.qid)) : 'Nobody asked yet. Walk up to someone and press <kbd>E</kbd>.') + (t.decl ? ' · ' + t.decl + ' declined' : '') + '</p>' +
      '<p class="t-where">' + Sim.DISTRICTS.map((d) => esc(d.short) + ' <b>' + t.by[d.key].asked + '</b>').join(' · ') + '</p>';
  }

  /* ============================================================ the phone: messages from your editor */
  // The intro is a few one-sentence messages; each story's brief arrives in the same thread.
  const EDITOR = { skin: '#E4B08E', hair: '#B9B1A8', hairStyle: 'bun', top: '#9B3D8F', bottom: '#2E3440' };
  const BEATS = [
    { cam: 'reporter', text: () => 'Morning! You\'re our street reporter today.' },
    { cam: 'hall', text: () => 'The town\'s data centre wants another hall.' },
    { cam: 'street', text: () => 'Ask a few people, then guess what the whole town thinks.' },
    { cam: 'town', text: () => 'Later, we\'ll check your guess against the real survey of ' + S.n + ' people.' },
  ];
  // one line per story brief (falls back to the long editor note in sim.js)
  const BRIEF_LINE = {
    1: 'First up: the new hall. What will you ask?',
    2: 'Lunchtime story: life online. What will you ask?',
    3: 'Top story at six: where is the town heading? What will you ask?',
  };

  const PH = { timers: [], pending: null };
  function phClear() { PH.timers.forEach(clearTimeout); PH.timers = []; PH.pending = null; }
  function phOpen(minutes) {
    phClear();
    $('#ph-thread').innerHTML = '';
    $('#ph-foot').innerHTML = '';
    $('#ph-time').textContent = hhmm(minutes);
    $('#p-phone').hidden = false;
  }
  function phScroll() { const t = $('#ph-thread'); t.scrollTop = t.scrollHeight; }
  function phAdd(html, cls) {
    const m = document.createElement('div');
    m.className = 'msg' + (cls ? ' ' + cls : '');
    m.innerHTML = html;
    $('#ph-thread').appendChild(m);
    phScroll();
    return m;
  }
  /** The editor says something: a typing indicator first, then the message (instant with reduced motion). */
  function phSay(html, instant, done) {
    phFlush();
    if (instant || G.debug || reduced()) { phAdd(html, 'ed'); if (done) done(); return; }
    const m = phAdd('<i></i><i></i><i></i>', 'ed typing');
    m.setAttribute('aria-hidden', 'true');
    PH.pending = { m, html, done };
    PH.timers.push(setTimeout(phFlush, clamp(360 + html.length * 9, 620, 1050)));
  }
  /** Show the message that is being typed right now. Returns false if nothing was being typed. */
  function phFlush() {
    const p = PH.pending;
    if (!p) return false;
    PH.pending = null;
    p.m.remove();
    phAdd(p.html, 'ed in');
    if (p.done) p.done();
    return true;
  }

  /* ============================================================ camera during the intro and briefs */
  /** Where the free part of the screen is centred, relative to the viewport centre (the phone covers the rest). */
  function phoneShift() {
    const el = $('#p-phone');
    if (!el || el.hidden) return { sx: 0, sy: 0 };
    const l = el.offsetLeft, w = el.offsetWidth, t = el.offsetTop;
    if (w < vw * 0.6) return { sx: (l + w) / 2, sy: 0 };
    return { sx: 0, sy: (60 + t) / 2 - vh / 2 };
  }
  function townZoom() {
    const sh = G.camShift;
    const availW = sh.sx ? vw - 2 * sh.sx - 30 : vw - 24;
    const availH = sh.sy ? vh + 2 * sh.sy - 70 : vh - 90;
    return clamp(Math.min(availW / 1680, availH / 1020), 0.2, 1);
  }
  function camSpot(name) {
    if (name === 'reporter') { const s = Wd.iso(G.player.x, G.player.y); return { x: s.x, y: s.y - 34, z: baseZoom * 1.35 }; }
    if (name === 'hall') { const s = Wd.iso(24, 7.4); return { x: s.x, y: s.y - 34, z: baseZoom * 0.9 }; }
    if (name === 'street') { const s = Wd.iso(17.2, 15.4); return { x: s.x, y: s.y - 24, z: baseZoom * 1.15 }; }
    return { x: MAP_C.x, y: MAP_C.y - 80, z: townZoom() };
  }
  function camTarget() {
    const c = camSpot(G.cam), sh = G.camShift;
    return { x: c.x - sh.sx / c.z, y: c.y - sh.sy / c.z, z: c.z };
  }
  function setCam(name, snap) {
    G.cam = name;
    G.camShift = phoneShift();
    if (snap) { const c = camTarget(); view.x = c.x; view.y = c.y; view.zoom = c.z; }
  }

  /* ============================================================ flow: intro */
  /** upTo = null plays the intro from the start; a number shows beats 0..upTo at once (debug screens). */
  function showIntro(upTo) {
    G.mode = 'intro';
    G.introSkipped = false;
    hideAllPanels();
    setHud(false);
    $('#onair-banner').hidden = true;
    phOpen(Sim.SLOTS[0].start);
    // the top of a new conversation: the game's name (it scrolls away as the messages arrive)
    const hello = document.createElement('div');
    hello.className = 'ph-hello';
    hello.innerHTML = '<svg viewBox="0 0 24 24" width="52" height="52" aria-hidden="true"><rect x="9.2" y="12" width="5.6" height="10.5" rx="2" fill="#241C17"/><circle cx="12" cy="8" r="6.6" fill="#9B3D8F"/><path d="M7.4 6.4h9.2M6.6 8.6h10.8M7.4 10.8h9.2" stroke="#fff" stroke-opacity=".35" stroke-width=".9"/><circle cx="9.8" cy="5.6" r="1.7" fill="#fff" opacity=".55"/></svg>' +
      '<p class="ph-title">Vox Pop</p>';
    $('#ph-thread').appendChild(hello);
    G.introBeat = -1;
    G.locked = false;
    if (upTo == null || upTo < 0) {
      setCam('town', true);      // open on the whole town; the first message waits for "Open"
      showLock();
    } else {
      introFoot();
      for (let i = 0; i <= upTo && i < BEATS.length; i++) beat(i, true);
      setCam(G.cam, true);
    }
    focusIn($('#p-phone'));
  }
  function introFoot() {
    $('#ph-foot').innerHTML =
      '<button class="btn primary" type="button" id="ph-next" data-autofocus>Next <span aria-hidden="true">→</span></button>' +
      '<button class="btn ghost small" type="button" id="ph-skip">Skip intro</button>';
    $('#ph-next').addEventListener('click', introNext);
    $('#ph-skip').addEventListener('click', skipIntro);
  }
  /** Before the first message: a new-message notice and one button. Browsers only start sound after a tap or key, and this is it. */
  function showLock() {
    G.locked = true;
    const n = document.createElement('p');
    n.className = 'ph-new';
    n.id = 'ph-new';
    n.innerHTML = '<i aria-hidden="true"></i>1 new message';
    $('#ph-thread').appendChild(n);
    $('#ph-foot').innerHTML =
      '<button class="btn primary" type="button" id="ph-open" data-autofocus>Open <span aria-hidden="true">→</span></button>' +
      '<button class="btn ghost small" type="button" id="ph-skip">Skip intro</button>';
    $('#ph-open').addEventListener('click', openLock);
    $('#ph-skip').addEventListener('click', skipIntro);
  }
  function openLock() {
    if (G.mode !== 'intro' || !G.locked) return;
    G.locked = false;
    if (Snd) Snd.unlock();
    const n = $('#ph-new');
    if (n) n.remove();
    introFoot();
    grab($('#ph-next'));
    introNext();
  }
  function beat(b, instant) {
    G.introBeat = b;
    const B = BEATS[b];
    if (B.cam === 'hall') G.hallT = instant ? -99 : G.t;
    if (B.cam === 'street') G.chatty = chattyResidents();
    setCam(B.cam);
    const t = B.text();
    phSay(esc(t), instant, instant ? null : () => sayLine('editor', t));
  }
  function introNext() {
    if (G.mode !== 'intro') return;
    if (G.locked) { openLock(); return; }
    if (phFlush()) return;                  // still typing: show that message first
    const b = G.introBeat + 1;
    if (b >= BEATS.length) { endIntro(); return; }
    beat(b, false);
  }
  function endIntro() { G.story = -1; nextStory(); }
  function skipIntro() {
    if (G.mode !== 'intro') return;
    phClear();
    G.introSkipped = true;
    G.story = -1;
    nextStory();
  }

  /* ============================================================ flow: stories & briefs */
  function nextStory() {
    G.story++;
    if (G.story >= Sim.SLOTS.length) return showEnd();
    const slot = Sim.SLOTS[G.story];
    let offered = Sim.availableAngles(slot);
    if (offered.length > 2) {
      const r = Sim.rng(G.seed + G.story * 7);
      offered = offered.map((id) => [r(), id]).sort((a, b) => a[0] - b[0]).slice(0, 2).map((p) => p[1]);
    }
    if (!offered.length) return nextStory();
    G.stories[G.story] = { slot, offered, qid: null, interviews: [], estimate: null };
    G.clock = 0; G.warned = false; G.crowd = null;
    G.residents.forEach((p) => { p.talking = false; });
    showBrief();
  }

  /** The brief is the next message in the thread: one line from the editor and two questions to reply with. */
  function showBrief() {
    const st = story(), slot = st.slot;
    const carryOn = G.mode === 'intro' && G.story === 0 && !G.introSkipped && !$('#p-phone').hidden;
    G.mode = 'brief';
    hideAllPanels('p-phone');
    setHud(false);
    $('#onair-banner').hidden = true;
    if (carryOn) { phClear(); $('#ph-time').textContent = hhmm(slot.start); } else phOpen(slot.start);
    $('#ph-foot').innerHTML =
      '<p class="ph-dl mono" id="ph-dl"></p>' +
      '<label class="switch"><input type="checkbox" id="relaxed"' + (G.relaxed ? ' checked' : '') + '><span class="sw" aria-hidden="true"></span>No deadline</label>';
    $('#relaxed').addEventListener('change', (e) => setRelaxed(e.target.checked));
    armFoot();
    syncDeadline();
    setCam('town', !carryOn);
    $('#ph-thread').focus({ preventScroll: true });
    phAdd('Story ' + slot.n + '/' + Sim.SLOTS.length, 'day');
    const line = BRIEF_LINE[slot.n] || slot.editor;
    phSay(esc(line), false, () => { sayLine('editor', line); showReplies(st); });
  }
  /** The footer's buttons change under the pointer: ignore the second click of a double-click. */
  let armT = null;
  function armFoot() {
    const f = $('#ph-foot');
    f.classList.add('arming');
    clearTimeout(armT);
    armT = setTimeout(() => f.classList.remove('arming'), 450);
  }
  function showReplies(st) {
    if (G.mode !== 'brief' || story() !== st || st.qid) return;
    const th = $('#ph-thread');
    const wrap = document.createElement('div');
    wrap.className = 'replies in';
    wrap.id = 'replies';
    wrap.tabIndex = -1;
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Pick the question you\'ll ask people. Use the arrow keys or Tab, then Enter.');
    wrap.innerHTML = st.offered.map((id) =>
      '<button type="button" class="reply" data-q="' + id + '"><span class="r-title">' + esc(Sim.Q[id].title) + '</span><span class="r-q">' + esc(Sim.askText(id)) + '</span></button>').join('') +
      '<p class="r-hint" hidden>Choose with <kbd>↑</kbd><kbd>↓</kbd> or <kbd>Tab</kbd>, then <kbd>Enter</kbd>.</p>';
    th.appendChild(wrap);
    const det = document.createElement('details');
    det.className = 'ph-details';
    det.innerHTML = '<summary>Details</summary>' + st.offered.map(detailsFor).join('') +
      '<p class="d-n mono">With a deadline, walking, interviews (' + COST_TALK + ' min) and reading data (' + COST_FACT + ' min) use the clock.</p>';
    th.appendChild(det);
    det.addEventListener('toggle', () => { if (det.open) th.scrollTop = th.scrollHeight; });
    $$('.reply', wrap).forEach((b) => b.addEventListener('click', () => chooseAngle(b.dataset.q)));
    phScroll();
    // Focus lands on the pair of questions, not on the first one: Enter/Space kept moving the intro on,
    // so a player still pressing them must not pick a question by accident. Arrows or Tab step in.
    grab(wrap);
  }
  /** Enter/Space on the pair of questions (not on one of them): show how to pick. */
  function nudgeReplies(wrap) {
    const h = $('.r-hint', wrap);
    if (h) h.hidden = false;
    wrap.classList.remove('nudge'); void wrap.offsetWidth; wrap.classList.add('nudge');
    phScroll();
    announce('Pick one of the two questions with the arrow keys or Tab, then press Enter.');
  }
  function detailsFor(id) {
    const places = placesFor(id);
    return '<div class="d-q"><p class="d-t"><b>' + esc(Sim.Q[id].title) + '</b> <span class="mono">survey q' + esc(id.slice(1)) + '</span></p>' +
      '<p class="d-l">' + CHIP.assume + '<span>Your guess: the % who answer ' + esc(Sim.measureText(id)) + '.</span></p>' +
      (places.length ? '<p class="d-l">' + CHIP.data + '<span>Useful measured facts, with sources: ' + esc(joinList(places)) + '.</span></p>' : '') + '</div>';
  }
  function placesFor(id) {
    const want = new Set(Sim.Q[id].facts);
    return Wd.evidence.filter((ev) => ev.facts.some((f) => want.has(f))).map((ev) => 'the ' + ev.name.toLowerCase());
  }
  function syncDeadline() {
    const st = story(), el = $('#ph-dl');
    if (el && st) el.textContent = G.relaxed ? 'File when you\'re ready' : 'On air at ' + hhmm(st.slot.start + STORY_MIN);
  }
  function setRelaxed(on) {
    G.relaxed = !!on;
    ['#relaxed', '#help-relaxed'].forEach((s) => { const c = $(s); if (c) c.checked = G.relaxed; });
    syncDeadline();
    if (story() && story().qid) updateClock();
  }
  /** The player replies with a question; a moment later they are out on the street. */
  function chooseAngle(id, instant) {
    const st = story();
    if (!st || st.qid || G.mode !== 'brief') return;
    st.qid = id;
    $$('#ph-thread .replies, #ph-thread .ph-details').forEach((el) => el.remove());
    phAdd(esc(Sim.Q[id].title), 'me in');
    if (instant || G.debug) startReporting();
    else PH.timers.push(setTimeout(startReporting, reduced() ? 250 : 700));
  }
  function startReporting() {
    const st = story();
    if (!st || !st.qid || G.mode !== 'brief') return;
    phClear();
    $('#p-phone').hidden = true;
    G.mode = 'play';
    if (G.story > 0) G.taught.hud = true;
    setHud(true);
    $('#story-chip').innerHTML = '<span class="mono">Story ' + st.slot.n + '/' + Sim.SLOTS.length + '</span> <b>' + esc(Sim.Q[st.qid].title) + '</b>';
    renderTally();
    updateClock();
    G.target = null; showTalkButton();
    if (!G.taught.next) coach(COACH.first);
    if (reduced() || G.debug) snapCamera(); else G.glideUntil = G.t + 1.8;
    announce('Story ' + st.slot.n + '. ' + Sim.Q[st.qid].title + ' Walk around and interview residents.');
    focusWorld();
  }

  /* ============================================================ flow: interview */
  let talkTimers = [];
  function clearTalkTimers() { talkTimers.forEach(clearTimeout); talkTimers = []; }

  function startTalk(res) {
    const st = story();
    if (!st || !st.qid) return;
    G.mode = 'talk';
    keys.clear();
    G.player.path = null; G.player.goal = null;
    res.talking = true; res.path = null; res.moving = false;
    const pl = G.player;
    res.dir = People.dirOf(pl.x - res.x, pl.y - res.y);
    pl.dir = People.dirOf(res.x - pl.x, res.y - pl.y);
    if (res.answers[st.qid] === undefined) res.answers[st.qid] = Sim.sample(st.qid, res.district, G.ansRng);
    const idx = res.answers[st.qid];
    st.interviews.push({ rid: res.id, d: res.district, idx });
    if (!G.relaxed) G.clock += COST_TALK;
    G.talk = { res, idx, step: 0, done: false };
    playHud(false);
    renderTalk();
  }

  function renderTalk() {
    const st = story(), T = G.talk, res = T.res;
    const q = S.q(st.qid);
    const opt = T.idx >= 0 ? q.options[T.idx] : null;
    const answerLine = opt ? Sim.spoken(st.qid, opt) : res.decline;
    const teach = !G.taught.opinion;         // first answer of the game: say what OPINION means
    G.taught.opinion = true;
    const el = $('#p-talk');
    el.innerHTML =
      '<div class="rec-top"><span class="rec"><i aria-hidden="true"></i>Rec</span><span class="wave" aria-hidden="true">' + '<b></b>'.repeat(14) + '</span><span class="mono rec-t">' + hhmm(st.slot.start + G.clock) + '</span></div>' +
      '<div class="who"><canvas class="portrait" width="96" height="96" aria-hidden="true"></canvas>' +
      '<div><h2 id="talk-name">' + esc(res.name) + '</h2><p class="meta">' + esc(Sim.D[res.district].name) + ' · ' + esc(res.doing) + '</p><p class="made">Made-up resident · answer drawn from the survey</p></div></div>' +
      '<div class="lines">' +
      '<p class="line you" data-step="1"><b>You:</b> ' + esc(Sim.askText(st.qid)) + '</p>' +
      '<p class="line them answer" data-step="2">“<span class="typed" data-full="' + esc(answerLine) + '"></span>”</p>' +
      '</div>' +
      '<div class="recorded" data-step="3">' + CHIP.opinion + ' <b>' + (opt ? esc(opt.short || opt.label) : 'Declined to answer') + '</b></div>' +
      (teach ? '<p class="jit" data-step="3"><span>An <b>opinion</b> is what someone says they think: real, but not proof about data centres.</span></p>' : '') +
      '<div class="row"><button class="btn primary" type="button" id="talk-next" data-autofocus>Thanks! <kbd>E</kbd></button><span class="cost">' + (G.relaxed ? 'No deadline' : COST_TALK + ' min spent') + '</span></div>';
    el.hidden = false;
    drawPortrait($('.portrait', el), res.look);
    sayLine(res.voice, answerLine);
    $('#talk-next').addEventListener('click', advanceTalk);
    clearTalkTimers();
    finishTalkUI();
    focusIn(el);
    announce(res.name + ' says: ' + answerLine + (opt ? ' Recorded as ' + (opt.short || opt.label) + '.' : ' No answer recorded.'));
  }
  function finishTalkUI() {
    if (!G.talk || G.talk.done) return;
    G.talk.done = true;
    const el = $('#p-talk');
    const typed = $('.typed', el);
    if (typed) typed.textContent = typed.dataset.full;
    $$('[data-step]', el).forEach((s) => s.classList.remove('pending'));
    el.classList.remove('speaking');
    const b = $('#talk-next');
    if (b) { b.innerHTML = 'Thanks! <kbd>E</kbd>'; }
  }
  function advanceTalk() {
    if (!G.talk) return;
    if (!G.talk.done) { clearTalkTimers(); finishTalkUI(); return; }
    endTalk();
  }
  function endTalk() {
    if (!G.talk) return;
    clearTalkTimers();
    const T = G.talk, st = story();
    T.res.talking = false;
    T.res.wait = 1.2;
    $('#p-talk').hidden = true;
    G.talk = null;
    G.mode = 'play';
    playHud(true);
    revealHud();
    if (!G.taught.next) { G.taught.next = true; coach(COACH.next, 8); }
    const cat = T.idx < 0 ? 'none' : Sim.isYes(st.qid, T.idx) ? 'yes' : 'no';
    G.fx.push({ kind: 'pop', x: T.res.x, y: T.res.y, t0: G.t, cat });
    flyToTally(T.res, T.idx, cat);
    G.target = null; showTalkButton();
    focusWorld();
    if (!G.relaxed && G.clock >= STORY_MIN) { G.clock = STORY_MIN; openFile(true); }
  }
  function flyToTally(res, idx, cat) {
    const s = Wd.iso(res.x, res.y);
    const sx = (s.x - view.x) * view.zoom + vw / 2, sy = (s.y - 40 - view.y) * view.zoom + vh / 2;
    const tallyEl = $('#tally');
    const row = idx >= 0 ? $('[data-opt="' + idx + '"]', tallyEl) : $('.t-sum', tallyEl);
    const done = () => { renderTally(); const r = idx >= 0 ? $('[data-opt="' + idx + '"]', tallyEl) : null; if (r) { r.classList.add('bump'); setTimeout(() => r.classList.remove('bump'), 500); } };
    if (!row || reduced() || tallyEl.hidden) { done(); return; }
    const rr = row.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly ' + cat;
    dot.style.left = sx + 'px'; dot.style.top = sy + 'px';
    document.body.appendChild(dot);
    requestAnimationFrame(() => requestAnimationFrame(() => { dot.style.transform = 'translate(' + (rr.right - 24 - sx) + 'px,' + (rr.top + rr.height / 2 - sy) + 'px) scale(.6)'; dot.style.opacity = '0.9'; }));
    setTimeout(() => { dot.remove(); done(); }, 620);
  }
  function drawPortrait(c, look) {
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    x.save();
    x.beginPath(); x.arc(48, 48, 46, 0, Math.PI * 2); x.fillStyle = '#E9F2F1'; x.fill(); x.clip();
    Art.drawPerson(x, 48, 132, look, { dir: 'sw', phase: 0, moving: false, scale: 2.6, reduced: true });
    x.restore();
  }

  /* ============================================================ flow: data points */
  function openFact(ev) {
    G.mode = 'fact';
    keys.clear();
    G.player.path = null; G.player.goal = null;
    const first = !G.visited.has(ev.id);
    if (first) {
      G.visited.add(ev.id);
      ev.facts.forEach((f) => { if (!G.facts.has(f)) G.facts.set(f, ev.id); });
      if (!G.relaxed) G.clock += COST_FACT;
      const nb = $('#nb-pulse'); nb.classList.remove('go'); void nb.offsetWidth; nb.classList.add('go');
    }
    const st = story();
    const rel = new Set(st && st.qid ? Sim.Q[st.qid].facts : []);
    const facts = ev.facts.map(Sim.fact).filter(Boolean);
    facts.forEach((f) => G.shown.add(f.id));
    const teach = !G.taught.data;            // first data point of the game: say what DATA means
    G.taught.data = true;
    const el = $('#p-fact');
    el.innerHTML =
      '<p class="kicker">' + CHIP.data + ' <span>' + esc(ev.name) + '</span></p>' +
      '<h2 id="fact-h" tabindex="-1">What\'s measured</h2>' +
      (teach ? '<p class="jit"><span><b>Data</b> is measured, with a source you can check.</span></p>' : '') +
      (ev.chart === 'cso' ? csoChart() : '') +
      facts.map((f) => factCard(f, rel.has(f.id))).join('') +
      '<p class="fact-note">' + (first ? 'Added to the <b>Data</b> page of your notebook.' + (G.relaxed ? '' : ' ' + COST_FACT + ' min spent.') : 'You\'ve read this already - no time used.') + '</p>' +
      '<div class="row"><button class="btn primary" type="button" id="fact-close" data-autofocus>Back to reporting <kbd>E</kbd></button></div>';
    el.hidden = false;
    $('#fact-close').addEventListener('click', closeFact);
    playHud(false);
    focusIn(el);
    announce(ev.name + '. ' + facts.map((f) => f.text).join(' '));
  }
  function factCard(f, relevant) {
    return '<article class="fact-card' + (relevant ? ' rel' : '') + '">' +
      (relevant ? '<p class="rel-tag">★ Useful for your current story</p>' : '') +
      '<p class="fact-text">' + esc(f.text) + '</p>' +
      '<p class="fact-src mono">Source: <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.source) + '</a> · ' + esc(f.year) + ' · <span class="conf ' + esc(f.confidence) + '">' + esc(f.confidence) + ' confidence</span></p>' +
      (f.confidence !== 'high' ? '<p class="caveat">' + esc(CONF[f.confidence] || '') + '</p>' : '') +
      '</article>';
  }
  function csoChart() {
    const cs = F.csoSeries;
    if (!cs || !cs.years || !cs.years.length) return '';
    const ys = cs.years, W = 300, H = 90, p = 22;
    const max = Math.max(...ys.map((y) => y.pct)) * 1.15;
    const X = (i) => p + (i / (ys.length - 1)) * (W - 2 * p), Y = (v) => H - 16 - (v / max) * (H - 30);
    const pts = ys.map((y, i) => X(i) + ',' + Y(y.pct)).join(' ');
    const a = ys[0], b = ys[ys.length - 1];
    return '<figure class="cso"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Data centres\' share of Ireland\'s metered electricity rose from ' + a.pct + '% in ' + a.year + ' to ' + b.pct + '% in ' + b.year + '">' +
      '<polyline points="' + pts + '" fill="none" stroke="#00727C" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      ys.map((y, i) => '<circle cx="' + X(i) + '" cy="' + Y(y.pct) + '" r="' + (i === 0 || i === ys.length - 1 ? 4 : 2.2) + '" fill="#00727C"/>').join('') +
      '<text x="' + X(0) + '" y="' + (Y(a.pct) - 8) + '" text-anchor="middle" class="svg-l">' + a.pct + '%</text>' +
      '<text x="' + X(ys.length - 1) + '" y="' + (Y(b.pct) - 8) + '" text-anchor="middle" class="svg-l b">' + b.pct + '%</text>' +
      '<text x="' + X(0) + '" y="' + (H - 2) + '" text-anchor="middle" class="svg-a">' + a.year + '</text>' +
      '<text x="' + X(ys.length - 1) + '" y="' + (H - 2) + '" text-anchor="middle" class="svg-a">' + b.year + '</text>' +
      '</svg><figcaption class="mono">Share of Ireland\'s metered electricity used by data centres · <a href="' + esc(cs.url) + '" target="_blank" rel="noopener">CSO</a></figcaption></figure>';
  }
  function closeFact() {
    $('#p-fact').hidden = true;
    G.mode = 'play';
    playHud(true);
    revealHud();
    G.target = null; showTalkButton();
    focusWorld();
    if (!G.relaxed && G.clock >= STORY_MIN) { G.clock = STORY_MIN; openFile(true); }
  }

  /* ============================================================ notebook */
  function openNotebook() {
    if (G.mode !== 'play') return;
    G.mode = 'notebook';
    keys.clear();
    const st = story();
    const el = $('#p-notebook');
    const facts = Array.from(G.facts.keys()).map(Sim.fact).filter(Boolean);
    const rel = new Set(st && st.qid ? Sim.Q[st.qid].facts : []);
    const past = G.stories.filter((s, i) => s && i < G.story && s.estimate != null);
    el.innerHTML =
      '<h2 id="nb-h" tabindex="-1">Reporter\'s notebook</h2>' +
      '<section class="nb-sec"><h3>' + CHIP.opinion + ' Interviews</h3>' +
      (st && st.qid ? nbStory(st) : '') +
      past.map((s) => '<p class="nb-past">Story ' + s.slot.n + ': ' + esc(Sim.Q[s.qid].title) + ' - you asked ' + s.interviews.length + '.</p>').join('') +
      '</section>' +
      '<section class="nb-sec"><h3>' + CHIP.data + ' Facts you\'ve read <span class="mono">' + facts.length + ' of ' + totalFacts() + '</span></h3>' +
      (facts.length ? '<ul class="nb-facts">' + facts.map((f) => '<li' + (rel.has(f.id) ? ' class="rel"' : '') + '>' + (rel.has(f.id) ? '<b>★</b> ' : '') + esc(f.text) + ' <a class="mono" href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.source) + '</a></li>').join('') + '</ul>' : '<p class="muted">None yet. Look for the teal <span class="diamond" aria-hidden="true"></span> markers around town and on the campus.</p>') +
      (st && st.qid ? '<p class="muted small">★ = useful for this story. Look at ' + esc(joinList(placesFor(st.qid))) + '.</p>' : '') +
      '</section>' +
      '<section class="nb-sec"><h3>' + CHIP.assume + ' Headlines you\'ve filed</h3>' +
      (past.length ? '<ul class="nb-heads">' + past.map((s) => '<li>“' + esc(Sim.Q[s.qid].headline(s.estimate)) + '”</li>').join('') + '</ul>' : '<p class="muted">Nothing on air yet.</p>') +
      '</section>' +
      '<div class="row"><button class="btn primary" type="button" id="nb-close" data-autofocus>Close <kbd>N</kbd></button></div>';
    el.hidden = false;
    $('#nb-close').addEventListener('click', closeNotebook);
    playHud(false);
    focusIn(el);
  }
  function nbStory(st) {
    const t = tallyOf(st);
    const lines = st.interviews.map((iv) => {
      const p = G.residents[iv.rid];
      const o = iv.idx >= 0 ? S.q(st.qid).options[iv.idx] : null;
      const cat = iv.idx < 0 ? 'none' : Sim.isYes(st.qid, iv.idx) ? 'yes' : 'no';
      return '<li class="' + cat + '"><span class="mk" aria-hidden="true"></span><b>' + esc(p.name) + '</b> <span class="mono">' + esc(Sim.D[iv.d].short) + '</span> - ' + (o ? esc(o.short || o.label) : 'no answer') + '</li>';
    });
    return '<p class="nb-q">“' + esc(Sim.askText(st.qid)) + '”</p><p class="small muted">Survey question ' + esc(st.qid) + '</p>' +
      (lines.length ? '<ol class="nb-list hand">' + lines.join('') + '</ol>' : '<p class="muted">No interviews yet.</p>') +
      (t.k ? '<p class="nb-sum">' + t.yes + ' of ' + t.k + ' answered ' + esc(Sim.measureText(st.qid)) + ' = <b>' + pc(t.pct) + '</b></p>' : '');
  }
  function totalFacts() { const s = new Set(); Wd.evidence.forEach((ev) => ev.facts.forEach((f) => { if (Sim.fact(f)) s.add(f); })); return s.size; }
  function closeNotebook() { $('#p-notebook').hidden = true; G.mode = 'play'; playHud(true); focusWorld(); }

  /* ============================================================ flow: file your story */
  function openFile(forced) {
    const st = story();
    if (!st || !st.qid) return;
    if (G.mode === 'talk') { finishTalkUI(); endTalk(); if (G.mode === 'file') return; }
    if (G.mode === 'fact') { $('#p-fact').hidden = true; }
    if (G.mode === 'notebook') { $('#p-notebook').hidden = true; }
    G.mode = 'file';
    G.fileForced = !!forced;
    keys.clear();
    G.player.path = null; G.player.goal = null;
    playHud(false);
    const t = tallyOf(st);
    const start = t.k ? r0(t.pct) : 50;
    const held = Sim.Q[st.qid].facts.filter((f) => G.facts.has(f)).map(Sim.fact).filter(Boolean);
    // labels met here for the first time get a one-line explanation (ASSUMPTION always arrives here first)
    const tOp = !G.taught.opinion, tAs = !G.taught.assume, tDa = !G.taught.data;
    G.taught.opinion = G.taught.assume = G.taught.data = true;
    const jit = (on, html) => (on ? '<p class="jit"><span>' + html + '</span></p>' : '');
    const el = $('#p-file');
    el.innerHTML =
      '<p class="kicker">' + (forced ? '<span class="deadline-hit">Deadline!</span> Time to file what you have.' : 'Story ' + st.slot.n + ' · ' + esc(st.slot.bulletin)) + '</p>' +
      '<h2 id="file-h" tabindex="-1">File your story</h2>' +
      '<div class="f-block">' + CHIP.opinion + '<div><p><b>Your vox pop:</b> ' +
      (t.k ? t.yes + ' of the ' + t.k + ' people who answered said ' + esc(Sim.measureText(st.qid)) + ' (' + pc(t.pct) + ').' : 'you haven\'t got any answers yet, so your headline will be pure assumption.') +
      (t.decl ? ' ' + t.decl + ' declined.' : '') +
      '<br><span class="mono small">Asked in: ' + Sim.DISTRICTS.map((d) => esc(d.inText) + ' ' + t.by[d.key].asked).join(' · ') + '</span></p>' +
      jit(tOp, 'An <b>opinion</b> is what someone says they think: real, but not proof about data centres.') + '</div></div>' +
      '<div class="f-block">' + CHIP.assume + '<div class="f-slider"><label for="est"><b>Your headline number.</b> What share of ' + TOWN + ' would answer ' + esc(Sim.measureText(st.qid)) + '?</label>' +
      '<div class="est-row"><input type="range" id="est" min="0" max="100" step="1" value="' + start + '" aria-describedby="est-help"><output id="est-out" for="est">' + start + '%</output></div>' +
      '<p id="est-help" class="mono small">Adjust your guess. Arrow keys move 1 point.</p>' +
      jit(tAs, 'An <b>assumption</b> is your own guess: here, what the whole town thinks, based on the few people you asked.') + '</div></div>' +
      '<div class="script"><span class="onair-pill"><i aria-hidden="true"></i>On air at ' + hhmm(st.slot.start + STORY_MIN) + '</span><p class="script-h" id="script-h"></p></div>' +
      '<div class="f-block">' + CHIP.data + '<div><p>' + (held.length ? '<b>Facts you can cite:</b> ' + held.map((f) => esc(f.source)).join(', ') + '. Your story counts as sourced.' : '<b>No sourced facts for this story.</b> Useful ones were at ' + esc(joinList(placesFor(st.qid))) + '.') + '</p>' +
      jit(tDa, '<b>Data</b> is measured, with a source you can check.') + '</div></div>' +
      '<div class="row">' + (forced ? '' : '<button class="btn ghost" type="button" id="file-back">Keep reporting</button>') + '<button class="btn primary big" type="button" id="file-go" data-autofocus>Go on air <span aria-hidden="true">→</span></button></div>';
    el.hidden = false;
    const inp = $('#est'), out = $('#est-out'), h = $('#script-h');
    const sync = () => { const v = +inp.value; out.textContent = v + '%'; inp.setAttribute('aria-valuetext', v + '%'); h.textContent = '“' + Sim.Q[st.qid].headline(v) + '”'; };
    inp.addEventListener('input', sync);
    sync();
    $('#file-go').addEventListener('click', () => goOnAir(+inp.value));
    if (!forced) $('#file-back').addEventListener('click', closeFile);
    focusIn(el);
    if (forced) announce('Deadline. Time to file your story.');
  }
  function closeFile() { $('#p-file').hidden = true; G.mode = 'play'; playHud(true); focusWorld(); }

  /* ============================================================ flow: on air + meet the 200 */
  function goOnAir(estimate) {
    const st = story();
    st.estimate = estimate;
    const t = tallyOf(st);
    st.tally = t;
    st.survey = Sim.surveyResult(st.qid);
    st.miss = Math.abs(estimate - st.survey.pct);
    st.stars = st.miss <= 5 ? 3 : st.miss <= 12 ? 2 : st.miss <= 20 ? 1 : 0;
    st.sourced = Sim.Q[st.qid].facts.some((f) => G.facts.has(f));
    const k = t.k || 5;
    st.simK = k;
    st.sims = Sim.simulate(st.qid, k, 100, Sim.rng(G.seed + 101 + G.story));
    const big = Sim.simulate(st.qid, 30, 400, Sim.rng(G.seed + 202 + G.story));
    st.range30 = [Sim.percentile(big, 5), Sim.percentile(big, 95)];
    st.typMiss = typicalMiss(st.qid, st.survey.pct);
    Sim.Q[st.qid].facts.forEach((f) => G.shown.add(f));
    $('#p-file').hidden = true;
    setHud(false);
    startCrowd(st);
  }
  function typicalMiss(qid, truth) {
    const med = (k) => Sim.percentile(Sim.simulate(qid, k, 300, Sim.rng(G.seed + k)).map((v) => Math.abs(v - truth)), 50);
    return { k5: med(5), k30: med(30) };
  }

  function startCrowd(st) {
    G.mode = 'crowd';
    const figs = Sim.crowd(st.qid);
    const r = Sim.rng(G.seed + 303 + G.story);
    const slots = {};
    const order = [];
    ['urban', 'suburban', 'rural'].forEach((d) => {
      const tiles = Wd.districtTiles(d).filter((tt) => !(d === 'rural' && tt[1] <= 10));
      for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const tt = tiles[i]; tiles[i] = tiles[j]; tiles[j] = tt; }
      const spots = [];
      tiles.forEach((tt) => { spots.push([tt[0] + 0.3 + r() * 0.15, tt[1] + 0.3 + r() * 0.15]); spots.push([tt[0] + 0.65 + r() * 0.15, tt[1] + 0.65 + r() * 0.15]); });
      slots[d] = spots;
    });
    slots.unknown = [[13.5, 9.4], [14.2, 9.8], [12.7, 8.6], [15.2, 8.5], [13.1, 10.6]];
    const used = { urban: 0, suburban: 0, rural: 0, unknown: 0 };
    figs.forEach((f) => {
      const list = slots[f.d] || slots.unknown;
      const spot = list[used[f.d] % list.length];
      used[f.d]++;
      f.x = spot[0]; f.y = spot[1];
      order.push(f);
    });
    // pop in by screen height, a little shuffled, so it reads as a crowd arriving
    order.sort((a, b) => (a.x + a.y) - (b.x + b.y) + (r() - 0.5) * 6);
    const dur = reduced() ? 0 : 2.2;
    order.forEach((f, i) => {
      f.delay = 0.7 + (i / order.length) * dur;
      f.k = 0;
      const s = Wd.iso(f.x, f.y);
      const cat = f.cat === 'hidden' ? 'none' : f.cat;
      f.item = { x0: f.x - 0.12, y0: f.y - 0.12, x1: f.x + 0.12, y1: f.y + 0.12, bx0: s.x - 14, bx1: s.x + 14, by0: s.y - 50, by1: s.y + 6, draw: () => Art.crowdFig(ctx, s.x, s.y, cat, f.k * clamp(0.5 / view.zoom, 1, 1.8)) };
    });
    G.crowd = { st, figs: order, t0: G.t, shown: 0, done: false, total: order.length };
    const hidden = order.filter((f) => f.cat === 'hidden').length;
    const gap = Math.abs(st.estimate - st.survey.pct);
    const difference = gap < 0.05 ? 'Your guess matched the survey result.' :
      'Your guess was ' + (gap < 1 ? 'less than 1 percentage point' : 'about ' + r0(gap) + ' percentage ' + (r0(gap) === 1 ? 'point' : 'points')) +
      (st.estimate > st.survey.pct ? ' higher.' : ' lower.');
    const b = $('#onair-banner');
    b.innerHTML =
      '<span class="onair-pill"><i aria-hidden="true"></i>On air</span>' +
      '<h2 class="ob-head">' + esc(Sim.Q[st.qid].title) + '</h2>' +
      '<div class="ob-compare"><div>' + CHIP.assume + '<span>Your headline</span><b>' + st.estimate + '%</b></div>' +
      '<div>' + CHIP.opinion + '<span>Survey result</span><b>' + pc(st.survey.pct) + '</b></div></div>' +
      '<p class="ob-gap">' + difference + '</p>' +
      '<p class="ob-crowd">Based on <b>' + st.survey.n + ' answers</b> in this survey.</p>' +
      '<ul class="ob-legend">' +
      '<li><span class="fig yes" aria-hidden="true"></span><span>' + esc(Sim.measureText(st.qid)) + '</span> <b class="mono">' + st.survey.yes + '</b></li>' +
      '<li><span class="fig no" aria-hidden="true"></span>Other answers <b class="mono">' + (st.survey.n - st.survey.yes) + '</b></li>' +
      '<li><span class="fig none" aria-hidden="true"></span>Didn\'t answer' + (hidden ? ' or too few people to show' : '') + ' <b class="mono">' + (S.n - st.survey.n) + '</b></li></ul>' +
      '<p class="ob-note">Figures represent survey counts, not identifiable people.</p>' +
      '<details class="how"><summary>Headline and crowd details</summary><p>Your headline: “' + esc(Sim.Q[st.qid].headline(st.estimate)) + '”</p><p>' + S.n + ' people in Ireland (Maynooth University survey). Figures are grouped by their reported area type (q4). Percentages exclude those who did not answer this question.</p></details>' +
      '<div class="row"><button class="btn primary" type="button" id="btn-report" hidden>See the report <span aria-hidden="true">→</span></button></div>';
    b.hidden = false;
    $('#btn-report').addEventListener('click', showReport);
    announce('On air: ' + Sim.Q[st.qid].headline(st.estimate) + '. The survey: ' + st.survey.yes + ' of ' + st.survey.n + ', ' + pc(st.survey.pct) + '.');
  }
  function updateCrowd() {
    const c = G.crowd;
    let all = true;
    for (let i = 0; i < c.figs.length; i++) {
      const f = c.figs[i];
      const k = (G.t - c.t0 - f.delay) / 0.28;
      if (k <= 0) { f.k = 0; all = false; continue; }
      f.k = reduced() ? 1 : k >= 1 ? 1 : k < 0.7 ? (k / 0.7) * 1.2 : 1.2 - ((k - 0.7) / 0.3) * 0.2;
    }
    if (all && !c.done) {
      c.done = true;
      const b = $('#btn-report');
      if (b && G.mode === 'crowd') { b.hidden = false; b.focus({ preventScroll: true }); }
    }
  }

  /* ============================================================ report */
  function showReport() {
    const st = story();
    G.mode = 'report';
    $('#onair-banner').hidden = true;
    $('#btn-report') && ($('#btn-report').hidden = true);
    const t = st.tally, sv = st.survey;
    const q = S.q(st.qid);
    const verdict = st.miss <= 5 ? 'Spot on' : st.miss <= 12 ? 'Close' : st.miss <= 20 ? 'A bit off' : 'Way off';
    const luck = luckLine(st);
    const within10 = st.sims.filter((v) => Math.abs(v - sv.pct) <= 10).length;
    const mn = Math.min(...st.sims), mx = Math.max(...st.sims);
    const extras = Sim.extraResults(st.qid);
    const rel = Sim.Q[st.qid].facts.map(Sim.fact).filter(Boolean);
    const last = G.story === Sim.SLOTS.length - 1;
    const el = $('#p-report');
    el.innerHTML =
      '<p class="kicker">Story ' + st.slot.n + ' report · ' + esc(Sim.Q[st.qid].title) + '</p>' +
      '<h2 id="report-h" tabindex="-1">' + verdict + ' <span class="stars" aria-label="' + st.stars + ' of 3 stars">' + '★'.repeat(st.stars) + '<span class="off">' + '★'.repeat(3 - st.stars) + '</span></span>' + (st.sourced ? ' <span class="sourced">✓ Sourced</span>' : '') + '</h2>' +
      '<p class="q-full">Share answering ' + esc(Sim.measureText(st.qid)) + '</p>' +
      '<details class="how"><summary>Original survey question</summary><p>q' + esc(st.qid.slice(1)) + ' · ' + esc(Sim.surveyWording(st.qid)) + '</p></details>' +
      '<div class="three">' +
      '<div class="n assume">' + CHIP.assume + '<b>' + st.estimate + '%</b><span>Your headline</span></div>' +
      '<div class="n opinion small">' + CHIP.opinion + '<b>' + (t.k ? pc(t.pct) : '–') + '</b><span>Your vox pop · ' + t.k + ' ' + (t.k === 1 ? 'person' : 'people') + '</span></div>' +
      '<div class="n opinion">' + CHIP.opinion + '<b>' + pc(sv.pct) + '</b><span>The survey · ' + sv.n + ' of ' + S.n + ' answered</span></div>' +
      '</div>' +
      '<p class="miss">Your headline missed the survey by <b>' + r0(st.miss) + ' points</b>. ' + esc(luck) + '</p>' +
      '<p class="map-key small"><span>On the map, the survey\'s ' + S.n + ' people:</span> <span><i class="fig yes" aria-hidden="true"></i> ' + sv.yes + ' said ' + esc(Sim.measureText(st.qid)) + '</span> <span><i class="fig no" aria-hidden="true"></i> ' + (sv.n - sv.yes) + ' another answer</span> <span><i class="fig none" aria-hidden="true"></i> ' + (S.n - sv.n) + ' didn\'t answer</span></p>' +
      '<details class="rep-sec explore"><summary>Could another sample change the result? <span class="tag-sim">simulation</span></summary>' +
      '<p>' + (t.k ? 'If 100 reporters each asked ' + st.simK + ' random residents, this is what they would have got. Yours is marked.' : 'You didn\'t get any answers. If 100 reporters each asked 5 random residents, this is what they would have got.') + '</p>' +
      voxChart(st) +
      '<p class="small">' + within10 + ' of 100 landed within 10 points of the survey; results ran from ' + r0(mn) + '% to ' + r0(mx) + '%. Asking 30 people each, 90 of 100 would land between about ' + r0(st.range30[0]) + '% and ' + r0(st.range30[1]) + '%.</p>' +
      '<details class="how"><summary>How this is calculated</summary><p>Each simulated reporter picks residents at random, in the same mix of districts as the survey (q4), and each resident\'s answer is drawn the same way as in the game - from the q4 cross-tab row for their district. People who would decline are left out, so every reporter gets ' + st.simK + ' answers. It shows sampling luck, not a prediction.</p></details>' +
      '</details>' +
      '<details class="rep-sec explore"><summary>Compare districts</summary>' + whereTable(st) +
      '<p class="small muted">Survey figures are the q4 cross-tab: people who described their own area as urban, suburban or rural. A pattern, not a cause.</p></details>' +
      (extras.length ? extras.map(extraBlock).join('') : '') +
      '<details class="rep-sec explore"><summary>' + CHIP.data + ' Read the evidence and sources</summary>' +
      rel.map((f) => { const where = G.facts.has(f.id); const ev = Wd.evidence.find((e) => e.facts.includes(f.id)); return '<div class="rep-fact ' + (where ? 'got' : 'missed') + '"><p class="rf-tag">' + (where ? '✓ In your notebook' : '✗ Missed - it was at ' + esc(ev ? ev.place : 'a data point')) + '</p>' + factCard(f, false) + '</div>'; }).join('') +
      '<p class="small muted">Facts explain impacts; the survey records views.</p></details>' +
      '<div class="row sticky"><button class="btn primary big" type="button" id="rep-next">' + (last ? 'See your day <span aria-hidden="true">→</span>' : 'Next story <span aria-hidden="true">→</span>') + '</button></div>';
    el.hidden = false;
    el.scrollTop = 0;
    $('#rep-next').addEventListener('click', () => { el.hidden = true; $('#onair-banner').hidden = true; G.crowd = null; Object.assign(G.player, { x: Wd.spawn.x, y: Wd.spawn.y, path: null, goal: null, dir: 'se' }); snapCamera(); nextStory(); });
    focusIn(el);
  }
  function luckLine(st) {
    const k = st.tally.k, ppl = k + (k === 1 ? ' person' : ' people');
    if (!k) return 'With nobody to ask, the headline was a pure assumption.';
    if (st.miss <= 5) return k < 8 ? 'Nicely judged - though with ' + ppl + ', luck helped.' : 'Nicely judged.';
    if (st.miss <= 15) return 'With ' + ppl + ', a miss this size is normal - that\'s sampling luck.';
    return k < 8 ? 'Small samples swing a lot. That\'s luck, not the town changing its mind.' : 'Even ' + ppl + ' can be unlucky - and where you ask matters too.';
  }
  function voxChart(st) {
    const W = 420, pad = 26, gap = 6.4;
    const bins = {};
    st.sims.forEach((v) => { const b = Math.round(v / 5) * 5; bins[b] = (bins[b] || 0) + 1; });
    const maxStack = Math.max(...Object.values(bins));
    const cols = maxStack > 36 ? 3 : maxStack > 16 ? 2 : 1;          // dots side by side per bin
    const rows = Math.ceil(maxStack / cols);
    const top = 40, base = top + rows * gap + 6, H = base + 46;
    const X = (v) => pad + (v / 100) * (W - 2 * pad);
    let dots = '', idx = 0;
    Object.keys(bins).map(Number).sort((a, b) => a - b).forEach((b) => {
      for (let i = 0; i < bins[b]; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        const cx = X(b) + (c - (cols - 1) / 2) * gap;
        dots += '<circle class="sd" style="--d:' + (idx++ * 10) + 'ms" cx="' + cx.toFixed(1) + '" cy="' + (base - 4 - r * gap).toFixed(1) + '" r="2.6"/>';
      }
    });
    const sv = st.survey.pct, yours = st.tally.k ? st.tally.pct : null;
    const anchor = (v) => (v > 82 ? 'end' : v < 18 ? 'start' : 'middle');
    const ticks = [0, 25, 50, 75, 100].map((v) => '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="' + base + '" y2="' + (base + 4) + '" class="ax"/><text x="' + X(v) + '" y="' + (base + 15) + '" class="svg-a" text-anchor="middle">' + v + '%</text>').join('');
    const close = Math.abs(sv - st.estimate) < 24;
    return '<figure class="vox"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Dot plot of 100 simulated vox pops. The survey figure is ' + pc(sv) + (yours != null ? '; your vox pop was ' + pc(yours) : '') + '; your headline was ' + st.estimate + '%.">' +
      '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + base + '" y2="' + base + '" class="ax"/>' + ticks + dots +
      '<line x1="' + X(sv) + '" x2="' + X(sv) + '" y1="' + (close && sv > st.estimate ? 26 : 12) + '" y2="' + base + '" class="sv"/><text x="' + X(sv) + '" y="' + (close && sv > st.estimate ? 22 : 9) + '" text-anchor="' + anchor(sv) + '" class="svg-l op">Survey ' + pc(sv) + '</text>' +
      '<line x1="' + X(st.estimate) + '" x2="' + X(st.estimate) + '" y1="' + (close && sv <= st.estimate ? 26 : 12) + '" y2="' + base + '" class="hl"/><text x="' + X(st.estimate) + '" y="' + (close && sv <= st.estimate ? 22 : 9) + '" text-anchor="' + anchor(st.estimate) + '" class="svg-l as">Your headline ' + st.estimate + '%</text>' +
      (yours != null ? '<path d="M' + X(yours).toFixed(1) + ' ' + (base + 19) + ' l6 10 h-12 z" class="you"/><text x="' + X(yours) + '" y="' + (base + 42) + '" text-anchor="' + anchor(yours) + '" class="svg-a you-t">your vox pop ' + pc(yours) + '</text>' : '') +
      '</svg><figcaption class="small muted">Each dot is one imaginary reporter.</figcaption></figure>';
  }
  function whereTable(st) {
    const t = st.tally;
    return '<table class="where"><thead><tr><th scope="col">District</th><th scope="col">You asked</th><th scope="col">Your vox pop there</th><th scope="col">Survey there</th></tr></thead><tbody>' +
      Sim.DISTRICTS.map((d) => {
        const b = t.by[d.key], sv = Sim.districtResult(st.qid, d.key);
        return '<tr><th scope="row">' + esc(d.name) + ' <span class="mono small">' + esc(d.area) + '</span></th><td>' + b.asked + '</td><td>' + (b.k ? pc((100 * b.yes) / b.k) + ' <span class="mono small">(' + b.yes + '/' + b.k + ')</span>' : '–') + '</td><td>' + (sv ? pc(sv.pct) + ' <span class="mono small">n = ' + sv.n + '</span>' + (sv.small ? ' <span class="small-n">small group (n = ' + sv.n + ')</span>' : '') : 'too few people to show') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  function extraBlock(x) {
    const a = x.groups[0], b = x.groups[1];
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const g = (v) => esc(v.label) + ' (' + pc(v.pct) + ', n = ' + v.n + ')';
    const line = Math.abs(a.pct - b.pct) < 3 ? 'About the same among ' + g(a) + ' and ' + g(b) + '.' : (a.pct > b.pct ? 'Higher' : 'Lower') + ' among ' + g(a) + ' than among ' + g(b) + '.';
    return '<details class="rep-sec explore"><summary>' + CHIP.opinion + ' Explore a survey pattern</summary>' +
      '<p>' + (x.ofText ? 'Share who ' + esc(x.ofText) : 'Share answering ' + esc(Sim.measureText(x.of)) + ' (q' + esc(x.of.slice(1)) + ')') + ', split by survey q' + esc(x.by.slice(1)) + ':</p>' +
      '<div class="xbars">' + x.groups.map((v) => '<div class="xb"><span class="xl">' + esc(cap(v.label)) + ' <span class="mono small">n = ' + v.n + '</span>' + (v.small ? ' <span class="small-n">small group (n = ' + v.n + ')</span>' : '') + '</span><span class="xt"><i style="width:' + v.pct + '%"></i></span><b>' + pc(v.pct) + '</b></div>').join('') + '</div>' +
      '<p class="small muted">' + line + ' That\'s a pattern among these respondents, not proof that one causes the other.</p></details>';
  }

  /* ============================================================ end */
  const STORE = 'voxpop.runs.v1';
  function loadRuns() { try { const v = JSON.parse(window.localStorage.getItem(STORE) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function storageOk() { try { const k = STORE + '.test'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); return true; } catch (e) { return false; } }
  function saveRun(run) { try { const a = loadRuns(); a.push(run); window.localStorage.setItem(STORE, JSON.stringify(a.slice(-200))); return true; } catch (e) { return false; } }

  function showEnd(noSave) {
    G.mode = 'end';
    hideAllPanels();
    setHud(false);
    $('#onair-banner').hidden = true;
    G.crowd = null;
    const done = G.stories.filter((s) => s && s.estimate != null);
    const stars = done.reduce((a, s) => a + s.stars + (s.sourced ? 1 : 0), 0);
    const rank = stars >= 10 ? 'Data desk editor' : stars >= 7 ? 'Staff reporter' : stars >= 4 ? 'Cub reporter' : 'Work-experience intern';
    const asked = done.reduce((a, s) => a + s.interviews.length, 0);
    const avgMiss = done.length ? done.reduce((a, s) => a + s.miss, 0) / done.length : 0;
    if (!noSave && done.length) saveRun({ t: Date.now(), misses: done.map((s) => r0(s.miss)), asked: done.map((s) => s.interviews.length), stars });
    const runs = loadRuns();
    const devAvg = runs.length ? runs.reduce((a, r) => a + (r.misses || []).reduce((x, y) => x + y, 0) / Math.max(1, (r.misses || []).length), 0) / runs.length : null;
    const sortedByMiss = done.slice().sort((a, b) => b.miss - a.miss);
    const worst = sortedByMiss[0], best = sortedByMiss[sortedByMiss.length - 1];
    const tm = done[0] && done[0].typMiss;
    const allFacts = new Set(); Wd.evidence.forEach((ev) => ev.facts.forEach((f) => allFacts.add(f)));
    const shownFacts = Array.from(G.shown).map(Sim.fact).filter(Boolean);
    const el = $('#p-end');
    el.innerHTML =
      '<div class="end-in">' +
      '<div class="press"><p class="kicker">That\'s a wrap · ' + esc(TOWN) + ' Community Radio</p><h2 id="end-h" tabindex="-1">' + esc(rank) + '</h2>' +
      '<p class="end-score"><span class="stars" aria-label="' + stars + ' of 12 stars">' + stars + '<small>/12</small></span> stars · ' + asked + ' interviews · ' + G.facts.size + ' of ' + allFacts.size + ' facts read</p></div>' +
      '<div class="table-wrap"><table class="stories"><thead><tr><th scope="col">Story</th><th scope="col">Asked</th><th scope="col">' + CHIP.assume + ' Your headline</th><th scope="col">' + CHIP.opinion + ' Your vox pop</th><th scope="col">' + CHIP.opinion + ' Survey</th><th scope="col">Miss</th><th scope="col">' + CHIP.data + ' Sourced</th></tr></thead><tbody>' +
      done.map((s) => '<tr><th scope="row">' + esc(Sim.Q[s.qid].title) + ' <span class="mono small">q' + esc(s.qid.slice(1)) + '</span></th><td>' + s.interviews.length + '</td><td>' + s.estimate + '%</td><td>' + (s.tally.k ? pc(s.tally.pct) : '–') + '</td><td>' + pc(s.survey.pct) + ' <span class="mono small nline">n = ' + s.survey.n + '</span></td><td class="nw">' + r0(s.miss) + ' pts</td><td>' + (s.sourced ? '✓ yes' : '✗ no') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<section class="lesson"><h3>A few voices are not the whole town</h3>' +
      (worst && best && worst !== best ? '<p>Your biggest miss was <b>' + r0(worst.miss) + ' points</b> on story ' + worst.slot.n + ', from ' + worst.tally.k + (worst.tally.k === 1 ? ' answer' : ' answers') + '. Your closest was <b>' + r0(best.miss) + ' points</b> on story ' + best.slot.n + ', from ' + best.tally.k + '.</p>' : '') +
      (tm ? '<details class="how"><summary>What happens with more interviews?</summary><p>In the simulation for your first story, a vox pop of 5 people typically missed the survey by <b>' + r0(tm.k5) + ' points</b>; with 30 people, by <b>' + r0(tm.k30) + '</b>. Asking more people doesn\'t make you right - it makes you less likely to be wrong by luck.</p></details>' : '') +
      '<p>This survey represents ' + S.n + ' people in Ireland (Maynooth University survey), not everyone.</p></section>' +
      '<section class="recap"><h3>Data ≠ opinion ≠ assumption</h3><ul>' +
      '<li>' + CHIP.assume + '<span>Your headlines were guesses.</span></li>' +
      '<li>' + CHIP.opinion + '<span>Interviews were simulated views. Survey answers are real views, not proof about data centres.</span></li>' +
      '<li>' + CHIP.data + '<span>You read ' + G.facts.size + ' sourced facts. Facts and feelings answer different questions.</span></li>' +
      '</ul></section>' +
      '<details class="device explore"><summary>Reporters on this device</summary><p>' + (runs.length ? runs.length + ' finished ' + (runs.length === 1 ? 'day' : 'days') + ' played in this browser. Average headline miss: <b>' + r0(devAvg) + ' points</b>. (Stored only on this device - not a live poll.)' : (storageOk() ? 'No finished days saved on this device yet.' : 'Nothing saved - this browser blocks storage.')) + '</p>' + (avgMiss ? '<p class="small muted">Your average miss today: ' + r0(avgMiss) + ' points.</p>' : '') + '</details>' +
      '<div class="row"><button class="btn primary big" type="button" id="end-again" data-autofocus>Play again</button><button class="btn ghost" type="button" id="end-how">How this works</button><a class="btn ghost" href="index.html">All games</a></div>' +
      '<section class="sources"><h3>Sources</h3><ul>' +
      '<li>Survey: <i>' + esc(S.meta.title) + '</i> - ' + esc(S.meta.source) + '. ' + S.n + ' respondents. Questions used: ' + Array.from(new Set(['q4'].concat(done.map((s) => s.qid)).concat(done.flatMap((s) => (Sim.Q[s.qid].extras || []).flatMap((e) => [e.by, e.of || s.qid]))))).map((x) => 'q' + x.slice(1)).join(', ') + '.</li>' +
      (G.visited.has('hall') ? '<li><a href="' + esc(F.csoSeries.url) + '" target="_blank" rel="noopener">' + esc(F.csoSeries.source) + '</a></li>' : '') +
      shownFacts.map((f) => '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.source) + '</a> (' + esc(f.year) + ', ' + esc(f.confidence) + ' confidence) - ' + esc(f.text) + '</li>').join('') +
      '</ul></section>' +
      '</div>';
    el.hidden = false;
    el.scrollTop = 0;
    $('#end-again').addEventListener('click', playAgain);
    $('#end-how').addEventListener('click', openHelp);
    focusIn(el);
  }

  /** Straight back to story 1's brief - no intro - keeping relaxed mode and what the player has learned. */
  function playAgain() {
    G = newState((Date.now() ^ (Math.random() * 1e9)) >>> 0);   // keeps relaxed mode and the taught labels
    hideAllPanels();
    $('#onair-banner').hidden = true;
    snapCamera();
    G.story = -1;
    nextStory();
  }

  /* ============================================================ how this works */
  let helpReturn = null;
  function openHelp() {
    helpReturn = document.activeElement;
    const el = $('#p-help');
    const dist = joinList(Sim.DISTRICTS.map((d) => d.inText + ' (' + d.area + ', ' + Sim.q4Count(d.key) + ' respondents)'));
    const per = Sim.residentsPerDistrict(RESIDENTS);
    el.innerHTML =
      '<h2 id="help-h" tabindex="-1">How this works</h2>' +
      '<p class="help-mode"><label class="check"><input type="checkbox" id="help-relaxed"' + (G.relaxed ? ' checked' : '') + '> Relaxed mode (no deadline)</label> <span class="muted small">The clock stops, so you can take your time.</span></p>' +
      '<h3>Controls</h3>' +
      '<p>Walk with the arrow keys or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, or click where you want to go. <kbd>E</kbd> interview someone or read a data point · <kbd>N</kbd> notebook · <kbd>F</kbd> file your story' + (Snd ? ' · <kbd>M</kbd> sound on or off' : '') + '.</p>' +
      '<h3>What\'s real and what\'s made up</h3>' +
      '<p><b>Real:</b> the survey - ' + S.n + ' people in Ireland (Maynooth University, <i>' + esc(S.meta.title) + '</i>) - and every fact on a teal marker, each with its source. <b>Made up:</b> the town of ' + TOWN + ' and everyone in it.</p>' +
      '<h3>How a resident answers</h3>' +
      '<p>The survey file only holds totals, never one person\'s answers, so the residents are synthetic. Each lives in a district that matches an answer to survey question q4 (how people described their local area): ' + esc(dist) + '. There are ' + per.urban + ', ' + per.suburban + ' and ' + per.rural + ' residents, in the same proportions.</p>' +
      '<p>When you ask someone a question, the game draws their answer at random from the q4 cross-tab: the answers given by real respondents from the same kind of area. The chance of "I\'d rather not say" is the share of those respondents who skipped that question. If a cross-tab cell were hidden (fewer than ' + (S.meta.min_cell || 3) + ' people), the game would use the overall answers instead.</p>' +
      '<p><b>Answers to different questions are drawn separately.</b> The survey doesn\'t tell us how any one person answered two questions, so a resident\'s answers aren\'t linked to each other - only to their district.</p>' +
      '<h3>Meet the ' + S.n + '</h3>' +
      '<p>After you go on air, ' + S.n + ' figures appear: one per survey respondent, using the real counts from the q4 cross-tab. They are a way of drawing the counts - no figure is a real person.</p>' +
      '<h3>100 parallel vox pops</h3>' +
      '<p>A simulation: 100 imaginary reporters each ask the same number of random residents as you did (answers drawn exactly as above). It shows how much a small sample moves by luck. It is not a prediction.</p>' +
      '<h3>Scoring</h3>' +
      '<p>Your miss is the gap between your headline number and the survey. ★★★ within 5 points, ★★ within 12, ★ within 20, plus one for citing a relevant fact. With small samples luck plays a big part - that is the point of the game.</p>' +
      (Snd ? '<h3>Sound</h3><p>' + soundCredits() + '</p>' : '') +
      '<h3>Labels</h3>' +
      '<ul class="legend small"><li>' + CHIP.data + '<span>Measured, with a source.</span></li><li>' + CHIP.opinion + '<span>What people say - your interviews and the survey.</span></li><li>' + CHIP.assume + '<span>Your guess - the headline number.</span></li></ul>' +
      '<div class="row"><button class="btn primary" type="button" id="help-close" data-autofocus>Close</button></div>';
    el.hidden = false;
    $('#help-close').addEventListener('click', closeHelp);
    $('#help-relaxed').addEventListener('change', (e) => setRelaxed(e.target.checked));
    focusIn(el);
  }
  /** Where the music and (on the voiced version) the voices come from. */
  function soundCredits() {
    const m = window.VP_MUSIC, v = window.VP_VOICES;
    const music = m && m.credit ? esc(m.credit) : (Snd && Snd.musicCredit ? esc(Snd.musicCredit) : 'Music made for this game.');
    const voices = Snd.hasVoices() ? ' The residents\' and the editor\'s voices are computer-generated (text to speech)' + (v && v.credit ? ': ' + esc(v.credit) : '') + '.' : '';
    return music + voices + ' Turn sound on or off with the Sound button or <kbd>M</kbd>.';
  }
  function closeHelp() {
    $('#p-help').hidden = true;
    if (helpReturn && document.body.contains(helpReturn) && !helpReturn.closest('[hidden]')) helpReturn.focus({ preventScroll: true });
    else if (G.mode === 'play') focusWorld();
  }

  /* ============================================================ wiring */
  // Browsers only start sound after a tap or a key press: the first one anywhere starts the music.
  if (Snd) ['pointerdown', 'click', 'keydown'].forEach((t) => document.addEventListener(t, () => Snd.unlock(), true));
  const sndBtn = $('#btn-sound');
  function syncSound() {
    if (!Snd || !sndBtn) return;
    sndBtn.hidden = false;
    sndBtn.setAttribute('aria-pressed', Snd.isMuted() ? 'false' : 'true');
  }
  function toggleSound() {
    Snd.unlock();
    Snd.toggleMuted();
    syncSound();
    announce(Snd.isMuted() ? 'Sound off.' : 'Sound on.');
  }
  if (Snd && sndBtn) { sndBtn.addEventListener('click', toggleSound); if (Snd.onChange) Snd.onChange(syncSound); syncSound(); }
  $('#btn-help').addEventListener('click', openHelp);
  $('#btn-talk').addEventListener('click', () => { interact(); });
  $('#btn-notebook').addEventListener('click', openNotebook);
  $('#btn-file').addEventListener('click', () => openFile(false));
  $('#ph-cap').innerHTML = 'Built on a survey of <b>' + S.n + '</b> people in Ireland (Maynooth University). Residents are made up; their answers are drawn from how real respondents answered.';
  drawPortrait($('#ph-av'), EDITOR);
  drawPortrait($('#coach-av'), EDITOR);
  window.addEventListener('resize', () => {
    resize();
    if (!G) return;
    if (G.mode === 'play') show('#minimap-wrap', G.taught.hud && vw > 700);
    if (G.mode === 'intro' || G.mode === 'brief') G.camShift = phoneShift();
  });

  function snapCamera() { const s = Wd.iso(G.player.x, G.player.y); view.x = s.x; view.y = s.y - 20; view.zoom = baseZoom; }

  /* ============================================================ debug screens (#screen=name) */
  const TAUGHT_ALL = () => ({ hud: true, opinion: true, data: true, assume: true, next: true });
  function debugPlay(n, storyIndex) {
    G.taught = TAUGHT_ALL();
    G.story = (storyIndex || 0) - 1;
    nextStory();
    chooseAngle(story().offered[0], true);
    const st = story();
    // interview the n residents closest to the bus stop, plus one on the farms
    const byDist = G.residents.slice().sort((a, b) => Math.hypot(a.x - Wd.spawn.x, a.y - Wd.spawn.y) - Math.hypot(b.x - Wd.spawn.x, b.y - Wd.spawn.y));
    byDist.slice(0, n).forEach((p) => { p.answers[st.qid] = Sim.sample(st.qid, p.district, G.ansRng); st.interviews.push({ rid: p.id, d: p.district, idx: p.answers[st.qid] }); });
    G.clock = 46;
    renderTally();
    updateClock();
    G.visited.add('library'); Wd.evidence.find((e) => e.id === 'library').facts.forEach((f) => G.facts.set(f, 'library'));
    // put a resident right next to the reporter
    const free = byDist.find((p) => !interviewed(p));
    if (free) { free.x = G.player.x + 0.9; free.y = G.player.y - 0.6; free.wait = 60; free.path = null; }
    snapCamera();
    return free;
  }
  function fakeStory(i, qid, n, est) {
    const slot = Sim.SLOTS[i];
    const st = { slot, offered: [qid], qid, interviews: [], estimate: null };
    G.stories[i] = st;
    G.story = i;
    const r = Sim.rng(G.seed + i);
    G.residents.slice(0, n).forEach((p) => { const idx = Sim.sample(qid, p.district, r); st.interviews.push({ rid: p.id, d: p.district, idx }); });
    return st;
  }
  const DEBUG = {
    start: () => showIntro(-1),
    beat1: () => showIntro(0),
    beat2: () => showIntro(1),
    beat3: () => showIntro(2),
    beat4: () => showIntro(3),
    help: () => { showIntro(0); openHelp(); },
    brief: () => { showIntro(BEATS.length - 1); endIntro(); },
    brief2: () => { G.taught = TAUGHT_ALL(); G.story = 0; nextStory(); },
    'first-walk': () => { G.story = -1; nextStory(); chooseAngle(story().offered[0], true); },
    play: () => { debugPlay(5); },
    evening: () => { debugPlay(4, 2); G.clock = 100; },
    talk: () => { const p = debugPlay(4); if (p) { startTalk(p); if (!reduced()) { clearTalkTimers(); finishTalkUI(); } } },
    fact: () => { debugPlay(3); openFact(Wd.evidence.find((e) => e.id === 'hall')); },
    notebook: () => { debugPlay(6); openNotebook(); },
    file: () => { debugPlay(6); openFile(false); },
    crowd: () => { debugPlay(6); openFile(false); goOnAir(55); G.crowd.figs.forEach((f) => { f.delay = 0; }); G.crowd.t0 = G.t - 3; view.x = MAP_C.x; view.y = MAP_C.y - 60; view.zoom = fitZoom(true); },
    report: () => { debugPlay(6); openFile(false); goOnAir(55); G.crowd.figs.forEach((f) => { f.delay = 0; }); G.crowd.t0 = G.t - 3; updateCrowd(); showReport(); const z = fitZoom(true); view.zoom = z; view.x = MAP_C.x + (Math.min(REPORT_W + 40, vw * 0.5) / 2) / z; view.y = MAP_C.y - 60; },
    end: () => {
      [['q67', 5, 45], ['q11', 9, 40], ['q97', 3, 60]].forEach((d, i) => {
        const st = fakeStory(i, d[0], d[1], d[2]);
        const tally = tallyOf(st);
        st.estimate = d[2]; st.tally = tally; st.survey = Sim.surveyResult(d[0]);
        st.miss = Math.abs(d[2] - st.survey.pct); st.stars = st.miss <= 5 ? 3 : st.miss <= 12 ? 2 : st.miss <= 20 ? 1 : 0;
        st.sourced = i === 1; st.typMiss = typicalMiss(d[0], st.survey.pct);
      });
      G.visited.add('hall'); G.facts.set('ie-share-2025', 'hall'); G.shown.add('ie-share-2025');
      G.facts.set('prompt-gemini', 'library'); G.shown.add('prompt-gemini');
      showEnd(true);
    },
  };

  /* ============================================================ boot */
  function boot() {
    const m = /(?:^#|&)screen=([\w-]+)/.exec(window.location.hash || '');
    const name = m && DEBUG[m[1]] ? m[1] : null;
    phClear();
    clearTalkTimers();
    G = null;
    G = newState(name ? 7 : (Date.now() ^ (Math.random() * 1e9)) >>> 0);
    G.debug = !!name;
    hideAllPanels();
    $('#p-help').hidden = true;
    $('#onair-banner').hidden = true;
    setHud(false);
    if (name) DEBUG[name]();
    else showIntro();
  }
  resize();
  boot();
  window.addEventListener('hashchange', () => { if (/screen=/.test(window.location.hash)) boot(); });
  requestAnimationFrame(frame);
})();

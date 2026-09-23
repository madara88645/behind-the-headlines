/*
 * 5 KM - Ireland says yes. Would your street?
 * Every survey number is computed at runtime from window.Survey (shared/survey.js).
 * Every fact comes from window.DC_FACTS (data/facts.js) and is shown with its source link.
 * Debug screens: add #screen=<name> to the URL (start, view, national, midzoom, zoom, local, area,
 * hall, predict, reveal, revise, nearby, twist, report).
 */
(function () {
  'use strict';

  const S = window.Survey;
  const F = window.DC_FACTS || { facts: [] };
  const SC = window.FiveKmScenes;
  if (!S) return; // survey.js already shows a friendly message

  /* ------------------------------------------------------------ helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reduced = () => !!RM.matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pc = (p) => S.fmt(p);
  const has = (id) => { try { S.q(id); return true; } catch (e) { return false; } };
  const fact = (id) => (F.facts || []).find((f) => f.id === id) || null;
  const narrow = () => window.innerWidth < 900;
  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const arrow = '<span class="arr" aria-hidden="true">→</span>';
  // sentence-case a card name mid-sentence without breaking acronyms ("STEM in local schools")
  const lc = (t) => String(t).replace(/\b([A-Z])(?=[a-z])/g, (m) => m.toLowerCase());
  const SMALL_N = 30;
  const BUDGET = 6;
  const MAJORITY = 51;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rand = Math.random;
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function rangeTxt(r) {
    const lo = Math.round(r[0]), hi = Math.round(r[1]);
    return lo === hi ? lo + '%' : lo + '–' + hi + '%';
  }

  /* ------------------------------------------------------------ data */
  const ACCEPT = (o) => o.value != null && o.value >= 4;
  const usedFacts = new Set();

  const COND_DEF = [
    { id: 'q78', short: 'Renewable power', cost: 3, icon: 'wind', fact: 'ie-cru-2025' },
    { id: 'q79', short: 'Waste heat for homes', cost: 3, icon: 'heat', fact: 'ie-tallaght' },
    { id: 'q80', short: 'Community fund', cost: 2, icon: 'fund' },
    { id: 'q81', short: 'Local jobs quota', cost: 2, icon: 'jobs', fact: 'ie-jobs' },
    { id: 'q82', short: 'Independent monitoring', cost: 1, icon: 'monitor' },
    { id: 'q83', short: 'Landscape-friendly design', cost: 2, icon: 'landscape' },
    { id: 'q84', short: 'Open days', cost: 1, icon: 'door' },
    { id: 'q85', short: 'STEM in local schools', cost: 1, icon: 'stem' },
    { id: 'q86', short: 'Lower local bills', cost: 3, icon: 'bills', fact: 'ie-bills' },
    { id: 'q87', short: 'Liaison committee', cost: 1, icon: 'committee' },
  ];

  const AREAS = [
    { key: 'urban', re: /^Urban/, name: 'Urban', sub: 'city or large town' },
    { key: 'suburban', re: /^Suburban/, name: 'Suburban', sub: 'edge of a city or town' },
    { key: 'rural', re: /^Rural/, name: 'Rural', sub: 'countryside' },
  ];
  const NEAR = [
    { match: 'Yes', name: 'Said yes: one within 10 km', you: 'said yes' },
    { match: 'No', name: 'Said no', you: 'said no' },
    { match: "I don't know", name: "Said they don't know", you: "said they don't know" },
  ];

  function buildData() {
    const D = { ok: false };
    if (!has('q96') || !has('q77')) return D;
    D.q96 = S.q('q96');
    D.q77 = S.q('q77');
    D.n96 = D.q96.n_answered;
    D.n77 = D.q77.n_answered;
    D.support = S.pct('q96', /supportive/);
    D.accept = S.pct('q77', ACCEPT);
    D.acceptLabels = D.q77.options.filter(ACCEPT).map((o) => o.label);
    D.minCell = (S.meta && S.meta.min_cell) || 3;

    // cross-tab helper that keeps the group size even when the cell is suppressed
    D.within = function (by, byMatch, of) {
      if (!has(by) || !has(of)) return null;
      const rows = S.crosstab(by, of);
      if (!rows) return null;
      const bp = byMatch instanceof RegExp ? (r) => byMatch.test(r.label) : (r) => r.label === byMatch || r.short === byMatch;
      const row = rows.find(bp);
      if (!row) return null;
      const r = S.within(by, byMatch, of, D.acceptLabels);
      return { pct: r ? r.pct : null, n: row.n, label: row.label };
    };

    D.areas = has('q4') ? AREAS.map((a) => Object.assign({}, a, { r: D.within('q4', a.re, 'q77') })).filter((a) => a.r) : [];
    D.near = has('q7') ? NEAR.map((a) => Object.assign({}, a, { r: D.within('q7', a.match, 'q77') })).filter((a) => a.r) : [];
    D.strongSupp = D.within('q96', 'Strongly supportive', 'q77');
    D.q74 = has('q74') ? { agree: S.agree('q74'), n: S.q('q74').n_answered, q: S.q('q74') } : null;

    // How did people's 5 km answer compare with their national answer? (ranges, because small cells are hidden)
    D.gap = (function () {
      const rows = S.crosstab('q96', 'q77');
      if (!rows) return null;
      const o96 = D.q96.options, o77 = D.q77.options;
      const acc = { less: [0, 0], same: [0, 0], more: [0, 0] };
      let n = 0;
      rows.forEach((row, i) => {
        const v = o96[i] && o96[i].value;
        if (v == null || !row.n) return;
        n += row.n;
        row.cells.forEach((c, j) => {
          const w = o77[j] && o77[j].value;
          if (w == null) return;
          const k = w < v ? 'less' : w === v ? 'same' : 'more';
          if (c.count == null) acc[k][1] += D.minCell - 1;
          else { acc[k][0] += c.count; acc[k][1] += c.count; }
        });
      });
      if (!n) return null;
      const out = { n: n };
      Object.keys(acc).forEach((k) => { out[k] = [100 * acc[k][0] / n, 100 * Math.min(acc[k][1], n) / n]; });
      out.ranged = Object.keys(acc).some((k) => acc[k][0] !== acc[k][1]);
      return out;
    })();

    // The town hall: q77 scaled to 100 residents with largest-remainder rounding
    const opts = D.q77.options.filter((o) => o.value != null).slice().sort((a, b) => a.value - b.value);
    const total = opts.reduce((s, o) => s + o.count, 0);
    const raw = opts.map((o) => (o.count / total) * 100);
    const base = raw.map(Math.floor);
    let left = 100 - base.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - base[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach((p) => { base[p[1]] += 1; });
    D.room = opts.map((o, i) => ({ value: o.value, label: o.label, count: base[i] }));
    D.roomBy = {};
    D.room.forEach((g) => { D.roomBy[g.value] = g.count; });
    [1, 2, 3, 4, 5].forEach((v) => { if (D.roomBy[v] == null) D.roomBy[v] = 0; });
    D.roomAccept = D.roomBy[4] + D.roomBy[5];

    // The ten conditions, matched to their q88 "top three" option by text
    D.conds = [];
    D.hl = []; D.hlUp = []; D.hlDown = [];
    if (has('q88')) {
      const q88 = S.q('q88');
      D.n88 = q88.n_answered;
      const pickOpts = q88.options.filter((o) => !/something else/i.test(o.label));
      const key = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 25);
      COND_DEF.forEach((def) => {
        if (!has(def.id)) return;
        const label = S.label(def.id);
        const m = pickOpts.find((o) => key(o.label) === key(label));
        if (!m) return;
        D.conds.push(Object.assign({}, def, {
          label: label,
          rating: S.pct(def.id, ACCEPT),
          nRating: S.q(def.id).n_answered,
          pick: m.pct,
        }));
      });
      D.conds.slice().sort((a, b) => b.rating - a.rating).forEach((c, i) => { c.rRank = i + 1; });
      D.conds.slice().sort((a, b) => b.pick - a.pick).forEach((c, i) => { c.pRank = i + 1; });
      D.conds.forEach((c) => { c.diff = c.rRank - c.pRank; });
      // Biggest mismatches: every condition tied for the largest positive rank gap (picked far
      // above its rating) and every one tied for the largest negative gap (rated far above its pick).
      // Ties are all highlighted rather than broken by array order.
      if (D.conds.length >= 2) {
        const maxUp = Math.max.apply(null, D.conds.map((c) => c.diff));
        const maxDown = Math.min.apply(null, D.conds.map((c) => c.diff));
        const byGap = (a, b) => Math.abs(b.pick - b.rating) - Math.abs(a.pick - a.rating);
        D.hlUp = maxUp > 0 ? D.conds.filter((c) => c.diff === maxUp).sort(byGap) : [];
        D.hlDown = maxDown < 0 ? D.conds.filter((c) => c.diff === maxDown).sort(byGap) : [];
        D.hl = D.hlUp.concat(D.hlDown).map((c) => c.id);
      } else { D.hl = []; D.hlUp = []; D.hlDown = []; }
    }
    D.byId = {};
    D.conds.forEach((c) => { D.byId[c.id] = c; });
    D.hallOk = D.conds.length >= 3;
    D.ok = true;
    return D;
  }

  const D = buildData();

  /* ------------------------------------------------------------ icons */
  const I = (p) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ICONS = {
    wind: I('<path d="M12 10.5V21M8.5 21h7"/><circle cx="12" cy="9" r="1.6"/><path d="M12 7.4V2.2M13.4 9.8l4.5 2.6M10.6 9.8l-4.5 2.6"/>'),
    heat: I('<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10v10.5h13V10"/><path d="M9 18.5c-1-1.3.9-2.3 0-4M12 18.5c-1-1.3.9-2.3 0-4M15 18.5c-1-1.3.9-2.3 0-4"/>'),
    fund: I('<path d="M12 20.5s-7-4.3-7-9.4A3.9 3.9 0 0 1 12 8.6a3.9 3.9 0 0 1 7 2.5c0 5.1-7 9.4-7 9.4Z"/><path d="M12 2.5v3M8 3.6l1.2 2.1M16 3.6l-1.2 2.1"/>'),
    jobs: I('<path d="M3 17.5h18M5 17.5a7 7 0 0 1 14 0"/><path d="M10 10.8V7.5h4v3.3"/><path d="M3 17.5v2h18v-2"/>'),
    monitor: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/><path d="m7.8 10.7 2 2 3.7-3.9"/>'),
    landscape: I('<path d="M2 20.5h20"/><path d="M4 20.5v-7.5l6-3.5 6 3.5v7.5"/><path d="M8 20.5V17h4v3.5"/><circle cx="19.2" cy="10.8" r="2.6"/><path d="M19.2 13.4v7.1"/>'),
    door: I('<path d="M3.5 21h17"/><path d="M6 21V3.5h9V21"/><path d="M15 5.2 19 4v17l-4-1"/><circle cx="12.4" cy="12.6" r=".7" fill="currentColor"/>'),
    stem: I('<path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.4 15h9.2"/>'),
    bills: I('<path d="M6 2.5h12v19l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 21.5z"/><path d="M12 6.8v7.6M9 11.4l3 3 3-3"/>'),
    committee: I('<circle cx="7.5" cy="8" r="2.5"/><circle cx="16.5" cy="8" r="2.5"/><path d="M2.5 19.5c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2"/><path d="M11.5 19.5c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2"/>'),
  };

  /* ------------------------------------------------------------ state */
  const fresh = () => ({
    screen: 'start', step: null, debug: false,
    q96: null, guess1: 50, guessLocked: false, zooming: false, zoomDone: false,
    q77: null, area: null,
    round: 1, phase: 'build', sel: [], guesses: [], results: [], best: null, bestSel: null, knows: false,
    saved: false, lock: false, nearGuess: null,
  });
  let st = fresh();

  /* ------------------------------------------------------------ shared bits */
  function factHTML(id) {
    const f = fact(id);
    if (!f) return '';
    usedFacts.add(id);
    const low = f.confidence === 'low' ? ' <span class="small-n">single estimate</span>' : '';
    return '<p class="fact"><span class="tag data">Data</span> ' + esc(f.text) + low +
      ' <a class="src" href="' + esc(f.url) + '" target="_blank" rel="noopener">Source: ' + esc(f.source) + ' ↗</a></p>';
  }
  function growBars(root) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$('[data-w]', root).forEach((el) => el.style.setProperty('--w', el.dataset.w + '%'));
    }));
  }
  const segColor = (v) => ({ 1: '#B8322A', 2: '#DB8E86', 3: '#C3C6BD', 4: '#7DB0C4', 5: '#1F6E8C' }[v] || null);
  function stackHTML(q, youIdx, ends) {
    let acc = 0, youLeft = null;
    const segs = q.options.map((o, i) => {
      const left = acc;
      acc += o.pct;
      if (i === youIdx) youLeft = left + o.pct / 2;
      const col = segColor(o.value);
      return '<i' + (col ? ' style="width:' + o.pct + '%;background:' + col + '"' : ' class="sup" style="width:' + o.pct + '%"') + '></i>';
    }).join('');
    const legend = q.options.map((o) => {
      const col = segColor(o.value);
      return '<span><i style="' + (col ? 'background:' + col : 'background:repeating-linear-gradient(45deg,#C9CCC3 0 3px,#EEF0EA 3px 6px)') + '"></i>' + esc(o.short || o.label) + ' ' + pc(o.pct) + '</span>';
    }).join('');
    const you = youLeft != null ? '<span class="you" style="left:' + Math.min(96, Math.max(4, youLeft)) + '%">You</span>' : '';
    return '<div class="stack' + (you ? ' has-you' : '') + '">' + you + '<div class="stack-bar" role="img" aria-label="' + esc(q.options.map((o) => (o.short || o.label) + ' ' + pc(o.pct)).join(', ')) + '">' + segs + '</div>' +
      (ends ? '<div class="stack-ends"><span>' + esc(ends[0]) + '</span><span>' + esc(ends[1]) + '</span></div>' : '') +
      '<div class="seg-legend" aria-hidden="true">' + legend + '</div></div>';
  }

  /* ------------------------------------------------------------ screens */
  const ACT_OF = { start: 0, act1: 1, hall: 2, twist: 3, report: 3 };
  function show(name, focus) {
    st.screen = name;
    $$('.screen').forEach((s) => {
      const on = s.dataset.screen === name;
      s.hidden = !on;
      if (on) { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); }
    });
    const act = ACT_OF[name] || 0;
    $$('.acts li').forEach((li) => {
      const n = +li.dataset.act;
      li.classList.toggle('on', n === act);
      li.classList.toggle('done', n < act);
      if (n === act) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (focus) {
      const scr = $('.screen[data-screen="' + name + '"]');
      const h = scr && scr.querySelector('h1, h2');
      if (h) h.focus({ preventScroll: true });
    }
  }

  /* ============================================================ ACT 1: THE ZOOM */
  const SCENE_NAMES = [
    { t: 'Ireland', scale: '1:2 500 000' },
    { t: 'Your county', scale: '1:250 000' },
    { t: 'Your town', scale: '1:25 000' },
    { t: 'Your street', scale: '1:1 250' },
  ];
  const GRID = ['', 'N 612 294', 'N 598 311', 'N 603 287', 'N 604 285', 'N 604 286'];
  const scenes = $$('.scene');
  let scenesDrawn = false;
  function drawScenes() {
    if (scenesDrawn || !SC) return;
    const fns = [SC.ireland, SC.county, SC.town, SC.street];
    scenes.forEach((s, i) => { s.innerHTML = fns[i](); });
    scenesDrawn = true;
  }
  function setScene(i, instant) {
    scenes.forEach((s, k) => {
      if (instant) s.classList.add('instant');
      s.classList.toggle('on', k === i);
      s.classList.toggle('past', k < i);
      s.setAttribute('aria-hidden', String(k !== i)); // only the visible map is announced
    });
    if (instant) { void document.body.offsetWidth; scenes.forEach((s) => s.classList.remove('instant')); }
    const sn = SCENE_NAMES[i];
    $('#scene-label').textContent = sn.t + ' · ' + sn.scale;
    $('#stage-cap').textContent = 'Map: ' + sn.t;
  }

  const M = {
    el: $('#meter'), val: $('#meter-val'), cap: $('#meter-cap'), capS: $('#meter-cap-s'), q: $('#meter-q'), gm: $('#guess-mark'), cur: 0,
  };
  function meterShow(on) { M.el.classList.toggle('is-hidden', !on); }
  function meterSet(v) {
    M.cur = v;
    M.val.textContent = Math.round(v);
    M.el.style.setProperty('--w', Math.max(0, Math.min(100, v)) + '%');
  }
  // cap = full caption (desktop); short = one-line caption kept on phones so the number never stands alone
  function meterText(q, cap, short) { M.q.textContent = q; M.cap.textContent = cap; M.capS.textContent = short || cap; }
  function tweenMeter(from, to, ms, inOut) {
    if (!ms || reduced()) { meterSet(to); return Promise.resolve(); }
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = inOut ? (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) : 1 - Math.pow(1 - k, 3);
        meterSet(from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step); else { meterSet(to); res(); }
      };
      requestAnimationFrame(step);
    });
  }
  function meterGuess(g) {
    M.gm.hidden = false;
    M.el.classList.add('has-guess');
    M.el.style.setProperty('--g', g + '%');
    const lab = M.gm.querySelector('span');
    lab.textContent = 'You guessed ' + g + '%';
    lab.style.left = g < 22 ? '0' : g > 78 ? 'auto' : '50%';
    lab.style.right = g > 78 ? '0' : 'auto';
    lab.style.transform = g < 22 || g > 78 ? 'none' : 'translateX(-50%)';
  }
  function stampOn(slam) {
    const s = $('#stamp');
    $('#stamp-txt').textContent = pc(D.support) + ' → ' + pc(D.accept);
    s.classList.add('on');
    if (slam && !reduced()) { s.classList.remove('slam'); void s.offsetWidth; s.classList.add('slam'); }
  }
  function resetStage() {
    scenes.forEach((s) => { s.classList.add('instant'); s.classList.remove('on', 'past'); s.setAttribute('aria-hidden', 'true'); });
    void document.body.offsetWidth;
    scenes.forEach((s) => s.classList.remove('instant'));
    M.el.classList.remove('drop', 'has-guess', 'zooming');
    M.gm.hidden = true;
    meterShow(false);
    meterSet(0);
    $('#stamp').classList.remove('on', 'slam');
  }

  /* notice */
  const NB = $('#notice1-body');
  const RAIL_EL = $('#rail'), SIDE = $('.side-col');
  // The "You" rail normally sits under the notice. For the two-pin moment it moves inside the
  // notice (under the verdict) so the stretch plays on screen next to the text that explains it.
  function railHome() {
    if (RAIL_EL.parentNode !== SIDE) SIDE.appendChild(RAIL_EL);
    RAIL_EL.classList.remove('in-notice');
  }
  function railIntoNotice() {
    const slot = $('.rail-slot', NB);
    if (!slot) return;
    slot.appendChild(RAIL_EL);
    RAIL_EL.classList.add('in-notice');
  }
  function nhead(sheet, extra) {
    return '<div class="nhead"><p class="ntitle">Notice</p><p class="gridref">Grid ref. ' + GRID[sheet] + ' · Sheet ' + sheet + ' of 5' + (extra ? ' · ' + extra : '') + '</p></div>';
  }
  // scrollTo: which part of the page to bring into view on narrow screens ('notice', 'stage' or 'none')
  function notice(html, focus, scrollTo) {
    railHome(); // never destroy the rail when the notice body is replaced
    NB.innerHTML = '<div class="nbody-in">' + html + '</div>';
    if (focus) {
      const h = NB.querySelector('[data-focus]');
      if (h) h.focus({ preventScroll: true });
      const target = scrollTo === 'none' ? null : scrollTo === 'stage' ? $('#stage') : $('#notice1');
      if (target && narrow()) target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
  }
  function bindSlider(sel, outSel, onChange) {
    const inp = $(sel), out = $(outSel);
    if (!inp) return;
    const upd = () => {
      const v = +inp.value;
      inp.style.setProperty('--p', v + '%');
      out.innerHTML = v + '<small>%</small>';
      onChange(v);
    };
    inp.addEventListener('input', upd);
    upd();
  }

  function stepView(focus) {
    st.step = 'view';
    const q = D.q96;
    notice(nhead(1, 'Your view') +
      '<p class="nkick">Your view, zoomed out</p>' +
      '<p class="nq" tabindex="-1" data-focus>' + esc(q.text) + '</p>' +
      '<div class="opts" role="group" aria-label="Your answer">' +
      q.options.map((o, i) => '<button type="button" class="opt" data-act="q96" data-i="' + i + '" aria-pressed="' + (st.q96 === i) + '">' + esc(o.label) + '</button>').join('') +
      '</div>' +
      '<p class="nfoot">This is the survey\'s own question (q96). ' + D.n96 + ' of the ' + S.n + ' people surveyed in Ireland (Maynooth University survey) answered it before you.</p>', focus, 'none');
  }

  function stepNational(focus, instant) {
    st.step = 'national';
    meterShow(true);
    meterText('Survey q96', 'of the ' + S.n + ' people surveyed in Ireland support sustainable data centres', 'of those surveyed support them');
    if (instant) meterSet(D.support); else tweenMeter(0, D.support, 1100);
    notice(nhead(2, 'Ireland') +
      '<p class="nkick">Zoomed out: Ireland</p>' +
      '<p class="big-line" tabindex="-1" data-focus><strong>' + pc(D.support) + '</strong> of the ' + S.n + ' people surveyed in Ireland support sustainable data centres.</p>' +
      '<p class="meta"><span class="tag opinion">Opinion</span><span class="muted">Survey q96 · ' + D.n96 + ' answered · "somewhat" + "strongly supportive"</span></p>' +
      '<hr class="rule">' + factHTML('ie-share-2025') + '<hr class="rule">' +
      '<p class="nkick">Now we zoom in to 5 km from home</p>' +
      '<label class="nq" for="guess1">What share do you think will still say yes?</label>' +
      '<div class="slider"><input type="range" id="guess1" min="0" max="100" step="1" value="' + st.guess1 + '" aria-describedby="g1-hint"><output for="guess1" id="guess1-out"></output></div>' +
      '<p class="meta" id="g1-hint"><span class="tag assume">Assumption</span><span class="muted">Your guess. It locks before the zoom.</span></p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="lock1">Lock my guess ' + arrow + '</button></div>', focus, 'stage');
    bindSlider('#guess1', '#guess1-out', (v) => { st.guess1 = v; });
  }

  function zoomStepsHTML(on) {
    return '<ol class="zoom-steps">' + SCENE_NAMES.map((s, i) => '<li class="' + (i <= on ? 'on' : '') + '"><span>' + s.t + '</span><span class="mono">' + s.scale + '</span></li>').join('') + '</ol>';
  }
  function stepZoomReady(focus) {
    st.step = 'zoomready';
    notice(nhead(3, 'The zoom') +
      '<p class="nkick">Guess locked: ' + st.guess1 + '%</p>' +
      '<p class="nq" tabindex="-1" data-focus>From the whole country to your own street, in four steps. Keep an eye on the meter.</p>' +
      zoomStepsHTML(0) +
      '<div class="actions"><button type="button" class="btn primary big" data-act="zoom" id="zoom-btn">Zoom in to 5 km <span aria-hidden="true">⊕</span></button></div>' +
      '<p class="nfoot">One press. The map does the rest.</p>', focus);
  }

  async function playZoom() {
    if (st.zooming || st.zoomDone) return;
    st.zooming = true;
    const btn = $('#zoom-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Zooming in…'; }
    if (narrow()) $('#stage').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    await wait(narrow() ? 450 : 80);
    const from = D.support, to = D.accept;
    // The meter slides continuously from one survey number to the other across the whole zoom and
    // never rests on an in-between value, so no county or town figure is implied. While moving it
    // is drawn outlined without a % sign; only the two real endpoints look like results.
    const per = reduced() ? 650 : 1160;
    meterText('Zooming in', 'moving between the two survey numbers (not a result)', 'moving (not a result)');
    M.el.classList.add('zooming', 'drop');
    const tw = reduced() ? Promise.resolve() : tweenMeter(from, to, per * 3 - 200, true);
    for (let i = 1; i <= 3; i++) {
      setScene(i);
      const list = $$('.zoom-steps li');
      list.forEach((li, k) => li.classList.toggle('on', k <= i));
      await wait(per);
    }
    await tw;
    meterSet(to);
    meterText('Survey q77', 'would accept one within 5 km of home', 'would accept one within 5 km');
    M.el.classList.remove('zooming');
    if (!reduced()) { const sg = $('#stage'); sg.classList.remove('shake'); void sg.offsetWidth; sg.classList.add('shake'); }
    stampOn(true);
    st.zooming = false;
    st.zoomDone = true;
    await wait(reduced() ? 200 : 700);
    stepLanded(true);
  }

  function stepLanded(focus) {
    st.step = 'landed';
    const diff = Math.round(st.guess1) - Math.round(D.accept);
    const diffTxt = Math.abs(diff) <= 3 ? 'Spot on - within 3 points of the survey.' :
      diff > 0 ? 'You were ' + diff + ' points more hopeful than the survey.' : 'You were ' + (-diff) + ' points gloomier than the survey.';
    const ss = D.strongSupp;
    let ssTxt = '';
    if (ss && ss.pct != null) {
      ssTxt = ' Even among people who are <b>strongly supportive</b> nationally, only ' + pc(ss.pct) + ' would accept one this close' +
        (ss.n < SMALL_N ? ' <span class="small-n">small group (n = ' + ss.n + ')</span>' : ' (n = ' + ss.n + ')') + '.';
    }
    notice(nhead(3, 'Your street') +
      '<p class="nkick">Zoomed in: 5 km from home</p>' +
      '<p class="big-line" tabindex="-1" data-focus>Only <strong>' + pc(D.accept) + '</strong> of the people surveyed would accept a sustainable data centre within 5 km of home.</p>' +
      '<p class="meta"><span class="tag opinion">Opinion</span><span class="muted">Survey q77 · ' + D.n77 + ' answered · "somewhat" + "completely acceptable"</span></p>' +
      '<div class="vs"><div><span class="tag assume">Assumption</span><span class="mono">You guessed</span><b>' + st.guess1 + '%</b></div>' +
      '<div><span class="tag opinion">Opinion</span><span class="mono">The survey</span><b>' + pc(D.accept) + '</b></div></div>' +
      '<p class="nbody">' + diffTxt + ssTxt + '</p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="toLocal">Your turn: your own street ' + arrow + '</button></div>' +
      '<details class="how"><summary>How the meter works</summary><div class="how-body">The meter only ever shows two survey results: q96 (attitude to sustainable data centres in Ireland, ' + D.n96 + ' answered, counting "somewhat" and "strongly supportive") and q77 (a sustainable data centre within 5 km of home, ' + D.n77 + ' answered, counting "somewhat" and "completely acceptable"). The outlined numbers it slides through during the zoom are animation, not survey results for counties or towns.</div></details>', focus, 'none');
  }

  function stepLocal(focus) {
    st.step = 'local';
    notice(nhead(4, 'Your view') +
      '<p class="nkick">Your view, zoomed in</p>' +
      '<p class="nq" tabindex="-1" data-focus>' + esc(D.q77.text) + '</p>' +
      '<div class="opts" role="group" aria-label="Your answer">' +
      D.q77.options.map((o) => '<button type="button" class="opt" data-act="q77" data-v="' + o.value + '" aria-pressed="' + (st.q77 === o.value) + '">' + esc(o.label) + '</button>').join('') +
      '</div>' +
      '<p class="nfoot">The survey\'s question q77. Same five steps as before - watch your two pins.</p>', focus);
  }

  function v96() { return st.q96 == null ? null : D.q96.options[st.q96].value; }

  function stepLocalDone(focus) {
    st.step = 'localdone';
    const a = v96(), b = st.q77, g = D.gap;
    let verdict, detail = '';
    if (a == null) {
      verdict = 'No national view - fair enough.';
      const none = D.q96.options.find((o) => o.value == null);
      detail = 'You said you don\'t have enough information to form a view' + (none ? ', like ' + pc(none.pct) + ' of the survey' : '') + '. Your 5 km answer is pinned on its own.';
    } else if (b < a) {
      verdict = 'You just did what the survey found.';
      detail = 'You\'re less keen on one near home than on sustainable data centres in general.' + (g ? ' In the survey, ' + rangeTxt(g.less) + ' of people did the same.' : '');
    } else if (b === a) {
      verdict = 'You\'re consistent - most people in the survey weren\'t.';
      detail = g ? 'Only ' + rangeTxt(g.same) + ' gave both questions the same score.' : '';
    } else {
      verdict = 'Your street gets a warmer answer than Ireland does.';
      if (g) {
        const rarest = g.more[1] < Math.min(g.less[0], g.same[0]);
        detail = rarest ? 'That was the rarest direction in the survey: ' + rangeTxt(g.more) + ' of people.' : rangeTxt(g.more) + ' of people in the survey did the same.';
      }
    }
    const meta = g ? '<p class="meta"><span class="tag opinion">Opinion</span><span class="muted">Survey q96 × q77 · ' + g.n + ' people' + (g.ranged ? ' · shown as a range because groups under ' + D.minCell + ' people are hidden' : '') + '</span></p>' : '';
    notice(nhead(4, 'Your two answers') +
      '<p class="nkick">Your two answers</p>' +
      '<p class="verdict" tabindex="-1" data-focus>' + verdict + '</p>' +
      '<div class="rail-slot"></div>' +
      '<p class="nbody">' + detail + '</p>' + meta +
      '<div class="actions"><button type="button" class="btn primary" data-act="toArea">Where do you live? ' + arrow + '</button></div>', focus);
    railIntoNotice();
  }

  function areaResultHTML() {
    const rows = D.areas.map((a) => {
      const r = a.r, me = a.key === st.area, ok = r.pct != null;
      const small = r.n && r.n < SMALL_N ? ' · <span class="small-n">small group (n = ' + r.n + ')</span>' : '';
      return '<div class="trow' + (me ? ' me' : '') + '"><span class="tl">' + a.name + (me ? '<span class="you-chip">You</span>' : '') +
        '<small>n = ' + (r.n || '–') + small + '</small></span>' +
        '<span class="tb" aria-hidden="true"><i data-w="' + (ok ? r.pct : 0) + '"></i></span>' +
        '<span class="tv' + (ok ? '' : ' na') + '">' + (ok ? pc(r.pct) : 'too few people') + '</span></div>';
    }).join('');
    const valid = D.areas.filter((a) => a.r.pct != null);
    let copy = '';
    if (valid.length >= 2) {
      const hi = valid.reduce((x, y) => (y.r.pct > x.r.pct ? y : x));
      const lo = valid.reduce((x, y) => (y.r.pct < x.r.pct ? y : x));
      const mine = D.areas.find((a) => a.key === st.area);
      copy = 'In this survey, ' + hi.name.toLowerCase() + ' residents were the most open (' + pc(hi.r.pct) + ') and ' + lo.name.toLowerCase() + ' residents the least (' + pc(lo.r.pct) + ').';
      if (mine && mine.r.pct != null) {
        const gap = Math.round(D.support) - Math.round(mine.r.pct);
        const rel = gap >= 5 ? gap + ' points below' : gap <= -5 ? (-gap) + ' points above' : 'close to';
        copy += ' Your group: ' + pc(mine.r.pct) + ' would accept one within 5 km, ' + rel + ' the ' + pc(D.support) + ' who support sustainable data centres in general (q96, a different question).';
      }
    }
    return '<div class="trio" role="list" aria-label="Would accept within 5 km, by local area">' + rows + '</div>' +
      '<p class="nbody">' + copy + '</p>' +
      '<p class="meta"><span class="tag opinion">Opinion</span><span class="muted">Survey q4 × q77 · would accept one within 5 km</span></p>' +
      '<div class="actions"><button type="button" class="btn primary" data-act="toHall">Act 2: the town hall ' + arrow + '</button></div>';
  }
  function stepArea(focus) {
    st.step = 'area';
    if (!D.areas.length) { // no area data: skip straight on
      notice(nhead(5) + '<p class="verdict" tabindex="-1" data-focus>On to the town hall.</p><div class="actions"><button type="button" class="btn primary" data-act="toHall">Act 2: the town hall ' + arrow + '</button></div>', focus);
      return;
    }
    const q4 = S.q('q4');
    notice(nhead(5, 'Where you live') +
      '<p class="nkick">Where do you live?</p>' +
      '<p class="nq" tabindex="-1" data-focus>' + esc(q4.text) + '</p>' +
      '<div class="opts three" role="group" aria-label="Your local area">' +
      D.areas.map((a) => '<button type="button" class="opt" data-act="area" data-k="' + a.key + '" aria-pressed="' + (st.area === a.key) + '">' + a.name + '<small>' + a.sub + '</small></button>').join('') +
      '</div>' +
      (st.area ? areaResultHTML() : '<p class="nfoot">Pick one to see how people in each kind of place answered the 5 km question.</p>'), focus);
    growBars(NB);
  }

  /* rail */
  const RAIL = { body: $('.rail-body'), a: $('#pin-a'), b: $('#pin-b'), none: $('#pin-none'), path: $('#elastic-path'), svg: $('#elastic') };
  let elasticRAF = 0;
  const railX = (v) => 6 + ((v - 1) / 4) * 88;
  function railY() {
    const b = RAIL.body.getBoundingClientRect();
    const lines = $$('.track-line', RAIL.body).map((l) => l.getBoundingClientRect().top - b.top + 1);
    return { a: lines[0], b: lines[1], h: b.height || 1 };
  }
  function layoutRail(animatePins) {
    const y = railY();
    const a = v96();
    if (st.q96 != null && a != null) {
      RAIL.a.hidden = false; RAIL.none.hidden = true;
      RAIL.a.style.setProperty('--x', railX(a) + '%');
      RAIL.a.style.setProperty('--y', y.a + 'px');
      if (animatePins === 'a') { RAIL.a.classList.remove('drop'); void RAIL.a.offsetWidth; RAIL.a.classList.add('drop'); }
    } else if (st.q96 != null) {
      RAIL.a.hidden = true; RAIL.none.hidden = false;
      RAIL.none.style.top = Math.max(0, y.a - 34) + 'px';
    } else { RAIL.a.hidden = true; RAIL.none.hidden = true; }
    if (st.q77 != null) {
      RAIL.b.hidden = false;
      RAIL.b.style.setProperty('--x', railX(st.q77) + '%');
      RAIL.b.style.setProperty('--y', y.b + 'px');
      if (animatePins === 'b') { RAIL.b.classList.remove('drop'); void RAIL.b.offsetWidth; RAIL.b.classList.add('drop'); }
    } else RAIL.b.hidden = true;
    const sub = $('#rail-sub');
    if (st.q96 == null) sub.textContent = 'Your answers will pin here';
    else if (st.q77 == null) sub.textContent = '1 of 2 pinned';
    else if (a == null) sub.textContent = '2 answers · no national view';
    else sub.textContent = Math.abs(a - st.q77) === 0 ? 'No stretch' : 'Stretched ' + Math.abs(a - st.q77) + ' step' + (Math.abs(a - st.q77) > 1 ? 's' : '');
  }
  function drawElastic(animate) {
    cancelAnimationFrame(elasticRAF);
    const a = v96(), b = st.q77;
    if (a == null || b == null) { RAIL.path.setAttribute('d', ''); return; }
    const y = railY();
    const x1 = railX(a), x2 = railX(b);
    const y1 = (y.a / y.h) * 100, y2 = ((y.b - 31) / y.h) * 100;
    const dist = Math.abs(x1 - x2);
    const slack = Math.max(0, 6 - dist * 0.25);
    RAIL.path.style.strokeWidth = Math.max(1.5, 3.4 - dist / 32);
    RAIL.svg.classList.toggle('taut', dist > 0);
    const draw = (sag) => {
      const mx = (x1 + x2) / 2 + sag, my = (y1 + y2) / 2;
      RAIL.path.setAttribute('d', 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Q' + mx.toFixed(2) + ' ' + my.toFixed(2) + ' ' + x2.toFixed(2) + ' ' + y2.toFixed(2));
    };
    if (!animate || reduced()) { draw(slack); return; }
    const t0 = performance.now();
    const kick = 14 + dist * 0.12;
    const frame = (t) => {
      const dt = t - t0;
      const sag = slack + kick * Math.exp(-dt / 260) * Math.cos(dt / 48);
      draw(sag);
      if (dt < 1400) elasticRAF = requestAnimationFrame(frame); else draw(slack);
    };
    elasticRAF = requestAnimationFrame(frame);
  }
  function railNote() {
    const a = st.q96 != null ? D.q96.options[st.q96] : null;
    const b = st.q77 != null ? D.q77.options.find((o) => o.value === st.q77) : null;
    let t = '';
    if (a) t += 'Ireland: "' + a.label + '"' + (a.value != null ? ' (' + a.value + ' of 5)' : '') + '. ';
    if (b) t += 'Within 5 km: "' + b.label + '" (' + b.value + ' of 5). Both questions run on five-point scales, so the pins line up.';
    $('#rail-note').textContent = t.trim();
  }
  function resetRail() {
    RAIL.a.hidden = true; RAIL.b.hidden = true; RAIL.none.hidden = true;
    RAIL.path.setAttribute('d', '');
    $('#rail-note').textContent = '';
    $('#rail-sub').textContent = 'Your answers will pin here';
  }

  // Act 1 actions
  const A1 = {
    q96(btn) {
      if (st.step !== 'view' || st.lock) return;
      st.q96 = +btn.dataset.i;
      $$('.opt', NB).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layoutRail('a'); railNote();
      st.lock = true;
      wait(reduced() ? 150 : 650).then(() => { st.lock = false; stepNational(true); });
    },
    lock1() {
      st.guessLocked = true;
      meterGuess(st.guess1);
      stepZoomReady(true);
    },
    zoom() { playZoom(); },
    toLocal() { stepLocal(true); },
    q77(btn) {
      if (st.step !== 'local' || st.lock) return;
      st.q77 = +btn.dataset.v;
      $$('.opt', NB).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      layoutRail('b'); railNote();
      st.lock = true;
      wait(reduced() ? 150 : 520).then(() => {
        st.lock = false;
        RAIL.path.setAttribute('d', '');
        stepLocalDone(true); // moves the rail into the notice, right under the verdict
        layoutRail('b');
        // let the notice scroll (phones) and the pin land, then make sure the rail is on screen
        // and stretch the elastic
        return wait(reduced() ? 60 : narrow() ? 650 : 380).then(() => {
          if (st.step !== 'localdone') return null;
          const r = RAIL_EL.getBoundingClientRect();
          const off = r.bottom > window.innerHeight || r.top < 56;
          if (off) RAIL_EL.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
          return wait(off && !reduced() ? 350 : 0).then(() => { layoutRail(); drawElastic(true); });
        });
      });
    },
    toArea() { stepArea(true); },
    area(btn) {
      st.area = btn.dataset.k;
      stepArea(false);
      const t = $('.trio', NB);
      if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    },
    toHall() { enterHall(true); },
  };
  NB.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b && A1[b.dataset.act] && !b.disabled) A1[b.dataset.act](b);
  });

  function enterAct1(focus, scene, instant) {
    drawScenes();
    resetStage();
    resetRail();
    show('act1', false);
    if (instant) setScene(scene || 0, true);
    else requestAnimationFrame(() => setScene(0, false));
    stepView(focus);
  }

  /* ============================================================ ACT 2: THE TOWN HALL */
  const STANCE_SHORT = { 1: 'Completely unacceptable', 2: 'Somewhat unacceptable', 3: 'Neither', 4: 'Somewhat acceptable', 5: 'Completely acceptable' };
  const ROOM = $('#room');
  const spent = () => st.sel.reduce((s, id) => s + (D.byId[id] ? D.byId[id].cost : 0), 0);

  function setCounter(n) {
    $('#acc-n').textContent = n;
    $('.counter').classList.toggle('win', n >= MAJORITY);
  }
  function resetRoom() {
    ROOM.innerHTML = '';
    const frag = document.createDocumentFragment();
    D.room.forEach((g) => {
      for (let i = 0; i < g.count; i++) {
        const d = document.createElement('span');
        d.className = 'p s' + g.value;
        d.dataset.s = String(g.value);
        frag.appendChild(d);
      }
    });
    ROOM.appendChild(frag);
    setCounter(D.roomAccept);
    renderLegend();
  }
  function roomCounts() {
    const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, won: 0 };
    $$('.p', ROOM).forEach((d) => { c[d.dataset.s] += 1; });
    return c;
  }
  function renderLegend() {
    const c = roomCounts();
    const items = [5, 4, 3, 2, 1].map((v) => '<li><span class="p s' + v + '" aria-hidden="true"></span><span>' + STANCE_SHORT[v] + '</span><b>' + c[v] + '</b></li>');
    items.splice(2, 0, '<li><span class="p won" aria-hidden="true"></span><span>Won over by you</span><b>' + c.won + '</b></li>');
    $('#legend').innerHTML = items.join('');
    ROOM.setAttribute('aria-label', 'Town hall of 100 residents: ' + [1, 2, 3, 4, 5].map((v) => c[v] + ' ' + STANCE_SHORT[v].toLowerCase()).join(', ') + (c.won ? ', ' + c.won + ' won over by your package' : '') + '.');
  }

  function flagText(c) {
    const n = D.conds.length;
    const r = c.rRank === 1 ? 'Rated highest' : c.rRank === n ? 'Rated lowest' : 'Rated ' + ordinal(c.rRank);
    return r + ' one by one - but picked ' + ordinal(c.pRank) + ' of ' + n + ' in the top three';
  }
  function frontHTML(c) {
    return '<span class="c-icon" aria-hidden="true">' + ICONS[c.icon] + '</span>' +
      '<span class="c-title">' + esc(c.short) + '</span>' +
      '<span class="c-cost"><span class="pp" aria-hidden="true">' + '<i></i>'.repeat(c.cost) + '</span><span class="mono">' + c.cost + ' point' + (c.cost > 1 ? 's' : '') + '</span><span class="c-need">Over budget</span></span>' +
      '<span class="c-text">' + esc(c.label) + '</span>' +
      '<span class="c-meter"><span class="lab">Rated large or full</span><span class="bar"><i style="--w:' + c.rating + '%"></i></span><b>' + pc(c.rating) + '</b></span>' +
      (st.knows ? '<span class="c-meter pick"><span class="lab">Picked in top three</span><span class="bar"><i style="--w:' + c.pick + '%"></i></span><b>' + pc(c.pick) + '</b></span>' : '');
  }
  function backHTML(c) {
    return '<span class="c-title">' + esc(c.short) + '</span>' +
      '<span class="back-row pick"><span>Picked in top three</span><span class="bar"><i style="--w:' + c.pick + '%"></i></span><b>' + pc(c.pick) + '</b><em>#' + c.pRank + '</em></span>' +
      '<span class="back-row"><span>Rated large or full</span><span class="bar"><i style="--w:' + c.rating + '%"></i></span><b>' + pc(c.rating) + '</b><em>#' + c.rRank + '</em></span>' +
      '<span class="c-flag">' + flagText(c) + '</span>' +
      '<span class="inpkg">In your package</span>';
  }
  function renderCards() {
    $('#cards').innerHTML = D.conds.map((c) =>
      '<button type="button" class="card" data-id="' + c.id + '" aria-pressed="false">' +
      '<span class="card-in"><span class="face front">' + frontHTML(c) + '</span>' +
      '<span class="face back" aria-hidden="true">' + backHTML(c) + '</span></span>' +
      '<span class="c-check" aria-hidden="true">✓ In package</span></button>').join('');
    updateCards();
  }
  function updateCards() {
    const left = BUDGET - spent();
    $$('.card').forEach((el) => {
      const c = D.byId[el.dataset.id];
      const on = st.sel.includes(c.id);
      el.setAttribute('aria-pressed', String(on));
      el.classList.toggle('in-pkg', on);
      el.classList.toggle('cant', st.phase === 'build' && !on && c.cost > left);
      el.setAttribute('aria-disabled', String(st.phase !== 'build'));
    });
  }
  function refreshFronts() {
    $$('.card').forEach((el) => { $('.face.front', el).innerHTML = frontHTML(D.byId[el.dataset.id]); });
  }
  function flipAll(on, instant) {
    const cards = $$('.card');
    cards.forEach((el, i) => {
      const go = () => {
        el.classList.toggle('flipped', on);
        el.classList.toggle('hl', on && D.hl.includes(el.dataset.id));
        $('.face.front', el).setAttribute('aria-hidden', String(on));
        $('.face.back', el).setAttribute('aria-hidden', String(!on));
      };
      if (instant || reduced()) go(); else setTimeout(go, i * 75);
    });
  }
  function msg(t) { $('#msg').textContent = t; }
  function renderBudget() {
    const used = spent();
    $('#pips').innerHTML = Array.from({ length: BUDGET }, (_, i) => '<i class="' + (i < used ? 'used' : '') + '"></i>').join('');
    $('#budget-left').textContent = (BUDGET - used) + ' left';
  }
  function renderActions() {
    const bar = $('#actionbar'), box = $('#bar-actions');
    bar.classList.toggle('done', st.phase === 'result');
    $('.budget', bar).hidden = st.phase === 'result';
    if (st.phase === 'build') {
      box.innerHTML = '<button type="button" class="btn primary" data-act="callVote"' + (st.sel.length ? '' : ' disabled') + '>Call the vote ' + arrow + '</button>';
      if (!st.sel.length) msg(st.round === 1 ? 'Pick at least one promise to take to the room.' : 'Pick your revised package.');
    } else if (st.phase === 'voting') {
      box.innerHTML = '<button type="button" class="btn primary" disabled>Counting hands…</button>';
      msg('');
    } else if (st.round === 1) {
      box.innerHTML = '<button type="button" class="btn ghost" data-act="moveOn">Keep ' + st.results[0].accepting + ' and move on</button>' +
        '<button type="button" class="btn primary" data-act="revise">Revise your package ' + arrow + '</button>';
      msg('One more try? You now know what people actually pick.');
    } else {
      box.innerHTML = '<button type="button" class="btn primary" data-act="moveOn">On to Act 3 ' + arrow + '</button>';
      msg('Best result kept: ' + st.best + '/100.');
    }
  }
  function renderHow2() {
    const ex = D.conds[0];
    const rows = D.conds.map((c) => '<tr><td>' + esc(c.short) + '</td><td class="r">' + c.cost + '</td><td class="r">' + pc(c.rating) + '</td><td class="r">' + pc(c.pick) + '</td></tr>').join('');
    $('#how2-body').innerHTML =
      '<p class="model-note">This is a simplified model built from the survey\'s answers, not a prediction. It assumes people\'s priorities are independent of each other.</p>' +
      '<ol>' +
      '<li><b>The room.</b> The 100 residents copy the survey\'s answers to q77 (' + D.n77 + ' people: "' + esc(D.q77.text) + '"), scaled to 100 with largest-remainder rounding.</li>' +
      '<li><b>Pull.</b> Each condition\'s pull p is the share of people who put it in their top three in q88.' + (ex ? ' ' + esc(ex.short) + ': ' + pc(ex.pick) + ', so p = ' + (ex.pick / 100).toFixed(2) + '.' : '') + '</li>' +
      '<li><b>"Neither" residents</b> are won over if at least one of their top three is in your package: P = 1 − (1 − p₁)(1 − p₂)…</li>' +
      '<li><b>"Somewhat unacceptable" residents</b> need at least two of their top three in your package.</li>' +
      '<li><b>"Completely unacceptable" residents don\'t move</b> - they told the survey it was completely unacceptable.</li>' +
      '<li>Residents who already accept stay. Won over = P × group size, rounded.</li>' +
      '</ol>' +
      '<p><b>Game design assumptions, not survey data:</b> the costs in planning points and the budget of ' + BUDGET + '. The rating bar on each card comes from q78–q87: the share who said that condition would raise their acceptance a "Large" amount or make them "Fully accepting".</p>' +
      '<table><thead><tr><th>Condition</th><th class="r">Cost</th><th class="r">Rated large/full</th><th class="r">Top-three pick</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="muted">Top-three picks come from a question where people chose three, so they add up to more than 100%.</p>';
  }

  function model(sel) {
    const ps = sel.map((id) => D.byId[id]).filter(Boolean).map((c) => c.pick / 100);
    let none = 1;
    ps.forEach((p) => { none *= 1 - p; });
    let one = 0;
    ps.forEach((p, i) => {
      let t = p;
      ps.forEach((q, j) => { if (j !== i) t *= 1 - q; });
      one += t;
    });
    const P1 = 1 - none, P2 = Math.max(0, 1 - none - one);
    const g = D.roomBy;
    const convNeither = Math.round(P1 * g[3]);
    const convSomewhat = Math.round(P2 * g[2]);
    return { P1: P1, P2: P2, convNeither: convNeither, convSomewhat: convSomewhat, accepting: g[4] + g[5] + convNeither + convSomewhat };
  }

  // What the model gives if you spend the budget greedily on the best-rated cards, or on the
  // most-picked cards (cards taken in order, skipping any that no longer fit).
  function greedy(key) {
    const sel = [];
    let left = BUDGET;
    D.conds.slice().sort((a, b) => b[key] - a[key]).forEach((c) => {
      if (c.cost <= left) { sel.push(c.id); left -= c.cost; }
    });
    return { sel: sel, accepting: model(sel).accepting, names: sel.map((id) => lc(D.byId[id].short)) };
  }
  let followCache = null;
  function follow() {
    if (!followCache && D.conds.length) followCache = { rating: greedy('rating'), pick: greedy('pick') };
    return followCache;
  }
  const listTxt = (a) => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  function followHTML() {
    const f = follow();
    if (!f) return '';
    const row = (lab, r) => '<div class="frow' + (r.accepting >= MAJORITY ? ' win' : '') + '"><span class="fl">' + lab + '<small>' + esc(listTxt(r.names)) + '</small></span>' +
      '<span class="fb" aria-hidden="true"><i data-w="' + r.accepting + '"></i><em style="left:' + MAJORITY + '%"></em></span>' +
      '<span class="fv">' + r.accepting + '<small>/100</small></span>' +
      '<span class="fw">' + (r.accepting >= MAJORITY ? 'Majority' : 'No majority') + '</span></div>';
    return '<div class="follow"><p class="kicker">Same ' + BUDGET + ' points, two strategies</p>' +
      row('Follow the ratings', f.rating) + row('Follow the top-three picks', f.pick) +
      '<p class="meta"><span class="muted">Town hall model: cards taken from the top of each list until the ' + BUDGET + ' points run out. Tick = majority (' + MAJORITY + ').</span></p></div>';
  }

  function showResult(res) {
    const g = st.guesses[st.round - 1];
    const box = $('#result');
    box.hidden = false;
    $('#pkg-head').hidden = true;
    const verdict = res.accepting >= MAJORITY ? 'Majority won.' : 'Short of a majority by ' + (MAJORITY - res.accepting) + '.';
    const gdiff = g == null ? '' : Math.abs(g - res.accepting) <= 3 ? ' Your prediction was close.' : g > res.accepting ? ' You expected more.' : ' Better than you expected.';
    box.innerHTML =
      '<p class="kicker">Round ' + st.round + ' · the room votes</p>' +
      '<div class="result-big"><b>' + res.accepting + '</b><span>/100<br>would accept</span></div>' +
      '<div class="result-side">' +
      '<p class="verdict-line">' + verdict + gdiff + '</p>' +
      (g != null ? '<p class="meta"><span class="tag assume">Assumption</span>You predicted ' + g + '<span class="muted">· model from survey answers: ' + res.accepting + '</span></p>' : '') +
      '<ul class="breakdown">' +
      '<li><b>' + D.roomAccept + '</b> already accepted</li>' +
      '<li><b>+' + res.convNeither + '</b> of ' + D.roomBy[3] + ' "neither"</li>' +
      '<li><b>+' + res.convSomewhat + '</b> of ' + D.roomBy[2] + ' "somewhat unacceptable"</li>' +
      '<li><b>' + D.roomBy[1] + '</b> "completely unacceptable" - no move</li>' +
      '</ul></div>';
  }
  function showRevealCopy() {
    const rc = $('#reveal-copy');
    const r = D.conds.map((c) => c.rating), p = D.conds.map((c) => c.pick), nr = D.conds.map((c) => c.nRating);
    const hl = D.hl.map((id) => D.byId[id]);
    const facts = hl.filter((c) => c.fact && fact(c.fact)).map((c) => factHTML(c.fact)).join('');
    const rankTxt = (c) => '<b>' + esc(lc(c.short)) + '</b> (rated ' + ordinal(c.rRank) + ', picked ' + ordinal(c.pRank) + ')';
    const mis = hl.length ? ' The biggest mismatches (highlighted): ' + listTxt(hl.map(rankTxt)) + '.' : '';
    rc.hidden = false;
    rc.innerHTML =
      '<p class="rc-big">Rated one by one, most conditions look alike. Forced to choose three, people show their real priorities.</p>' +
      '<p>Every condition was rated "large" or "fully accepting" by between ' + pc(Math.min.apply(null, r)) + ' and ' + pc(Math.max.apply(null, r)) +
      ' of people. Asked to pick only three, the shares ranged from ' + pc(Math.min.apply(null, p)) + ' to ' + pc(Math.max.apply(null, p)) + '.' +
      mis + '</p>' +
      followHTML() +
      '<p class="meta"><span class="tag opinion">Opinion</span><span class="muted">Ratings: q78–q87, ' + Math.min.apply(null, nr) + '–' + Math.max.apply(null, nr) + ' answered each. Top three: q88, ' + D.n88 + ' answered - people chose three, so these add up to more than 100%.</span></p>' +
      (facts ? '<hr class="rule"><p class="kicker">Reality check</p>' + facts : '');
    growBars(rc);
  }

  async function runVote(instant) {
    st.phase = 'voting';
    const res = model(st.sel);
    const g = st.guesses[st.round - 1];
    st.results[st.round - 1] = Object.assign({}, res, { sel: st.sel.slice(), guess: g });
    if (st.best == null || res.accepting > st.best) { st.best = res.accepting; st.bestSel = st.sel.slice(); }
    resetRoom();
    updateCards();
    renderActions();
    if (!instant && narrow()) $('.room-panel').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    const dots = $$('.p', ROOM);
    const pool3 = shuffle(dots.filter((d) => d.dataset.s === '3')).slice(0, res.convNeither);
    const pool2 = shuffle(dots.filter((d) => d.dataset.s === '2')).slice(0, res.convSomewhat);
    const order = shuffle(pool3.concat(pool2));
    if (!instant) {
      ROOM.classList.add('voting');
      await wait(reduced() ? 120 : 900);
      ROOM.classList.remove('voting');
    }
    let n = D.roomAccept;
    for (const d of order) {
      d.className = 'p won' + (instant || reduced() ? '' : ' pop');
      d.dataset.s = 'won';
      n += 1;
      setCounter(n);
      if (!instant) await wait(reduced() ? 10 : 55);
    }
    renderLegend();
    st.phase = 'result';
    showResult(res);
    updateCards();
    if (st.round === 1) {
      if (!instant) await wait(reduced() ? 100 : 450);
      flipAll(true, instant);
      showRevealCopy();
    }
    renderActions();
    if (!instant) {
      const r = $('#result');
      r.setAttribute('tabindex', '-1');
      r.focus({ preventScroll: true });
      r.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function revise(instant) {
    st.round = 2;
    st.phase = 'build';
    st.knows = true;
    refreshFronts();
    flipAll(false, instant);
    resetRoom();
    $('#result').hidden = true;
    $('#pkg-head').hidden = false;
    $('#pkg-sub').textContent = 'Round 2. Each card now shows how often people picked it in their top three. Revise your package - your best score is kept.';
    updateCards();
    renderBudget();
    renderActions();
    msg('Round 2: change as much as you like.');
    if (!instant) {
      const h = $('#pkg-head');
      h.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      const t = $('h3', h);
      t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    }
  }

  function enterHall(focus) {
    st.round = 1; st.phase = 'build'; st.sel = []; st.guesses = []; st.results = []; st.best = null; st.bestSel = null; st.knows = false;
    show('hall', focus);
    $('#room-n').textContent = D.n77;
    resetRoom();
    renderCards();
    renderBudget();
    renderActions();
    renderHow2();
    $('#result').hidden = true;
    $('#reveal-copy').hidden = true;
    $('#pkg-head').hidden = false;
    $('#pkg-sub').textContent = 'Tap a card to add it. The bar on each card shows how strongly survey respondents said that condition would raise their acceptance.';
    msg('Pick at least one promise to take to the room.');
  }

  const dlg = $('#dlg');
  function openPredict() {
    const inp = $('#guess2');
    const prev = st.guesses[st.round - 1] != null ? st.guesses[st.round - 1] : st.guesses[0] != null ? st.guesses[0] : 50;
    inp.value = prev;
    inp.dispatchEvent(new Event('input'));
    $('#dlg-hint').textContent = 'Your prediction. ' + D.roomAccept + ' of the 100 already accept before any promises.';
    dlg.returnValue = '';
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
      inp.focus();
    } else {
      st.guesses[st.round - 1] = +inp.value;
      runVote(false);
    }
  }
  $('#guess2').addEventListener('input', (e) => {
    const v = +e.target.value;
    e.target.style.setProperty('--p', v + '%');
    $('#guess2-out').textContent = v;
  });
  // The vote runs directly from here, not from the dialog's "close" event: Chrome stops firing
  // "close" on this dialog after it has once been dismissed with Esc, which silently skipped votes.
  function closePredict(v) {
    if (!dlg.open) return;
    dlg.close(v);
    if (v === 'vote') {
      st.guesses[st.round - 1] = +$('#guess2').value;
      runVote(false);
    }
  }
  // Any submission of the form (the "Call the vote" button, or implicit submission with Enter -
  // it is the only submit button) calls the vote. Enter on the slider is handled explicitly too.
  // Esc and "Back to the package" just close the dialog.
  $('form', dlg).addEventListener('submit', (e) => { e.preventDefault(); closePredict('vote'); });
  $('#guess2').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); closePredict('vote'); }
  });
  $('#dlg-cancel').addEventListener('click', () => closePredict('cancel'));

  $('#cards').addEventListener('click', (e) => {
    const el = e.target.closest('.card');
    if (!el || st.phase !== 'build') return;
    const c = D.byId[el.dataset.id];
    const i = st.sel.indexOf(c.id);
    if (i >= 0) {
      st.sel.splice(i, 1);
      msg(c.short + ' removed.');
    } else if (spent() + c.cost > BUDGET) {
      el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope');
      msg('Not enough planning points: ' + lc(c.short) + ' costs ' + c.cost + '. Drop a card first.');
      return;
    } else {
      st.sel.push(c.id);
      const left = BUDGET - spent();
      msg(c.short + ' added. ' + (left ? left + ' point' + (left > 1 ? 's' : '') + ' left.' : 'Budget spent - call the vote when ready.'));
    }
    updateCards();
    renderBudget();
    renderActions();
    const used = spent();
    const pip = $$('#pips i')[Math.max(0, used - 1)];
    if (pip && i < 0 && !reduced()) pip.classList.add('bump');
  });
  $('#bar-actions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'callVote') openPredict();
    else if (act === 'revise') revise(false);
    else if (act === 'moveOn') enterTwist(true);
  });

  /* ============================================================ ACT 3: LIVING NEXT DOOR */
  const NEAR_OPTS = [
    { k: 'more', t: 'More open' },
    { k: 'same', t: 'About the same' },
    { k: 'less', t: 'Less open' },
  ];
  const NEAR_WORD = { more: 'more open', same: 'about the same', less: 'less open' };
  // The survey's answer to the Act 3 question, computed from the q7 x q77 cross-tab (null if missing).
  function nearTruth() {
    const yes = D.near.find((a) => a.match === 'Yes'), no = D.near.find((a) => a.match === 'No');
    if (!yes || !no || yes.r.pct == null || no.r.pct == null) return null;
    const d = yes.r.pct - no.r.pct;
    return { yes: yes, no: no, d: d, k: Math.abs(d) < 3 ? 'same' : d < 0 ? 'less' : 'more' };
  }
  function nearPanelHTML() {
    const T = nearTruth();
    if (T && !st.nearGuess) {
      return '<article class="panel near-panel" id="near-panel"><div class="panel-top"><h3>Your guess first</h3><span class="tag assume">Assumption</span></div>' +
        '<p class="near-q" id="near-q">People who say a data centre is <b>already within 10 km</b> of home, compared with people who say there isn\'t one: how open are they to one within 5 km?</p>' +
        '<div class="opts" role="group" aria-labelledby="near-q">' +
        NEAR_OPTS.map((o) => '<button type="button" class="opt" data-near="' + o.k + '" aria-pressed="false">' + o.t + '</button>').join('') + '</div>' +
        '<p class="meta"><span class="muted">Your guess locks when you tap. Then the survey answers (q7 × q77).</span></p></article>';
    }
    const rows = D.near.map((a) => {
      const r = a.r, ok = r.pct != null, small = r.n != null && r.n < SMALL_N;
      return '<div class="brow' + (small ? ' small' : '') + '"><span class="bl">' + esc(a.name) + '<small>n = ' + (r.n || '–') + (small ? ' · <span class="small-n">small group (n = ' + r.n + ')</span>' : '') + '</small></span>' +
        '<span class="bv' + (ok ? '' : ' na') + '">' + (ok ? pc(r.pct) : 'too few people') + '</span>' +
        '<span class="bb" aria-hidden="true"><i data-w="' + (ok ? r.pct : 0) + '"></i></span></div>';
    }).join('');
    let you = '';
    if (T && st.nearGuess) {
      const ok = st.nearGuess === T.k;
      you = '<p class="near-you"><span class="tag assume">Assumption</span><span>You said <b>' + NEAR_WORD[st.nearGuess] + '</b>. ' +
        (ok ? '<b class="ok">✓ The survey agrees.</b>' : '<b class="no">✗ The survey says ' + NEAR_WORD[T.k] + '.</b>') + '</span></p>';
    }
    return '<article class="panel near-panel" id="near-panel"><div class="panel-top"><h3>What the survey shows</h3><span class="tag opinion">Opinion</span></div>' +
      you +
      '<p>Share who would accept a sustainable data centre within 5 km of home, split by their answer to "' + esc(has('q7') ? S.q('q7').text : '') + '"</p>' +
      '<div class="bars">' + rows + '</div>' +
      '<p class="caveat">This shows a pattern, not a cause - people near data centres may have more reasons to be wary, or live in busier places. And "within 10 km" is what people believe, not a measured distance.</p>' +
      '<p class="meta"><span class="muted">Survey q7 × q77 cross-tab · groups under ' + SMALL_N + ' people are flagged</span></p></article>';
  }
  function twistFootHTML() {
    const T = nearTruth(), q74 = D.q74;
    if (T && !st.nearGuess) return '<p class="muted">Make your guess to see what the survey found.</p>';
    let take = '';
    if (T) {
      const y = pc(T.yes.r.pct), n = pc(T.no.r.pct);
      take = T.k === 'same' ? 'Living near a data centre made little difference in this survey: ' + y + ' vs ' + n + '.' :
        T.k === 'less' ? 'People who say one is already nearby were less open to another, not more: ' + y + ' vs ' + n + ' - even though ' + (q74 ? pc(q74.agree) : 'many') + ' think a visit would help.' :
          'People who say one is already nearby were more open to another: ' + y + ' vs ' + n + '.';
    }
    return '<p>' + take + '</p><button type="button" class="btn primary big" data-go="report">See your report card ' + arrow + '</button>';
  }
  function enterTwist(focus) {
    const body = $('#twist-body');
    const q74 = D.q74;
    const left = q74 ?
      '<article class="panel"><div class="panel-top"><h3>What people expect</h3><span class="tag opinion">Opinion</span></div>' +
      '<p class="huge">' + pc(q74.agree) + '</p>' +
      '<p class="say">agreed that visiting a data centre would make them more comfortable.</p>' +
      stackHTML(q74.q, null, ['Strongly disagree', 'Strongly agree']) +
      '<p class="meta"><span class="muted">Survey q74: "' + esc(S.label('q74')) + '" · ' + q74.n + ' answered</span></p></article>' : '';
    const right = D.near.length ? '<div class="near-slot" id="near-slot">' + nearPanelHTML() + '</div>' : '';
    body.innerHTML = left + right + '<div class="twist-foot" id="twist-foot">' + twistFootHTML() + '</div>';
    show('twist', focus);
    growBars(body);
  }
  $('#twist-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-near]');
    if (!b || st.nearGuess || st.lock) return;
    $$('[data-near]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    st.lock = true;
    wait(reduced() ? 120 : 380).then(() => {
      st.lock = false;
      st.nearGuess = b.dataset.near;
      const slot = $('#near-slot');
      slot.innerHTML = nearPanelHTML();
      $('#twist-foot').innerHTML = twistFootHTML();
      growBars(slot);
      const h = $('#near-panel h3');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      if (narrow()) $('#near-panel').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* ============================================================ REPORT CARD */
  const STORE = 'dc5km.q77.v1';
  function readTally() {
    try {
      const raw = window.localStorage.getItem(STORE);
      const a = raw ? JSON.parse(raw) : null;
      return Array.isArray(a) && a.length === 5 ? a.map((x) => Math.max(0, +x || 0)) : [0, 0, 0, 0, 0];
    } catch (e) { return null; }
  }
  function writeTally(t) {
    try { window.localStorage.setItem(STORE, JSON.stringify(t)); return true; } catch (e) { return false; }
  }
  // Players on this device. Under SMALL_N answers we show one square per player with counts,
  // never percentages (1 player would otherwise draw a loud "100%" bar next to the survey).
  function tallyHTML(t) {
    const n = t.reduce((a, b) => a + b, 0);
    if (!n) return '<p class="tally-empty">No answers saved on this device yet.</p>';
    const opts = D.q77.options;
    if (n < SMALL_N) {
      let dots = '';
      opts.forEach((o, i) => { for (let k = 0; k < (t[i] || 0); k++) dots += '<i style="background:' + segColor(o.value) + '"></i>'; });
      const parts = opts.map((o, i) => (t[i] ? { o: o, c: t[i] } : null)).filter(Boolean);
      const words = parts.map((p) => (p.o.short || p.o.label) + ': ' + p.c).join(', ');
      return '<div class="tally-dots" role="img" aria-label="' + esc(n + (n > 1 ? ' players' : ' player') + ' on this device. ' + words) + '">' + dots + '</div>' +
        '<div class="seg-legend" aria-hidden="true">' + parts.map((p) => '<span><i style="background:' + segColor(p.o.value) + '"></i>' + esc(p.o.short || p.o.label) + ': ' + p.c + (p.c > 1 ? ' players' : ' player') + '</span>').join('') + '</div>';
    }
    const q = { options: opts.map((o, i) => ({ label: o.label, short: o.short, value: o.value, pct: (100 * (t[i] || 0)) / n })) };
    return stackHTML(q, null);
  }

  function dumbbell(label, unit, guess, real, realName) {
    const lo = Math.min(guess, real), hi = Math.max(guess, real);
    return '<div class="db"><div class="db-lab"><span>' + label + '</span><span class="mono">you ' + guess + unit + ' · ' + realName + ' ' + real + unit + '</span></div>' +
      '<div class="db-track" role="img" aria-label="' + esc(label + ': you guessed ' + guess + unit + ', ' + realName + ' ' + real + unit) + '">' +
      '<i class="db-line" style="left:' + lo + '%;width:' + (hi - lo) + '%"></i><i class="db-dot g" style="left:' + guess + '%"></i><i class="db-dot r" style="left:' + real + '%"></i></div></div>';
  }

  function renderReport(focus) {
    const best = st.best;
    const bestNames = (st.bestSel || []).map((id) => D.byId[id] && D.byId[id].short).filter(Boolean);
    const stamp = best == null ? '' : '<span class="rstamp' + (focus ? ' slam' : '') + '">' + (best >= MAJORITY ? 'Majority won' : 'No majority') + '</span>';

    // ASSUMPTION row
    let dbs = dumbbell('Would accept one within 5 km', '%', st.guess1, Math.round(D.accept), 'survey');
    st.results.forEach((r, i) => {
      if (r && r.guess != null) dbs += dumbbell('Town hall, round ' + (i + 1), '', r.guess, r.accepting, 'model');
    });
    const T = nearTruth();
    if (T && st.nearGuess) {
      const ok = st.nearGuess === T.k;
      dbs += '<div class="db near-row"><div class="db-lab"><span>Living near one: more or less open?</span><span class="mono">you ' + NEAR_WORD[st.nearGuess] + ' · survey ' + NEAR_WORD[T.k] + '</span></div>' +
        '<p class="near-detail"><b>' + (ok ? '✓ Matched.' : '✗ Not what the survey found.') + '</b> ' + pc(T.yes.r.pct) + ' of people who said one is within 10 km would accept one within 5 km, vs ' + pc(T.no.r.pct) + ' of people who said no.</p></div>';
    }
    // one-line personal takeaway for the top of the sheet
    let headline = 'You guessed ' + st.guess1 + '% would still say yes at 5 km; the survey says ' + pc(D.accept) + '.';
    const va = v96(), vb = st.q77, gp = D.gap;
    if (va != null && vb != null && gp) {
      const k = va - vb;
      headline += k > 0 ? ' Closer to home, your own answer dropped ' + k + ' step' + (k > 1 ? 's' : '') + ' on the five-point scale, like ' + rangeTxt(gp.less) + ' of the people surveyed.' :
        k === 0 ? ' Closer to home, your own answer held steady - only ' + rangeTxt(gp.same) + ' of the people surveyed did that.' :
          ' Closer to home, your own answer got warmer - only ' + rangeTxt(gp.more) + ' of the people surveyed did that.';
    }
    const fl = follow();
    const followLine = fl ? '<p class="best-follow">In the same model, spending the ' + BUDGET + ' points on the best-rated cards gets <b>' + fl.rating.accepting + '</b>; on the most-picked cards, <b>' + fl.pick.accepting + '</b>.</p>' : '';
    // OPINION row
    const o96 = st.q96 != null ? D.q96.options[st.q96] : null;
    const o77 = st.q77 != null ? D.q77.options.find((o) => o.value === st.q77) : null;
    const i77 = st.q77 != null ? D.q77.options.findIndex((o) => o.value === st.q77) : null;
    const op =
      '<div class="op-block"><p class="op-q">' + esc(D.q96.text) + ' <span class="mono muted">q96</span></p>' +
      (o96 ? '<p class="op-a">You: "' + esc(o96.label) + '" · ' + pc(o96.pct) + ' of the survey said the same</p>' : '') +
      stackHTML(D.q96, st.q96, null) + '</div>' +
      '<div class="op-block"><p class="op-q">' + esc(D.q77.text) + ' <span class="mono muted">q77</span></p>' +
      (o77 ? '<p class="op-a">You: "' + esc(o77.label) + '" · ' + pc(o77.pct) + ' of the survey said the same</p>' : '') +
      stackHTML(D.q77, i77, null) + '</div>';
    // DATA row
    const facts = factHTML('ie-share-2025') + factHTML('ie-cru-2025');

    const sheet =
      '<article class="notice sheet"><span class="nail l" aria-hidden="true"></span><span class="nail r" aria-hidden="true"></span>' +
      '<div class="nhead"><p class="ntitle">Report card</p><p class="gridref">Ref. 5KM/' + new Date().getFullYear() + '/' + (st.guess1 * 7 + 101) + ' · Grid ref. N 604 286</p></div>' +
      '<p class="r-headline">' + headline + '</p>' +
      (best != null ?
        '<div class="best"><span class="best-num">' + best + '<span>/100</span></span><p>Your best town hall result' + (bestNames.length ? ': ' + esc(lc(bestNames.join(' + '))) : '') + '.</p>' + stamp + '</div>' + followLine : '') +
      '<section class="rrow"><div class="rrow-h"><span class="tag assume">Assumption</span><h3>Your guesses</h3></div><div>' + dbs +
      '<div class="db-keys"><span class="g">Your guess</span><span class="r">Survey or model result</span></div></div></section>' +
      '<section class="rrow"><div class="rrow-h"><span class="tag opinion">Opinion</span><h3>Your views vs the survey</h3></div><div>' + op + '</div></section>' +
      '<section class="rrow"><div class="rrow-h"><span class="tag data">Data</span><h3>Measured facts</h3></div><div class="facts-list">' + facts + '</div></section>' +
      '</article>';

    // device tally (this browser only)
    let t = readTally();
    let storageOk = t !== null;
    if (!t) t = [0, 0, 0, 0, 0];
    const idx = st.q77 != null ? D.q77.options.findIndex((o) => o.value === st.q77) : -1;
    if (idx >= 0 && !st.saved) {
      if (st.debug) { t = t.slice(); t[idx] += 1; } // debug screens never write to storage
      else if (storageOk) { t[idx] += 1; storageOk = writeTally(t); st.saved = storageOk; }
      else { t[idx] += 1; }
    }
    const dn = t.reduce((a, b) => a + b, 0);
    const device =
      '<section class="panel device" aria-labelledby="dev-h"><h3 id="dev-h">Add your answer (this device)</h3>' +
      '<p>Your 5 km answer is ' + (st.debug ? 'shown' : storageOk ? 'saved' : 'shown') + ' next to the survey. <b>Answers from this device only</b> - not a live poll, and not part of the survey.</p>' +
      '<div class="stack-cap"><span>Survey (q77)</span><span>n = ' + D.n77 + '</span></div>' + stackHTML(D.q77, null) +
      '<div class="stack-cap"><span>Players on this device</span><span>n = ' + dn + '</span></div>' + tallyHTML(t) +
      (dn && dn < SMALL_N ? '<p class="meta"><span class="small-n">small group (n = ' + dn + ')</span><span class="muted">too few answers to compare fairly, so counts, not percentages</span></p>' : '') +
      (!storageOk && !st.debug ? '<p class="meta muted">This browser blocks saving, so only your answer is shown.</p>' : '') +
      (storageOk && dn ? '<button type="button" class="linkish" data-act="clearTally">Clear this device\'s answers</button>' : '') +
      '</section>';

    const srcFacts = Array.from(new Set(['ie-share-2025', 'ie-cru-2025'].concat(Array.from(usedFacts)))).map(fact).filter(Boolean);
    const sources =
      '<section class="panel sources" aria-labelledby="src-h"><h3 id="src-h">Sources</h3><ul>' +
      '<li>' + esc(S.meta.title) + ' - ' + esc(S.meta.source) + '. ' + S.n + ' respondents; questions used: q4, q7, q74, q77, q78–q88, q96. <span class="mono">Aggregate counts only.</span></li>' +
      srcFacts.map((f) => '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.source) + ' (' + f.year + ')</a> <span class="mono">- ' + esc(f.topic) + '</span></li>').join('') +
      '<li class="muted">Planning-point costs, the budget and the town hall model are game design, explained in Act 2.</li>' +
      '</ul></section>';

    const actions = '<div class="end-actions"><button type="button" class="btn primary big" data-act="again">Play again <span aria-hidden="true">↺</span></button><a class="btn ghost big" href="index.html">Back to all games</a></div>';

    $('#report-body').innerHTML = sheet + '<div class="side-stack">' + device + actions + sources + '</div>';
    show('report', focus);
  }

  $('#report-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'again') playAgain();
    if (b.dataset.act === 'clearTally') {
      try { window.localStorage.removeItem(STORE); } catch (err) { /* storage blocked */ }
      st.saved = true; // do not re-add this run
      renderReport(false);
      const h = $('#dev-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
    }
  });

  function playAgain() {
    const keep = st.debug;
    st = fresh();
    st.debug = keep;
    rand = keep ? rng(7) : Math.random;
    resetStage();
    resetRail();
    renderStart();
    show('start', true);
  }

  /* ============================================================ START + NAV */
  function renderStart() {
    $('#teaser-ie').textContent = pc(D.support);
    $('#teaser-n').textContent = 'support · ' + D.n96 + ' answered q96';
    $('#start-who').textContent = 'Built on a survey of ' + S.n + ' people in Ireland (Maynooth University survey).';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    const go = b.dataset.go;
    if (go === 'act1') enterAct1(true);
    else if (go === 'report') renderReport(true);
  });

  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (st.screen === 'act1') { layoutRail(); drawElastic(false); } }, 120);
  });

  /* ============================================================ DEBUG SCREENS (#screen=name) */
  function sampleAct1(level) {
    st.q96 = Math.max(0, D.q96.options.findIndex((o) => o.value === 4));
    if (level >= 2) { st.guess1 = 45; st.guessLocked = true; }
    if (level >= 3) st.q77 = 3;
    if (level >= 4) st.area = 'suburban';
  }
  function sampleHall(rounds) {
    const r1 = ['q86', 'q81', 'q87'].filter((id) => D.byId[id]);
    const r2 = ['q79', 'q81', 'q82'].filter((id) => D.byId[id]);
    st.round = 1; st.sel = r1; st.guesses = [55];
    const a = model(r1);
    st.results = [Object.assign({}, a, { sel: r1, guess: 55 })];
    st.best = a.accepting; st.bestSel = r1;
    if (rounds >= 2) {
      const b = model(r2);
      st.round = 2; st.guesses.push(60);
      st.results.push(Object.assign({}, b, { sel: r2, guess: 60 }));
      if (b.accepting > st.best) { st.best = b.accepting; st.bestSel = r2; }
    }
    return { r1: r1, r2: r2 };
  }
  function debugJump(name) {
    st.debug = true;
    rand = rng(7);
    drawScenes();
    switch (name) {
      case 'view':
        enterAct1(false, 0, true);
        break;
      case 'national':
        sampleAct1(1);
        enterAct1(false, 0, true);
        st.guess1 = 45;
        layoutRail(); railNote();
        stepNational(false, true);
        break;
      case 'zoom':
        sampleAct1(2);
        enterAct1(false, 3, true);
        meterShow(true); M.el.classList.add('drop'); meterSet(D.accept);
        meterText('Survey q77', 'would accept one within 5 km of home', 'would accept one within 5 km');
        meterGuess(st.guess1); stampOn(false); st.zoomDone = true;
        layoutRail(); railNote();
        stepLanded(false);
        break;
      case 'midzoom': // a frozen mid-zoom frame, to check the in-between meter styling
        sampleAct1(2);
        enterAct1(false, 2, true);
        meterShow(true); M.el.classList.add('drop', 'zooming'); meterGuess(st.guess1);
        meterSet(D.support - (D.support - D.accept) * 0.55);
        meterText('Zooming in', 'moving between the two survey numbers (not a result)', 'moving (not a result)');
        layoutRail(); railNote();
        stepZoomReady(false);
        $$('.zoom-steps li').forEach((li, k) => li.classList.toggle('on', k <= 2));
        { const zb = $('#zoom-btn'); if (zb) { zb.disabled = true; zb.textContent = 'Zooming in…'; } }
        break;
      case 'local':
      case 'area':
        sampleAct1(name === 'area' ? 4 : 3);
        enterAct1(false, 3, true);
        meterShow(true); M.el.classList.add('drop'); meterSet(D.accept);
        meterText('Survey q77', 'would accept one within 5 km of home', 'would accept one within 5 km');
        meterGuess(st.guess1); stampOn(false); st.zoomDone = true;
        if (name === 'local') stepLocalDone(false); else stepArea(false);
        requestAnimationFrame(() => { layoutRail(); drawElastic(false); railNote(); });
        break;
      case 'hall':
      case 'predict':
        sampleAct1(4);
        enterHall(false);
        st.sel = ['q86', 'q81', 'q87'].filter((id) => D.byId[id]);
        updateCards(); renderBudget(); renderActions(); msg('Budget spent - call the vote when ready.');
        if (name === 'predict') { st.guesses = [55]; openPredict(); }
        break;
      case 'reveal':
      case 'revise': {
        sampleAct1(4);
        enterHall(false);
        const s = sampleHall(1);
        st.sel = s.r1.slice(); st.results = []; st.best = null;
        runVote(true).then(() => {
          if (name === 'revise') {
            revise(true);
            st.sel = s.r2.slice();
            updateCards(); renderBudget(); renderActions();
            msg('Round 2: change as much as you like.');
          }
        });
        break;
      }
      case 'nearby':
        sampleAct1(4); sampleHall(2);
        enterTwist(false);
        break;
      case 'twist':
        sampleAct1(4); sampleHall(2); st.nearGuess = 'more';
        enterTwist(false);
        break;
      case 'report':
      case 'end':
        sampleAct1(4); sampleHall(2); st.nearGuess = 'more';
        usedFacts.add('ie-share-2025');
        renderReport(false);
        break;
      default:
        show('start', false);
    }
  }

  /* ============================================================ BOOT */
  try {
    if (SC && SC.contours) document.body.style.setProperty('--contours', SC.contours());
  } catch (e) { /* texture is decoration only */ }

  if (!D.ok) {
    $('#s-start .start-copy').insertAdjacentHTML('beforeend', '<p class="caveat">The survey questions this game needs (q77 and q96) are missing from the data file, so the game cannot start.</p>');
    $$('[data-go="act1"]').forEach((b) => { b.disabled = true; });
    renderStart = function () {};
  } else {
    renderStart();
  }
  if (D.ok && !D.hallOk) {
    // No condition data: the town hall cannot run, so Act 1 hands straight to Act 3.
    A1.toHall = () => enterTwist(true);
  }

  const m = /#screen=([\w-]+)/.exec(window.location.hash || '');
  if (m && D.ok) debugJump(m[1]);
  else show('start', false);
})();

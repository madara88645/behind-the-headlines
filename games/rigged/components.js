/*
 * components.js - small render helpers for Rigged (wheel, number line, survey bars, posts).
 * Pure functions that return HTML strings. All survey numbers come from window.Survey at runtime.
 */
(function () {
  'use strict';

  const U = {};
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.esc = esc;

  U.el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  U.reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  U.randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  /* ---------- survey access (never crash on a missing id) ---------- */
  U.hasQ = (id) => {
    try { return !!(window.Survey && window.Survey.q(id)); } catch (e) { return false; }
  };
  U.fmt = (p) => (p == null || isNaN(p) ? '–' : Math.round(p) + '%');
  U.who = () => `${window.Survey.n} people in Ireland (Maynooth University survey)`;
  /**
   * % of people who answered `id` choosing options that match `m`, computed from headcounts via
   * Survey.count (the per-option pct is pre-rounded, so 36/195 = 18.46% would otherwise show as 19%).
   */
  U.share = (id, m) => {
    const S = window.Survey;
    const n = S.q(id).n_answered;
    return n ? (100 * S.count(id, m)) / n : null;
  };
  U.ag = (id) => U.share(id, window.Survey.predicates.isAgree);
  U.dis = (id) => U.share(id, window.Survey.predicates.isDisagree);
  U.neu = (id) => U.share(id, window.Survey.predicates.isNeutral);

  /* ---------- labels ---------- */
  const CHIP = { data: 'Data', opinion: 'Opinion', assume: 'Assumption' };
  U.chip = (k) => `<span class="chip chip-${k}">${CHIP[k]}</span>`;
  U.src = (label, url) =>
    url
      ? `<a class="src" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="src-k">Source</span><span>${esc(label)}</span><span aria-hidden="true">↗</span></a>`
      : `<span class="src"><span class="src-k">Source</span><span>${esc(label)}</span></span>`;

  U.check = () =>
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /** A checkbox-style option button (aria-pressed). */
  U.opt = (value, label, extra = '') =>
    `<button type="button" class="opt" data-v="${esc(value)}" aria-pressed="false"><span class="box">${U.check()}</span><span>${esc(label)}</span>${extra}</button>`;

  /* ---------- slider with no default thumb ---------- */
  U.slider = ({ id, min, max, step, ticks, fmt, label }) => `
    <div class="slider">
      <div class="slider-readout">
        <span class="slider-val empty" id="${id}-val" aria-hidden="true">–</span>
        <span class="slider-hint" id="${id}-hint">Tap or drag anywhere on the line</span>
        <label class="slider-type"><span>or type</span><input type="text" id="${id}-num" inputmode="decimal" autocomplete="off" spellcheck="false" maxlength="5" placeholder="–" aria-label="${esc(label)} (type a number from ${min} to ${max})"><span aria-hidden="true">%</span></label>
      </div>
      <div class="slider-track">
        <input type="range" class="range untouched" id="${id}" min="${min}" max="${max}" step="${step}" value="${(min + max) / 2}"
          aria-label="${esc(label)}" aria-valuetext="No answer yet" aria-describedby="${id}-hint">
        <div class="slider-ticks" aria-hidden="true">${ticks
          .map((t) => `<span style="--p:${((t - min) / (max - min)).toFixed(4)}">${esc(fmt(t))}</span>`)
          .join('')}</div>
      </div>
    </div>`;

  /** Wire a slider: nothing counts until the player first touches it. */
  U.bindSlider = (root, id, fmt, onChange) => {
    const r = root.querySelector('#' + id);
    const out = root.querySelector('#' + id + '-val');
    const hint = root.querySelector('#' + id + '-hint');
    const num = root.querySelector('#' + id + '-num');
    if (!r) return null;
    const dec = (String(r.step).split('.')[1] || '').length;
    const touch = (from) => {
      const v = parseFloat(r.value);
      if (r.classList.contains('untouched')) {
        r.classList.remove('untouched');
        out.classList.remove('empty');
        if (hint) hint.textContent = 'Drag to adjust';
      }
      out.textContent = fmt(v);
      r.setAttribute('aria-valuetext', fmt(v));
      if (num && from !== 'num') num.value = v.toFixed(dec);
      onChange(v);
    };
    ['input', 'change'].forEach((ev) => r.addEventListener(ev, () => touch('range')));
    // Typed entry: keyboard-first, with no starting value to anchor on.
    if (num) {
      const lo = parseFloat(r.min);
      const hi = parseFloat(r.max);
      num.addEventListener('input', () => {
        const t = parseFloat(String(num.value).replace(',', '.'));
        if (isNaN(t)) return;
        r.value = Math.max(lo, Math.min(hi, t));
        touch('num');
      });
      num.addEventListener('change', () => {
        if (num.value !== '' && !isNaN(parseFloat(String(num.value).replace(',', '.')))) num.value = parseFloat(r.value).toFixed(dec);
      });
    }
    // A click exactly on the hidden midpoint fires no input event, so count pointer-up too.
    let down = false;
    r.addEventListener('pointerdown', () => { down = true; });
    r.addEventListener('pointerup', () => { if (down) touch(); down = false; });
    r.addEventListener('pointercancel', () => { down = false; });
    return {
      set(v) {
        r.value = v;
        touch();
      },
    };
  };

  /* ---------- the wheel (inline SVG) ---------- */
  // Rim runs 0 -> 100 clockwise, with a 10 degree gap at the top where 100 meets 0.
  const WA = (v) => 5 + v * 3.5;
  U.wheelAngle = WA;
  const P = (a, r) => {
    const t = (a * Math.PI) / 180;
    return [+(r * Math.sin(t)).toFixed(2), +(-r * Math.cos(t)).toFixed(2)];
  };
  const arcPath = (r, a0, a1) => {
    const [x0, y0] = P(a0, r);
    const [x1, y1] = P(a1, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };

  U.wheelSVG = ({ rig = null } = {}) => {
    const vb = rig ? 176 : 104;
    const vh = rig ? 140 : 104;
    let s = `<svg class="wheel-svg${rig ? ' rig-svg mini-wheel' : ''}" viewBox="${-vb} ${-vh} ${vb * 2} ${vh * 2}" aria-hidden="true" focusable="false">`;
    s += '<g class="spin-g"><circle r="99" fill="#FBFDFC" stroke="#14213D" stroke-width="2.5"/>';
    for (let i = 0; i < 12; i++) {
      const a0 = i * 30;
      const [x0, y0] = P(a0, 72);
      const [x1, y1] = P(a0 + 30, 72);
      s += `<path d="M0 0 L${x0} ${y0} A72 72 0 0 1 ${x1} ${y1} Z" fill="${i % 2 ? '#2B3D63' : '#14213D'}"/>`;
    }
    for (let i = 0; i < 12; i++) {
      const [x, y] = P(i * 30, 72);
      s += `<line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#FBFDFC" stroke-opacity=".22" stroke-width=".8"/>`;
    }
    for (let i = 0; i < 12; i++) {
      const [x, y] = P(i * 30 + 15, 60);
      s += `<circle class="bulb" cx="${x}" cy="${y}" r="3.1"/>`;
    }
    s += '<circle r="72" fill="none" stroke="#14213D" stroke-width="1.6"/>';
    for (let v = 0; v <= 100; v++) {
      const a = WA(v);
      const len = v % 10 === 0 ? 9 : v % 5 === 0 ? 6 : 3.4;
      const [x0, y0] = P(a, 97.5);
      const [x1, y1] = P(a, 97.5 - len);
      s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#14213D" stroke-width="${v % 10 === 0 ? 1.4 : v % 5 === 0 ? 1 : 0.6}"/>`;
    }
    for (let v = 0; v <= 100; v += 10) {
      const a = WA(v);
      const [x, y] = P(a, 81.5);
      s += `<text class="wl" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" transform="rotate(${a} ${x} ${y})">${v}</text>`;
    }
    s += '<path d="M0 -99 l3.2 5 -3.2 5 -3.2 -5z" fill="#14213D"/>';
    s += '<circle r="17" fill="#FBFDFC" stroke="#14213D" stroke-width="2.5"/><circle r="5" fill="#14213D"/></g>';
    if (rig) {
      const zones = [rig.lo, rig.hi];
      zones.forEach((z, i) => {
        const a0 = WA(z[0]);
        const a1 = WA(z[1]);
        s += `<path d="${arcPath(89, a0, a1)}" fill="none" stroke="#D62828" stroke-opacity=".22" stroke-width="18" stroke-linecap="butt"/>`;
        s += `<path class="draw" pathLength="1" d="${arcPath(110, a0 - 2, a1 + 2)}" fill="none" stroke="#D62828" stroke-width="4" stroke-linecap="round" style="transition-delay:${i * 0.25}s"/>`;
        const mid = (a0 + a1) / 2;
        const [lx, ly] = P(mid, 118);
        const anchor = lx > 20 ? 'start' : lx < -20 ? 'end' : 'middle';
        s += `<text class="rig-lab" x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="central">${z[0]}–${z[1]}</text>`;
      });
      if (rig.got != null) {
        const a = WA(rig.got);
        const [x0, y0] = P(a, 64);
        const [x1, y1] = P(a, 97);
        s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="#FFE45C" stroke-width="4" stroke-linecap="round"/>`;
      }
    }
    s += '</svg>';
    return s;
  };

  U.pointerSVG = () =>
    '<svg class="wheel-pointer" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 42 L4 12 A14 14 0 1 1 30 12 Z" fill="#14213D"/><circle cx="17" cy="14" r="5.5" fill="#FFE45C"/></svg>';

  /* ---------- number line: anchor / you / truth ---------- */
  U.numberLine = ({ min, max, ticks, fmt, marks, label }) => {
    const p = (v) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
    const hasAnchor = marks.some((m) => m && m.kind === 'anchor');
    // Drop a tick's label when a marker sits on top of it (the marker's own label already gives the value).
    // (The anchor marker stays above the line, so only "you" and "truth" can cover a tick label.)
    const covered = (t) => marks.some((m) => m && m.kind !== 'anchor' && m.v != null && !isNaN(m.v) && Math.abs(p(m.v) - p(t)) < 4);
    const tk = ticks.map((t) => `<span class="nl-tick" style="left:${p(t)}%">${covered(t) ? '' : `<i>${esc(fmt(t))}</i>`}</span>`).join('');
    const mk = marks
      .filter((m) => m && m.v != null && !isNaN(m.v))
      .map((m) => {
        const pp = p(m.v);
        const edge = pp < 9 ? ' is-l' : pp > 91 ? ' is-r' : '';
        return `<span class="nl-m nl-${m.kind}${edge}" style="left:${pp}%"><span class="nl-lab">${m.label}</span></span>`;
      })
      .join('');
    return `<div class="nl${hasAnchor ? '' : ' no-anchor'}" role="img" aria-label="${esc(label)}"><span class="nl-line"></span>${tk}${mk}</div>`;
  };

  /* ---------- OPINION: agree / neither / disagree bar ---------- */
  U.agreeBar = (id) => {
    if (!U.hasQ(id)) return '';
    const S = window.Survey;
    const q = S.q(id);
    const d = U.dis(id);
    const n = U.neu(id);
    const a = U.ag(id);
    const seg = (cls, v) => `<span class="ab-seg ${cls}" style="flex:${v.toFixed(2)} 1 0">${v >= 9 ? U.fmt(v) : ''}</span>`;
    const aria = `${S.label(id)}: ${U.fmt(d)} disagree, ${U.fmt(n)} neither, ${U.fmt(a)} agree. ${q.n_answered} people answered.`;
    return `<figure class="ab">
      <figcaption class="ab-q"><b>${esc(id.toUpperCase())}</b>“${esc(S.label(id))}”</figcaption>
      <div class="ab-track" role="img" aria-label="${esc(aria)}">${seg('dis', d)}${seg('neu', n)}${seg('agr', a)}</div>
      <div class="ab-leg"><span><i class="sw dis"></i>Disagree ${U.fmt(d)}</span><span><i class="sw neu"></i>Neither ${U.fmt(n)}</span><span><i class="sw agr"></i>Agree ${U.fmt(a)}</span><span class="ab-n">n = ${q.n_answered} answered</span></div>
    </figure>`;
  };

  /* ---------- OPINION: 5-option distribution with a "You" marker ---------- */
  const OP_TINTS = ['#E6DEF2', '#C7B3E3', '#A283D1', '#7A3DB8', '#4E2385'];
  const OP_TEXT = ['#14213D', '#14213D', '#14213D', '#FFFFFF', '#FFFFFF'];
  const AS_TINTS = ['#FBEBCB', '#F4D495', '#E7B257', '#C27100', '#7F4A00'];
  const AS_TEXT = ['#1B1400', '#1B1400', '#1B1400', '#1B1400', '#FFFFFF'];

  /**
   * rows: [{label, pct, count}] in order. you: index or null.
   */
  U.distBar = ({ rows, you = null, youText = 'You', tone = 'opinion', aria = '' }) => {
    const tints = tone === 'opinion' ? OP_TINTS : AS_TINTS;
    const txt = tone === 'opinion' ? OP_TEXT : AS_TEXT;
    const total = rows.reduce((s, r) => s + r.pct, 0) || 1;
    let acc = 0;
    let youLeft = null;
    const segs = rows
      .map((r, i) => {
        const w = (r.pct / total) * 100;
        if (i === you) youLeft = acc + w / 2;
        acc += w;
        return `<span class="db-seg" style="flex:${r.pct.toFixed(2)} 1 0;background:${tints[i % 5]};color:${txt[i % 5]}">${r.pct >= 8 ? U.fmt(r.pct) : ''}</span>`;
      })
      .join('');
    const marker = youLeft != null ? `<span class="db-you" style="left:${youLeft.toFixed(2)}%"><span>${esc(youText)}</span></span>` : '';
    const leg = rows
      .map(
        (r, i) =>
          `<li class="${i === you ? 'me' : ''}"><i class="sw" style="background:${tints[i % 5]}"></i><span>${esc(r.label)}${i === you ? `<span class="me-tag">${esc(youText)}</span>` : ''}</span><span class="v">${U.fmt(r.pct)}${r.count != null ? ` <span class="muted">(${r.count})</span>` : ''}</span></li>`
      )
      .join('');
    return `<div class="db${you != null ? ' db-has-you' : ''}"><div class="db-track" role="img" aria-label="${esc(aria)}">${segs}${marker}</div><ul class="db-leg">${leg}</ul></div>`;
  };

  U.surveyRows = (id) => {
    const q = window.Survey.q(id);
    return q.options.map((o) => ({ label: o.short || o.label, pct: q.n_answered ? (100 * o.count) / q.n_answered : o.pct, count: o.count }));
  };

  /* ---------- feed posts ---------- */
  U.initials = (name) => {
    let s = String(name).replace(/^The\s+/, '');
    s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
    const words = s.split(/[\s]+/).filter((w) => /^[A-ZÀ-Ý]/.test(w));
    if (!words.length) return s.slice(0, 1).toUpperCase();
    if (/^[A-ZÀ-Ý]{2,}/.test(words[0])) return words[0].slice(0, 2);
    if (words.length === 1) return words[0].slice(0, 1);
    return (words[0][0] + words[1][0]).toUpperCase();
  };
  const AV = ['#14213D', '#2F5D50', '#6B4E2E', '#4A3F6B', '#305F7A', '#5A4450', '#3D5A2A', '#7A5230'];
  U.avatarColor = (name) => {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AV[h % AV.length];
  };
  U.avatar = (name) => `<span class="av" style="--c:${U.avatarColor(name)}" aria-hidden="true">${esc(U.initials(name))}</span>`;

  U.k = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n));

  const ICON = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l-3-3M17 17H7l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    reply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H10l-4 4v-4H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  };

  U.post = (c, eng, media, trending) => `
    <article class="post" data-id="${esc(c.id)}">
      <header class="post-h">${U.avatar(c.outlet)}<div class="post-who"><b>${esc(c.outlet)}</b><span>${esc(c.date)}</span></div><span class="post-more" aria-hidden="true">···</span></header>
      ${trending ? '<span class="post-trend">Trending</span>' : ''}
      <p class="post-t">${esc(c.claim)}</p>
      ${media ? `<div class="post-media"><span class="pm-big">${esc(media.big)}</span><span class="pm-sub">${esc(media.sub)}</span></div>` : ''}
      <footer class="post-f"><span>${ICON.like}${U.k(eng.likes)}</span><span>${ICON.share}${U.k(eng.shares)}</span><span>${ICON.reply}${U.k(eng.replies)}</span></footer>
    </article>`;

  /* ---------- small icons ---------- */
  U.icon = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    done: '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="none" stroke="#5B6B7F" stroke-width="2"/><path d="M11 18.5l5 4.5 9-10" fill="none" stroke="#14213D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flask: '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M12 3h6M13 3v8L6 24a2 2 0 0 0 1.8 3h14.4A2 2 0 0 0 24 24l-7-13V3" fill="none" stroke="#14213D" stroke-width="2" stroke-linejoin="round"/><path d="M9 19h12" stroke="#14213D" stroke-width="2"/><circle cx="14" cy="22.5" r="1.3" fill="#14213D"/><circle cx="18" cy="21" r="1" fill="#14213D"/></svg>',
    arrowUp: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#14213D"/><path d="M12 17V7m-4 4 4-4 4 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#14213D"/><path d="M12 7v10m-4-4 4 4 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#14213D"/><path d="M17 12H7m4-4-4 4 4 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#14213D"/><path d="M7 12h10m-4-4 4 4-4 4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/></svg>',
    equal: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#14213D"/><path d="M7.5 9.5h9M7.5 14.5h9" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
    penCheck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13c2 1.5 3.5 3.5 5 6 3-7 6.5-11.5 11-15" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    penCross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5c5 4.5 9 9 14 14M19 4.5C13.5 9 9 14 5 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };

  U.clipSVG = () =>
    '<svg class="clip" viewBox="0 0 34 86" aria-hidden="true"><path d="M10 30V12a7 7 0 0 1 14 0v52a10 10 0 0 1-20 0V22" fill="none" stroke="#8A97A8" stroke-width="3.2" stroke-linecap="round"/><path d="M10 30V12a7 7 0 0 1 14 0v52a10 10 0 0 1-20 0V22" fill="none" stroke="#D9E1EA" stroke-width="1.2" stroke-linecap="round" transform="translate(-.8 -.8)"/></svg>';

  window.RiggedUI = U;
})();

/*
 * game.js - RIGGED: three rigged experiments + a lab report.
 * Flow: start -> wheel -> wheel-debrief -> feed -> feed-debrief -> crowd -> crowd-debrief -> finale
 * Survey numbers: window.Survey only. Facts and news claims: window.DC_FACTS only.
 * Debug: #screen=<name> jumps to a representative state (see DEBUG_SETUP at the bottom).
 */
(function () {
  'use strict';

  const U = window.RiggedUI;
  const S = window.Survey;
  const F = window.DC_FACTS || {};
  if (!S || !U) return; // survey.js already shows a helpful message when the data is missing

  const esc = U.esc;
  const fmt = U.fmt;
  const dash = (t) => String(t == null ? '' : t).replace(/ - /g, ' – '); // typographic dash for fact text
  const stage = document.getElementById('stage');
  const announcer = document.getElementById('announcer');

  const HASH_SCREEN = () => (location.hash.match(/screen=([\w-]+)/) || [])[1] || null;
  let DEBUG = !!HASH_SCREEN();

  const ETHICS = "Every experiment here is rigged, and you'll be told how right after. Real news feeds and comment sections don't tell you.";
  const FAKE_CROWD = 80; // the rigged "live" share - a game constant, not survey data
  // The wheel's rig: the only ranges it can land on. Spin logic, debrief visual and all copy read from here.
  const RIG = { lo: [6, 12], hi: [65, 85] };
  const rigText = (z) => `${z[0]}–${z[1]}`;
  const rigRanges = () => `<span class="nw">${rigText(RIG.lo)}</span> or <span class="nw">${rigText(RIG.hi)}</span>`;
  const CLOSE_PTS = 4; // an estimate within this many points of the truth is "close", never "pulled"
  const WORD = ['zero', 'one', 'two', 'three', 'four'];

  /* ---------- device storage: per-browser, never written from debug screens ---------- */
  const KEYS = { anchor: 'rigged.v1.anchor', gut: 'rigged.v1.gut' };
  let storageFailed = false; // set when a save fails (private window, blocked site data)
  let lastAnchorMem = null; // fallback so "play again" still alternates when storage is blocked
  const store = {
    get(k) {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    },
    set(k, arr) {
      if (DEBUG) return true;
      try {
        localStorage.setItem(k, JSON.stringify(arr.slice(-500)));
        return true;
      } catch (e) {
        storageFailed = true;
        return false;
      }
    },
  };
  const NOT_SAVING = "This browser isn't saving answers (private window?), so there's nothing to compare yet.";
  let debugDevice = { anchor: [], gut: [] };
  const deviceAnchors = () =>
    (DEBUG ? debugDevice.anchor : store.get(KEYS.anchor)).filter((d) => d && (d.t === 'low' || d.t === 'high') && typeof d.g === 'number');
  const deviceGut = () => (DEBUG ? debugDevice.gut : store.get(KEYS.gut)).filter((v) => Number.isInteger(v) && v >= 1 && v <= 5);

  /* ---------- timers (cleared on every screen change) ---------- */
  const timers = new Set();
  const later = (fn, ms) => {
    const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
    timers.add(t);
    return t;
  };
  const leaves = []; // cleanup callbacks for the current screen
  const clearTimers = () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    while (leaves.length) leaves.pop()();
  };
  const announce = (msg) => { if (announcer) { announcer.textContent = ''; later(() => { announcer.textContent = msg; }, 60); } };

  /* ---------- facts (from DC_FACTS) ---------- */
  const CSO = (() => {
    const c = F.csoSeries;
    if (!c || !Array.isArray(c.years) || !c.years.length) return null;
    const y = c.years.find((r) => r.year === 2025) || c.years[c.years.length - 1];
    return { pct: y.pct, year: y.year, source: c.source, url: c.url };
  })();

  const WATER = (() => {
    const f = (F.facts || []).find((x) => x.id === 'ie-water');
    if (!f) return null;
    const under = f.text.match(/under ([\d.]+)%/);
    const litres = f.text.match(/((?:over |about |nearly )?\d[\d,.]* million litres)/);
    const month = f.text.match(/(January|February|March|April|May|June|July|August|September|October|November|December) of (\d{4})/);
    return {
      pct: under ? parseFloat(under[1]) : null,
      litres: litres ? litres[1].charAt(0).toUpperCase() + litres[1].slice(1) : null,
      month: month ? `${month[1]} ${month[2]}` : null,
      text: f.text,
      source: f.source,
      url: f.url,
    };
  })();

  const CLAIMS = {};
  (F.claims || []).forEach((c) => { CLAIMS[c.id] = c; });
  const ALARM = ['c5', 'c2', 'c17', 'c18', 'c16', 'c11'].filter((id) => CLAIMS[id]);
  const CALM = ['c7', 'c4'].filter((id) => CLAIMS[id]);
  const VERDICT = {
    supported: ['Supported', 'ok'],
    mostly_supported: ['Mostly supported', 'ok'],
    missing_context: ['Missing context', 'meh'],
    misleading: ['Misleading', 'meh'],
    unsupported: ['Unsupported', 'meh'],
    opinion: ['Advocacy estimate', 'meh'],
  };

  const AVAILABLE = {
    wheel: !!CSO,
    feed: !!(WATER && WATER.pct && ALARM.length),
    crowd: U.hasQ('q77'),
  };
  const ORDER = ['wheel', 'feed', 'crowd'].filter((k) => AVAILABLE[k]);
  const NAMES = { wheel: 'The wheel', feed: 'The feed', crowd: 'The crowd', finale: 'Your lab report' };
  const nextOf = (cur) => ORDER[ORDER.indexOf(cur) + 1] || 'finale';

  /* ---------- state ---------- */
  function engagement(alarm) {
    return alarm
      ? { likes: U.randInt(1400, 9800), shares: U.randInt(280, 2600), replies: U.randInt(120, 980) }
      : { likes: U.randInt(40, 320), shares: U.randInt(3, 45), replies: U.randInt(2, 36) };
  }

  function buildFeed() {
    const seq = U.shuffle(ALARM.filter((id) => id !== 'c5'));
    if (CLAIMS.c5) seq.splice(Math.min(2, seq.length), 0, 'c5'); // the vivid one, early
    const slotSets = [[3, 6], [4, 7], [3, 7], [4, 6], [5, 7]];
    const slots = slotSets[U.randInt(0, slotSets.length - 1)];
    CALM.forEach((id, i) => seq.splice(Math.min(slots[i] != null ? slots[i] : seq.length, seq.length), 0, id));
    const trendPick = U.shuffle(ALARM.filter((id) => id !== 'c5'))[0];
    return seq.map((id) => {
      const alarm = ALARM.includes(id);
      return { id, alarm, eng: engagement(alarm), trending: id === 'c5' || id === trendPick };
    });
  }

  function fresh() {
    return {
      pid: String(U.randInt(0, 9999)).padStart(4, '0'),
      wheel: { anchorType: null, anchor: null, side: null, guess: null, rot: 0, saved: false },
      feed: { posts: buildFeed(), idx: 0, started: false, ended: false, paused: false, guess: null, tone: null },
      crowd: { side: Math.random() < 0.5 ? 'unacceptable' : 'acceptable', first: null, second: null, players: U.randInt(1180, 1460) },
      gut: null,
      gutSaved: false,
    };
  }
  let state = fresh();

  /* ---------- results (used by debriefs and the lab report) ---------- */
  function wheelResult() {
    const w = state.wheel;
    if (!CSO || w.guess == null) return null;
    const diff = w.guess - CSO.pct;
    const anchorSide = w.anchorType === 'high' ? diff > 0 : diff < 0;
    const close = Math.abs(diff) <= CLOSE_PTS;
    // Only count it when the estimate is on the anchor's side AND clearly off (5+ points).
    return { diff, anchorSide, close, pulled: anchorSide && !close };
  }
  function feedResult() {
    const f = state.feed;
    if (!WATER || f.guess == null) return null;
    const ratio = f.guess / WATER.pct;
    return { ratio, fell: ratio > 3, alarm: f.posts.filter((p) => p.alarm).length, total: f.posts.length };
  }
  /** How the rig amplified the alarming posts (all of it is the game's own invention). */
  function feedBoost() {
    const posts = state.feed.posts;
    const avg = (a) => (a.length ? a.reduce((s, p) => s + p.eng.likes, 0) / a.length : 0);
    const al = posts.filter((p) => p.alarm);
    const ca = posts.filter((p) => !p.alarm);
    const trend = posts.filter((p) => p.trending);
    return {
      likesX: ca.length && avg(ca) ? Math.round(avg(al) / avg(ca)) : null,
      allTrendAlarm: trend.length > 0 && trend.every((p) => p.alarm),
      picAlarm: !!(WATER && WATER.litres && posts.some((p) => p.id === 'c5' && p.alarm)),
    };
  }
  function crowdResult() {
    const c = state.crowd;
    if (c.first == null || c.second == null) return null;
    const pull = (c.side === 'acceptable' ? 1 : -1) * (c.first - c.second);
    return { pull, fell: pull > 0 };
  }

  /* ---------- screen plumbing ---------- */
  const STEP = { start: 0, wheel: 1, 'wheel-debrief': 1, feed: 2, 'feed-debrief': 2, crowd: 3, 'crowd-debrief': 3, finale: 4 };
  function setSteps(name) {
    const now = STEP[name] || 0;
    document.querySelectorAll('.steps li').forEach((li) => {
      const i = +li.dataset.step;
      li.classList.toggle('is-now', i === now);
      li.classList.toggle('is-done', i < now);
      if (i === now) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }

  const jumpTop = () => window.scrollTo(0, 0);
  function originOn(el) {
    const r = el.getBoundingClientRect();
    const y = Math.max(0, Math.min(r.height, window.innerHeight / 2 - r.top));
    el.style.transformOrigin = `50% ${Math.round(y)}px`;
  }

  let busy = false;
  async function go(name, how = 'next') {
    if (busy) return;
    busy = true;
    try {
      clearTimers();
      const old = stage.firstElementChild;
      const el = RENDER[name]();
      setSteps(name);
      document.title = `${name === 'start' ? 'Rigged' : 'Rigged · ' + (NAMES[name.replace('-debrief', '')] || 'Lab')} · Behind the Headlines`;
      if (!old || how === 'none') {
        if (old) old.remove();
        stage.appendChild(el);
      } else if (U.reduced()) {
        old.classList.add('fade-out');
        await U.wait(200);
        old.remove();
        jumpTop();
        el.classList.add('fade-in');
        stage.appendChild(el);
        await U.wait(280);
        el.classList.remove('fade-in');
      } else if (how === 'flip') {
        originOn(old);
        old.classList.add('flip-out');
        await U.wait(300);
        old.remove();
        jumpTop();
        el.classList.add('flip-in');
        stage.appendChild(el);
        originOn(el);
        await U.wait(320);
        el.classList.remove('flip-in');
      } else {
        old.classList.add('sheet-out');
        await U.wait(280);
        old.remove();
        jumpTop();
        el.classList.add('sheet-in');
        stage.appendChild(el);
        await U.wait(460);
        el.classList.remove('sheet-in');
      }
      if (el._mount) el._mount();
      const t = el.querySelector('.title');
      if (t && how !== 'none') t.focus({ preventScroll: true });
    } finally {
      busy = false;
    }
  }

  function sheet({ left, right, debrief = false, stamp = debrief, cls = '' }, body) {
    return U.el(`<article class="sheet${debrief ? ' debrief' : ''} ${cls}">
      <header class="sheet-head"><span>${left}</span><span class="sh-r">${right}</span></header>
      <div class="sheet-body">${stamp ? '<div class="stamp pending" aria-hidden="true">RIGGED</div>' : ''}${body}</div>
    </article>`);
  }
  const head = (n, bias) => `<b>Experiment ${n}</b> · ${bias} · Participant #${state.pid}`;
  const dsec = (letter, label, chip, inner, id = '') =>
    `<section class="dsec"${id ? ` id="${id}"` : ''}><div class="dsec-l"><span class="L">${letter}</span>${label}${chip ? ' ' + U.chip(chip) : ''}</div><div class="dsec-r">${inner}</div></section>`;

  /** Stamp thump, sheet jolt, then the red pen rings get drawn. */
  function stampIt(el) {
    const st = el.querySelector('.stamp');
    later(() => {
      if (st) { st.classList.remove('pending'); st.classList.add('thump'); }
      if (!U.reduced()) later(() => { el.classList.add('impact'); later(() => el.classList.remove('impact'), 240); }, 150);
      later(() => el.classList.add('drawn'), 330);
    }, 140);
  }

  function pressOne(buttons, btn) { buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn))); }

  const reassure = (html) => `<div class="reassure">${U.icon.flask}<p>${html}</p></div>`;
  const nextBtn = (label) => `<div class="btnrow d-next"><button type="button" class="btn" id="next">${label} <span class="arr" aria-hidden="true">→</span></button></div>`;

  /* ======================================================================
     START - participant briefing
     ====================================================================== */
  function renderStart() {
    const wrap = U.el(`<div class="stack-wrap">${U.clipSVG()}</div>`);
    const exps = ORDER.map((k, i) => `<span><i>0${i + 1}</i>${NAMES[k]}</span>`).join('');
    const el = sheet(
      { left: `<b>Form 00</b> · Participant briefing · Participant #${state.pid}`, right: 'Page 1 of 1', cls: 'stacked' },
      `<div class="brief">
      <div class="brief-intro">
        <p class="kicker">Behavioural lab · Data centres</p>
        <h1 class="title" tabindex="-1">Rigged.</h1>
        <p class="lede">Three experiments. All of them fixed. You'll still fall for it.</p>
      </div>
      <div class="brief-form">
      <dl class="fields">
        <div class="field"><dt>Participant</dt><dd><span class="mono">#${state.pid}</span></dd></div>
        <div class="field"><dt>Duration</dt><dd>About 4 minutes</dd></div>
        <div class="field"><dt>Experiments</dt><dd class="exp-list">${exps}</dd></div>
        <div class="field"><dt>Procedure</dt><dd>You will be mildly misled for science and debriefed after each experiment.</dd></div>
        <div class="field"><dt>Compared with</dt><dd>What ${esc(U.who())} said about themselves.</dd></div>
      </dl>
      <div class="signature"><div class="line"></div><small>Participant signature</small></div>
      </div>
      <div class="brief-act">
        <p class="ethics">${ETHICS}</p>
        <button type="button" class="btn" id="enter">Enter the lab <span class="arr" aria-hidden="true">→</span></button>
        <p class="fineprint">Not a real consent form: no personal data is collected, and nothing you answer leaves this device.</p>
      </div>
      </div>`
    );
    wrap.appendChild(el);
    el.querySelector('#enter').addEventListener('click', () => go(ORDER[0] || 'finale'));
    return wrap;
  }

  /* ======================================================================
     EXPERIMENT 01 - THE WHEEL (anchoring)
     ====================================================================== */
  function spinTarget(cur, v) {
    const want = (((-U.wheelAngle(v)) % 360) + 360) % 360;
    const base = cur + 360 * 5;
    const baseMod = ((base % 360) + 360) % 360;
    let d = want - baseMod;
    if (d < 0) d += 360;
    return base + d + (Math.random() - 0.5) * 1.6;
  }

  function renderWheel() {
    const w = state.wheel;
    const el = sheet(
      { left: head('01', 'Anchoring'), right: 'Protocol sheet' },
      `<div class="intro-row"><div><p class="kicker">Experiment 01</p><h1 class="title" tabindex="-1">The wheel</h1></div>
      <p class="lede">First, a random number. Then a question about data centres. The two have nothing to do with each other. Obviously.</p></div>
      <div class="cols">
        <div class="wheel-col">
          <div class="wheel-wrap">${U.pointerSVG()}<div class="wheel-rot">${U.wheelSVG()}</div></div>
          <div class="wheel-act">
            <div class="readout"><span class="readout-k">Your random number</span><span class="readout-v empty" id="ro">–</span></div>
            <button type="button" class="btn" id="spin">Spin the wheel</button>
          </div>
        </div>
        <div class="q-col">
          <section class="qblock" id="qa" aria-labelledby="qa-t">
            <p class="qnum">Q.A <span class="qstate" id="qa-s">· spin the wheel first</span></p>
            <h2 class="qtext" id="qa-t">Do data centres use more or less than <span class="anchor-slot">…%</span> of Ireland's electricity?</h2>
            <div class="opts row" role="group" aria-labelledby="qa-t">${U.opt('more', 'More')}${U.opt('less', 'Less')}</div>
          </section>
          <section class="qblock" id="qb" aria-labelledby="qb-t">
            <p class="qnum">Q.B</p>
            <h2 class="qtext" id="qb-t">Your best estimate?</h2>
            <p class="qhint">Data centres' share of Ireland's electricity, from 0 to 100%.</p>
            ${U.slider({ id: 'est', min: 0, max: 100, step: 1, ticks: [0, 25, 50, 75, 100], fmt: (v) => v + '%', label: "Your estimate: data centres' share of Ireland's electricity, percent" })}
          </section>
          <div class="btnrow"><button type="button" class="btn" id="lock" disabled>Lock in <span class="arr" aria-hidden="true">→</span></button><span class="lockhint" id="lockhint"></span></div>
        </div>
      </div>
      <p class="fineprint">${U.chip('assume')}&nbsp; Your answers are your own guesses. The truth comes after.</p>`
    );

    const qa = el.querySelector('#qa');
    const qb = el.querySelector('#qb');
    const lock = el.querySelector('#lock');
    const hint = el.querySelector('#lockhint');
    const rot = el.querySelector('.wheel-rot .spin-g');
    const wrap = el.querySelector('.wheel-wrap');
    const ro = el.querySelector('#ro');
    const spin = el.querySelector('#spin');
    const opts = [...el.querySelectorAll('#qa .opt')];
    qa.inert = true;
    qb.inert = true;

    const refresh = () => {
      const ok = w.anchor != null && w.side && w.guess != null;
      lock.disabled = !ok || w.saved;
      hint.textContent =
        w.anchor == null ? 'Spin first, then answer both questions.'
          : !w.side ? 'Answer Q.A.'
            : w.guess == null ? 'Now make your estimate in Q.B.'
              : 'Ready when you are.';
    };
    const showAnchor = (animate) => {
      ro.textContent = w.anchor;
      ro.classList.remove('empty');
      if (animate) ro.classList.add('pop');
      el.querySelector('.anchor-slot').innerHTML = `<span class="hl${animate ? ' swipe' : ''}">${w.anchor}%</span>`;
      qa.inert = false;
      el.querySelector('#qa-s').textContent = '';
      spin.disabled = true;
      spin.textContent = 'Spun';
    };

    opts.forEach((b) =>
      b.addEventListener('click', () => {
        pressOne(opts, b);
        w.side = b.dataset.v;
        qb.inert = false;
        refresh();
      })
    );
    const slider = U.bindSlider(el, 'est', (v) => Math.round(v) + '%', (v) => { w.guess = Math.round(v); refresh(); });

    spin.addEventListener('click', () => {
      if (w.anchor != null) return;
      // Alternate on this device so "play again" really gives the other anchor; random on a first visit.
      const saved = store.get(KEYS.anchor).slice(-1)[0];
      const last = (saved && saved.t) || lastAnchorMem;
      const low = last === 'high' || last === 'low' ? last === 'high' : Math.random() < 0.5;
      w.anchorType = low ? 'low' : 'high';
      const z = low ? RIG.lo : RIG.hi;
      w.anchor = U.randInt(z[0], z[1]);
      const target = spinTarget(w.rot, w.anchor);
      w.rot = target;
      spin.disabled = true;
      spin.textContent = 'Spinning…';
      const done = (animate) => {
        wrap.classList.remove('spinning');
        showAnchor(animate);
        refresh();
        announce(`The wheel landed on ${w.anchor}. Question A is ready.`);
        // On a phone Q.A sits below the wheel: let the number land, then bring the question into view.
        const toQA = () => {
          const r = qa.getBoundingClientRect();
          if (r.top > window.innerHeight - 220) qa.scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'center' });
          opts[0].focus({ preventScroll: true });
        };
        if (animate) later(toQA, 400);
        else toQA();
      };
      if (U.reduced()) {
        rot.style.transform = `rotate(${target}deg)`;
        done(false);
        return;
      }
      wrap.classList.add('spinning');
      rot.style.transition = 'transform 2.2s cubic-bezier(.12,.68,.1,1)';
      void rot.offsetWidth; // commit the transition before changing the angle
      rot.style.transform = `rotate(${target}deg)`;
      later(() => done(true), 2260);
    });

    lock.addEventListener('click', () => {
      if (lock.disabled || w.saved) return; // a double-click must not save the play twice
      w.saved = true;
      lock.disabled = true;
      lastAnchorMem = w.anchorType;
      const arr = store.get(KEYS.anchor);
      arr.push({ t: w.anchorType, g: w.guess });
      store.set(KEYS.anchor, arr);
      go('wheel-debrief', 'flip');
    });

    // restore (debug screens, or coming back)
    if (w.anchor != null) {
      rot.style.transform = `rotate(${w.rot}deg)`;
      showAnchor(false);
    }
    if (w.side) {
      pressOne(opts, opts.find((o) => o.dataset.v === w.side));
      qb.inert = false;
    }
    if (w.guess != null && slider) slider.set(w.guess);
    refresh();
    return el;
  }

  function renderWheelDebrief() {
    const w = state.wheel;
    const truth = CSO.pct;
    const g = w.guess;
    const r = wheelResult();
    const pts = Math.abs(r.diff);
    const dirWord = r.diff > 0 ? 'above' : 'below';
    const ptsTxt = `${pts} point${pts === 1 ? '' : 's'}`;
    const dirIcon = r.diff > 0 ? U.icon.arrowUp : U.icon.arrowDown;
    const verdict =
      r.diff === 0 ? { icon: U.icon.equal, t: `Bang on: ${truth}%. The anchor didn't get you this time.` }
        : r.close ? { icon: dirIcon, t: `Your estimate landed ${ptsTxt} ${dirWord} the truth. Close to the truth – held firm. (Within ${CLOSE_PTS} points, we don't count it as pulled either way.)` }
          : r.pulled ? { icon: dirIcon, t: `Your estimate landed <b>${ptsTxt} ${dirWord}</b> the truth – on the same side as your ${w.anchorType} anchor. It leaned the way the rig pushed.` }
            : { icon: dirIcon, t: `Your estimate landed ${ptsTxt} ${dirWord} the truth – on the far side from your anchor. You resisted it.` };

    // D - this device
    const dev = deviceAnchors();
    const lows = dev.filter((d) => d.t === 'low');
    const highs = dev.filter((d) => d.t === 'high');
    const avg = (a) => Math.round(a.reduce((s, d) => s + d.g, 0) / a.length);
    const plays = (n) => `${n} play${n === 1 ? '' : 's'}`;
    let device;
    if (lows.length && highs.length) {
      const gap = avg(highs) - avg(lows);
      device = `<p class="said">Players on this device: low anchor → average <b class="hl">${avg(lows)}%</b> <span class="muted">(${plays(lows.length)})</span>, high anchor → average <b class="hl">${avg(highs)}%</b> <span class="muted">(${plays(highs.length)})</span>.</p>
        <p class="small muted">${gap > 0 ? `High anchors guessed ${gap} points higher on average – the classic pattern.` : 'No anchor gap on this device yet.'} Saved in this browser only: ${plays(dev.length)} in total <span class="caveat">small group (n = ${dev.length})</span></p>`;
    } else if (storageFailed && !DEBUG) {
      device = `<p class="said">Play again to get the other anchor and test yourself.</p>
        <p class="small muted">${NOT_SAVING}</p>`;
    } else {
      device = `<p class="said">Play again to get the other anchor and test yourself.</p>
        <p class="small muted">This browser has ${plays(dev.length)} saved: ${lows.length} low, ${highs.length} high. Once it has both kinds, the averages appear here side by side.</p>`;
    }

    // E - what respondents believe about themselves
    const has62 = U.hasQ('q62');
    const has65 = U.hasQ('q65');
    const mirrorText = has62 || has65
      ? `<p class="mirror-lede">In the survey, only <b>${has62 ? fmt(U.ag('q62')) : '–'}</b> agreed their first impression of data centres stayed with them, and <b>${has65 ? fmt(U.ag('q65')) : '–'}</b> that they trust the first source they encounter.</p>${U.agreeBar('q62')}${U.agreeBar('q65')}<p class="who">${esc(U.who())}.</p>`
      : '';

    const el = sheet(
      { left: head('01', 'Anchoring'), right: '<span class="copy">Researcher\'s copy</span>', debrief: true },
      `<div class="d-top">
        <div class="rig-visual">${U.wheelSVG({ rig: { lo: RIG.lo, hi: RIG.hi, got: w.anchor } })}</div>
        <div>
          <p class="kicker">Debrief · Experiment 01</p>
          <h1 class="title" tabindex="-1">The wheel</h1>
          <p class="pen lg">The wheel only ever lands on ${rigRanges()}.</p>
          <p class="lede">Nothing random about it. You got <b class="hl">${w.anchor}</b>, a ${w.anchorType} anchor. A first spin is a coin toss between low and high; after that, each device alternates. Then we asked about electricity.</p>
        </div>
      </div>
      ${dsec('A', 'What you did', 'assume', `<p class="said">You said data centres use <b>${w.side}</b> than <b>${w.anchor}%</b> of Ireland's electricity, then estimated <b class="hl swipe">${g}%</b>.</p>`)}
      ${dsec('B', 'The truth', 'data', `
        <div class="bigfact"><span class="bignum data">${truth}%</span><p>of Ireland's metered electricity was used by data centres in ${CSO.year}.</p></div>
        ${U.src(CSO.source, CSO.url)}
        ${U.numberLine({
          min: 0, max: 100, ticks: [0, 25, 50, 75, 100], fmt: (v) => v + '%',
          marks: [
            { kind: 'anchor', v: w.anchor, label: `Anchor ${w.anchor}` },
            { kind: 'you', v: g, label: `You ${g}%` },
            { kind: 'truth', v: truth, label: `Truth ${truth}%` },
          ],
          label: `Number line from 0 to 100%. Your anchor: ${w.anchor}. Your estimate: ${g}%. The truth: ${truth}%.`,
        })}
        <p class="verdict">${verdict.icon}<span>${verdict.t}</span></p>
        <p class="pen sm aside">${r.pulled ? 'Interesting. Very interesting.' : 'Hm. Noted.'}</p>`)}
      ${dsec('C', 'Classic evidence', 'data', `
        <blockquote class="quote-study">In a famous 1974 experiment, people who spun a 10 guessed a median of 25%; people who spun a 65 guessed 45% – for the same question.
          <cite>Tversky &amp; Kahneman, <i>Science</i>, 1974 · <a class="src" href="https://doi.org/10.1126/science.185.4157.1124" target="_blank" rel="noopener noreferrer"><span class="src-k">Source</span><span>doi.org/10.1126/science.185.4157.1124</span><span aria-hidden="true">↗</span></a></cite>
        </blockquote>`)}
      ${dsec('D', 'This device', 'assume', device)}
      ${mirrorText ? dsec('E', 'How they see themselves', 'opinion', mirrorText) : ''}
      ${reassure('<b>Falling for it is normal.</b> That\'s why this effect is famous: even a number that looks random can drag an estimate towards it.')}
      ${nextBtn(`Next: ${NAMES[nextOf('wheel')]}`)}`
    );
    el.querySelector('#next').addEventListener('click', () => go(nextOf('wheel')));
    el._mount = () => stampIt(el);
    return el;
  }

  /* ======================================================================
     EXPERIMENT 02 - THE FEED (availability)
     ====================================================================== */
  function renderFeed() {
    const f = state.feed;
    const media = (id) => (id === 'c5' && WATER && WATER.litres ? { big: WATER.litres, sub: `in one month${WATER.month ? ' · ' + WATER.month : ''}` } : null);
    const list =
      f.posts.map((p) => U.post(CLAIMS[p.id], p.eng, media(p.id), p.trending)).join('') +
      `<div class="feed-end">${U.icon.done}You're all caught up</div>`;
    const n = f.posts.length;
    const el = sheet(
      { left: head('02', 'Availability'), right: 'Protocol sheet' },
      `<div class="intro-row"><div><p class="kicker">Experiment 02</p><h1 class="title" tabindex="-1">The feed</h1></div>
      <p class="lede">A quick scroll through a normal-looking feed. Just read the posts as they go by. Questions come after.</p></div>
      <div class="cols feed-cols">
        <div class="phone-col">
          <div class="phone" role="region" aria-label="Simulated social media feed">
            <div class="phone-screen">
              <div class="phone-top" aria-hidden="true"><span>9:41</span><span class="phone-cam"></span><span class="phone-sig"><i style="height:5px"></i><i style="height:8px"></i><i style="height:11px"></i></span></div>
              <div class="phone-app" aria-hidden="true"><b>Feed</b><span class="phone-tabs"><span>For you</span><span>Following</span></span></div>
              <div class="phone-bars" aria-hidden="true">${f.posts.map(() => '<i></i>').join('')}</div>
              <div class="phone-view"><div class="phone-list">${list}</div></div>
              <div class="phone-start" id="fstart-wrap"${f.started ? ' hidden' : ''}>
                <button type="button" class="play" id="fstart"><span class="play-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span><span class="play-t">Start the feed</span><span class="play-s">${n} posts · about ${Math.round(n * 1.8)} seconds</span></button>
              </div>
            </div>
          </div>
          <div class="feed-ctrl">
            <button type="button" class="btn sm ghost" id="pause" aria-pressed="false">Pause</button>
            <span class="feed-count" id="fcount">Post 1 of ${n}</span>
            <button type="button" class="btn sm" id="fnext">Next post</button>
          </div>
        </div>
        <div class="q-col">
          <div class="feed-wait" id="fwait">${U.icon.lock}<span>The questions unlock when the feed ends.</span></div>
          <section class="qblock" id="qa" aria-labelledby="fqa-t">
            <p class="qnum">Q.A</p>
            <h2 class="qtext" id="fqa-t">What share of Ireland's public drinking water do data centres use?</h2>
            <p class="qhint">Anywhere from 0% to 30%.</p>
            ${U.slider({ id: 'water', min: 0, max: 30, step: 0.1, ticks: [0, 5, 10, 15, 20, 25, 30], fmt: (v) => v + '%', label: "Your guess: data centres' share of Ireland's public drinking water, percent" })}
          </section>
          <section class="qblock" id="qb" aria-labelledby="fqb-t">
            <p class="qnum">Q.B</p>
            <h2 class="qtext" id="fqb-t">Thinking back, were the posts mostly negative, mostly positive, or balanced?</h2>
            <div class="opts" role="group" aria-labelledby="fqb-t">${U.opt('negative', 'Mostly negative')}${U.opt('balanced', 'Balanced')}${U.opt('positive', 'Mostly positive')}</div>
          </section>
          <div class="btnrow"><button type="button" class="btn" id="lock" disabled>Lock in <span class="arr" aria-hidden="true">→</span></button><span class="lockhint" id="lockhint"></span></div>
        </div>
      </div>`
    );

    const listEl = el.querySelector('.phone-list');
    const view = el.querySelector('.phone-view');
    const barsEl = el.querySelector('.phone-bars');
    const bars = [...barsEl.children];
    const postEls = [...listEl.querySelectorAll('.post')];
    const endEl = listEl.querySelector('.feed-end');
    const count = el.querySelector('#fcount');
    const pauseBtn = el.querySelector('#pause');
    const next = el.querySelector('#fnext');
    const qa = el.querySelector('#qa');
    const qb = el.querySelector('#qb');
    const fwait = el.querySelector('#fwait');
    const lock = el.querySelector('#lock');
    const hint = el.querySelector('#lockhint');
    const tones = [...el.querySelectorAll('#qb .opt')];
    const manual = U.reduced();
    if (manual) {
      barsEl.classList.add('manual');
      pauseBtn.hidden = true;
    }
    qa.inert = true;
    qb.inert = true;

    const refresh = () => {
      lock.disabled = !(f.ended && f.guess != null && f.tone);
      hint.textContent = !f.ended ? 'Watch the feed first.' : f.guess == null ? 'Make your guess in Q.A.' : !f.tone ? 'Answer Q.B.' : 'Ready when you are.';
    };

    const place = () => {
      if (!view.clientHeight) return;
      let y;
      if (f.ended) y = Math.max(0, endEl.offsetTop + endEl.offsetHeight - view.clientHeight + 8);
      else y = Math.max(0, postEls[f.idx].offsetTop - 4);
      listEl.style.transform = `translateY(${-y}px)`;
    };
    // Auto-advance runs on a timer (the progress bar is only the visual); pausing keeps the time left.
    const DWELL = 1800;
    let tStart = 0;
    let remaining = DWELL;
    let tmr = null;
    const stopTimer = () => { if (tmr) { clearTimeout(tmr); timers.delete(tmr); tmr = null; } };
    const arm = (ms) => {
      stopTimer();
      if (manual || f.paused || f.ended || !f.started) return;
      tStart = performance.now();
      remaining = ms;
      tmr = later(() => { tmr = null; advance(); }, ms);
    };
    const show = (i) => {
      f.idx = i;
      bars.forEach((b, j) => {
        b.classList.toggle('done', j < i || f.ended);
        b.classList.remove('now');
      });
      postEls.forEach((p, j) => p.classList.toggle('dim', f.ended || j < i));
      count.textContent = f.ended ? 'End of feed' : `Post ${i + 1} of ${n}`;
      if (!f.ended) {
        void bars[i].offsetWidth; // restart the progress animation
        bars[i].classList.add('now');
        arm(DWELL);
        const c = CLAIMS[f.posts[i].id];
        if (f.started) announce(`Post ${i + 1} of ${n}. ${c.outlet}: ${c.claim}`);
      }
      place();
    };
    const unlock = (fromPlay) => {
      qa.inert = false;
      qb.inert = false;
      fwait.innerHTML = `${U.icon.done}<span>Feed finished. Answer from memory: no scrolling back.</span>`;
      pauseBtn.disabled = true;
      next.disabled = true;
      refresh();
      if (fromPlay) {
        announce('The feed has ended. The questions are unlocked.');
        el.querySelector('#water').focus({ preventScroll: true });
        const r = qa.getBoundingClientRect();
        if (r.top > window.innerHeight - 120) qa.scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'start' });
      }
    };
    const advance = () => {
      if (f.ended) return;
      if (f.idx >= n - 1) {
        f.ended = true;
        show(f.idx);
        unlock(true);
        return;
      }
      show(f.idx + 1);
    };
    pauseBtn.addEventListener('click', () => {
      f.paused = !f.paused;
      if (f.paused) { remaining = Math.max(200, remaining - (performance.now() - tStart)); stopTimer(); }
      else arm(remaining);
      barsEl.classList.toggle('paused', f.paused);
      pauseBtn.textContent = f.paused ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', String(f.paused));
    });
    next.addEventListener('click', advance);

    const slider = U.bindSlider(el, 'water', (v) => v.toFixed(1) + '%', (v) => { f.guess = Math.round(v * 10) / 10; refresh(); });
    tones.forEach((b) => b.addEventListener('click', () => { pressOne(tones, b); f.tone = b.dataset.v; refresh(); }));
    lock.addEventListener('click', () => { if (lock.disabled) return; lock.disabled = true; go('feed-debrief', 'flip'); });

    // restore
    if (f.paused) {
      barsEl.classList.add('paused');
      pauseBtn.textContent = 'Play';
      pauseBtn.setAttribute('aria-pressed', 'true');
    }
    if (f.guess != null && slider) slider.set(f.guess);
    if (f.tone) pressOne(tones, tones.find((t) => t.dataset.v === f.tone));
    refresh();

    const startWrap = el.querySelector('#fstart-wrap');
    const phoneCol = el.querySelector('.phone-col');
    const setIdle = (idle) => {
      pauseBtn.disabled = idle || f.ended;
      next.disabled = idle || f.ended;
      if (idle) count.textContent = `${n} posts waiting`;
    };
    el.querySelector('#fstart').addEventListener('click', () => {
      f.started = true;
      startWrap.hidden = true;
      setIdle(false);
      phoneCol.scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'center' });
      show(0);
      next.focus({ preventScroll: true });
      announce(manual ? 'Feed started. Use the Next post button to move through it.' : 'Feed started. Posts move on by themselves; use Pause if you need more time.');
    });

    el._mount = () => {
      if (f.started) show(f.idx);
      else { setIdle(true); postEls.forEach((p) => p.classList.add('dim')); }
      if (f.ended) unlock(false);
      window.addEventListener('resize', place, { passive: true });
      leaves.push(() => window.removeEventListener('resize', place));
    };
    return el;
  }

  function sourceShort(label) { return String(label).replace(/\s*\(.*\)\s*$/, ''); }

  function renderFeedDebrief() {
    const f = state.feed;
    const g = f.guess;
    const truth = WATER.pct;
    const r = feedResult();
    const nA = r.alarm;
    const nT = r.total;
    const accurate = f.posts.filter((p) => p.alarm && /supported/.test(CLAIMS[p.id].verdict) && CLAIMS[p.id].verdict !== 'unsupported').length;

    const boost = feedBoost();
    const tiles = f.posts
      .map((p, i) => {
        const c = CLAIMS[p.id];
        return `<div class="tile${p.alarm ? ' alarm ringed' : ''}" style="--i:${i}"><span class="tile-n">#${i + 1}</span><div class="tile-h">${U.avatar(c.outlet)}<b>${esc(c.outlet)}</b></div><div class="tile-f"><span class="tile-tag">${p.alarm ? 'Alarming' : 'Reassuring'}</span><span class="tile-likes">${U.icon.heart}<span class="sr-only">Likes: </span>${U.k(p.eng.likes)}</span></div></div>`;
      })
      .join('');
    const boostBits = [
      boost.likesX && boost.likesX >= 2 ? `about ${boost.likesX}× the likes` : '',
      boost.allTrendAlarm ? 'every “Trending” tag' : '',
      boost.picAlarm ? 'the only picture' : '',
    ].filter(Boolean);
    const boostLine = boostBits.length
      ? `Alarming posts also got ${boostBits.length > 1 ? boostBits.slice(0, -1).join(', ') + ' and ' + boostBits[boostBits.length - 1] : boostBits[0]}.`
      : '';

    const toneLine = {
      negative: r.fell
        ? `You spotted the tilt – and your guess still came out far above the real figure.`
        : `You spotted the tilt, and your guess stayed close to reality. Impressive.`,
      balanced: `It wasn't: ${nA} alarming posts to ${nT - nA} reassuring ones. A lopsided feed feels normal when every post looks like news.`,
      positive: `It was the opposite: ${nA} alarming posts, ${nT - nA} reassuring. Interesting. Very interesting.`,
    }[f.tone];
    const toneWord = { negative: 'mostly negative', balanced: 'balanced', positive: 'mostly positive' }[f.tone];

    const ratioLine =
      g <= truth
        ? { icon: U.icon.equal, t: `Right in the zone. The vivid number didn't get you.` }
        : r.ratio >= 2
          ? { icon: U.icon.arrowUp, t: `Your guess was <b>more than ${Math.floor(r.ratio + 1e-9)} times</b> the real share.` }
          : { icon: U.icon.arrowUp, t: `Your guess was a little above the real share – close.` };

    // claims checked (every post the player saw, with its source)
    const claimList = f.posts
      .map((p) => {
        const c = CLAIMS[p.id];
        const v = VERDICT[c.verdict] || [c.verdict, 'meh'];
        return `<li>${U.avatar(c.outlet)}<div>
          <div class="c-meta"><span>${esc(c.outlet)} · ${esc(c.date)}</span><span>${p.alarm ? 'Alarming' : 'Reassuring'}</span><span class="c-v ${v[1]}">${esc(v[0])}</span></div>
          <p class="c-t"><span class="src-k">Claim, paraphrased</span> ${esc(c.claim)}</p>
          <p class="c-miss">Left out: ${esc(dash(c.missing))}</p>
          ${U.src(c.outlet, c.url)}
        </div></li>`;
      })
      .join('');

    // cross-tab: where people formed their view x "what I've seen was mostly negative"
    let xt = '';
    if (U.hasQ('q16') && U.hasQ('q57') && S.crosstab('q16', 'q57')) {
      const picks = [/^Social media/, /^Online news/, /^National news/, /^Academic/];
      // cross-tab cells carry labels, not values, so match the q57 agree options by label
      const agreeLabels = S.q('q57').options.filter(S.predicates.isAgree).map((o) => o.label);
      const rows = picks
        .map((re) => S.q('q16').options.find((o) => re.test(o.label)))
        .filter(Boolean)
        .map((o) => {
          const res = S.within('q16', o.label, 'q57', agreeLabels);
          const grp = S.crosstab('q16', 'q57').find((row) => row.label === o.label);
          return { label: sourceShort(o.short || o.label), res, n: grp ? grp.n : null };
        });
      const known = rows.filter((x) => x.res);
      const hi = known.slice().sort((a, b) => b.res.pct - a.res.pct)[0];
      const lo = known.slice().sort((a, b) => a.res.pct - b.res.pct)[0];
      xt = `<h2>Where people formed their view vs how negative their news felt</h2>
        <p>Share who agreed that what they've encountered about data centres “has mostly been negative” (q57), split by where they said they formed their view (q16).</p>
        <div class="xt">${rows
          .map((x) => {
            const small = x.n != null && x.n < 30 ? `<span class="caveat">small group (n = ${x.n})</span>` : '';
            return `<div class="xt-row"><span class="xt-lab">${esc(x.label)}<small>n = ${x.n == null ? 'too few people' : x.n}${small}</small></span>
              <span class="xt-bar" aria-hidden="true"><i style="width:${x.res ? x.res.pct.toFixed(1) : 0}%"></i></span>
              ${x.res ? `<span class="xt-v">${fmt(x.res.pct)}</span>` : '<span class="xt-v na">too few people</span>'}</div>`;
          })
          .join('')}</div>
        ${hi && lo && hi !== lo ? `<p class="small">In this survey, people who got their view from <b>${esc(hi.label.toLowerCase())}</b> were the most likely to call it mostly negative (${fmt(hi.res.pct)}); <b>${esc(lo.label.toLowerCase())}</b> the least (${fmt(lo.res.pct)}). With groups this small, gaps like this can be chance.</p>` : ''}
        <p class="who">People could pick more than one source, so the groups overlap. This is a link, not proof of cause. ${esc(U.who())}.</p>`;
    }

    const has55 = U.hasQ('q55');
    const has57 = U.hasQ('q57');
    const mirror = has55 || has57
      ? `<p class="mirror-lede">In the survey, <b>${has55 ? fmt(U.ag('q55')) : '–'}</b> agreed news stories about data centres' energy use had strongly shaped their views, and <b>${has57 ? fmt(U.ag('q57')) : '–'}</b> that what they'd encountered was mostly negative.</p>${U.agreeBar('q55')}${U.agreeBar('q57')}<p class="who">${esc(U.who())}.</p>`
      : '';

    const litres = WATER.litres || 'Hundreds of millions of litres';
    const el = sheet(
      { left: head('02', 'Availability'), right: '<span class="copy">Researcher\'s copy</span>', debrief: true },
      `<div class="d-top">
        <div class="rig-visual"><div class="tiles">${tiles}</div></div>
        <div>
          <p class="kicker">Debrief · Experiment 02</p>
          <h1 class="title" tabindex="-1">The feed</h1>
          <p class="pen lg">${nA} of the ${nT} posts were picked to be alarming.</p>
          ${boostLine ? `<p class="pen boost">${boostLine}</p>` : ''}
          <p class="lede">The likes and shares were invented, and boosted like a feed algorithm would. But ${accurate} of the ${nA} alarming posts were accurate. The rig didn't need to lie. It only had to choose, and amplify.</p>
        </div>
      </div>
      ${dsec('A', 'What you did', 'assume', `<p class="said">You guessed data centres use <b class="hl swipe">${g.toFixed(1)}%</b> of Ireland's public drinking water, and called the feed <b>${toneWord}</b>.</p><p>${toneLine}</p>`)}
      ${dsec('B', 'The truth', 'data', `
        <div class="bigfact"><span class="bignum data">&lt;&thinsp;${truth}%</span><p>Data centres on the public network use under ${truth}% of the drinking water Uisce Éireann supplies.</p></div>
        ${U.src(WATER.source, WATER.url)}
        ${U.numberLine({
          min: 0, max: 30, ticks: [0, 5, 10, 15, 20, 25, 30], fmt: (v) => v + '%',
          marks: [
            { kind: 'you', v: g, label: `You ${g.toFixed(1)}%` },
            { kind: 'truth', v: truth, label: `Truth: under ${truth}%` },
          ],
          label: `Number line from 0 to 30%. Your guess: ${g.toFixed(1)}%. The truth: under ${truth}%.`,
        })}
        <p class="verdict">${ratioLine.icon}<span>${ratioLine.t}</span></p>
        <h2 style="margin-top:26px">Both water numbers are true</h2>
        <div class="two-truths">
          <div class="truth-card vivid"><span class="tc-k">True · vivid</span><span class="tc-v">${esc(litres)}</span><p class="tc-t">in one month${WATER.month ? ` (${esc(WATER.month)}), when use nearly doubled in dry weather` : ''}.</p></div>
          <div class="truth-card"><span class="tc-k">True · boring</span><span class="tc-v">Under ${truth}%</span><p class="tc-t">of the public drinking water supply.</p></div>
        </div>
        <p class="pen">The vivid one sticks.</p>`)}
      ${dsec('C', 'The posts, checked', 'data', `<p>Each post was a paraphrased claim from a real outlet, checked against the best evidence we could find.</p><ul class="claims">${claimList}</ul>`)}
      ${xt ? dsec('D', 'Where people get their view', 'opinion', xt) : ''}
      ${mirror ? dsec(xt ? 'E' : 'D', 'How they see themselves and their news', 'opinion', mirror) : ''}
      ${reassure('<b>Falling for it is normal.</b> Vivid, recent, emotional examples come to mind first, and what comes to mind easily feels common. That\'s the availability heuristic, and it\'s why this effect is famous.')}
      ${nextBtn(`Next: ${NAMES[nextOf('feed')]}`)}`
    );
    el.querySelector('#next').addEventListener('click', () => go(nextOf('feed')));
    el._mount = () => stampIt(el);
    return el;
  }

  /* ======================================================================
     EXPERIMENT 03 - THE CROWD (social proof)
     ====================================================================== */
  function livePanel(c, live) {
    const toLeft = c.side === 'unacceptable';
    return `<section class="live" aria-label="Live results from other players">
      <div class="live-h"><span class="lv"><span class="live-dot${live ? ' on' : ''}"></span>Live</span><span>What other players said</span></div>
      <p class="live-q">Would a sustainable data centre within 5 km of home be acceptable?</p>
      <div class="live-big"><span class="live-num">${live ? '0' : FAKE_CROWD}%</span><span class="live-said">said it would be <em>${c.side}</em></span></div>
      <div class="live-bar ${toLeft ? 'left' : 'right'}"><span style="width:${live ? 0 : FAKE_CROWD}%"></span></div>
      <div class="live-legend"><span>← Unacceptable</span><span>Acceptable →</span></div>
      ${live ? '<div class="feed-list-mini" aria-hidden="true"></div>' : ''}
      <div class="live-f"><span><b class="live-count">${c.players.toLocaleString('en-GB')}</b> players so far</span><span>${live ? 'Updated just now' : 'Updated never'}</span></div>
    </section>`;
  }

  function animateLive(root, c) {
    const num = root.querySelector('.live-num');
    const bar = root.querySelector('.live-bar span');
    const cnt = root.querySelector('.live-count');
    const mini = root.querySelector('.feed-list-mini');
    if (U.reduced() || DEBUG) {
      num.textContent = FAKE_CROWD + '%';
      bar.style.width = FAKE_CROWD + '%';
    } else {
      later(() => { bar.style.width = FAKE_CROWD + '%'; }, 40);
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 1600);
        num.textContent = Math.round(FAKE_CROWD * (1 - Math.pow(1 - k, 3))) + '%';
        if (k < 1 && num.isConnected) later(step, 32);
      };
      later(step, 32);
    }
    const tick = () => {
      c.players += U.randInt(1, 3);
      cnt.textContent = c.players.toLocaleString('en-GB');
      later(tick, U.randInt(700, 1600));
    };
    later(tick, 900);
    // a few "recent answers", leaning the same way as the fake crowd
    if (mini && U.hasQ('q77')) {
      const opts = S.q('q77').options;
      const lean = c.side === 'unacceptable' ? [0, 0, 1, 1, 1, 2] : [4, 4, 3, 3, 3, 2];
      let k = 0;
      const add = () => {
        if (k >= 3) return;
        const o = opts[lean[U.randInt(0, lean.length - 1)]];
        const row = U.el(`<div class="tick-row"><span>Player #${String(U.randInt(1000, 9999))}</span><b>${esc(o.short || o.label)}</b></div>`);
        mini.prepend(row);
        void row.offsetWidth;
        row.classList.add('in');
        k++;
        later(add, U.randInt(1100, 1700));
      };
      later(add, 700);
    }
  }

  function renderCrowd() {
    const c = state.crowd;
    const q = S.q('q77');
    const el = sheet(
      { left: head('03', 'Social proof'), right: 'Protocol sheet' },
      `<div class="intro-row"><div><p class="kicker">Experiment 03</p><h1 class="title" tabindex="-1">The crowd</h1></div>
      <p class="lede">One question, straight from the real survey. Before you answer, here's how other players answered it.</p></div>
      <div class="cols">
        <div>${livePanel(c, true)}</div>
        <div class="q-col">
          <section class="qblock" aria-labelledby="cq-t">
            <p class="qnum">Q.A · from the survey</p>
            <h2 class="qtext" id="cq-t">${esc(q.text)}</h2>
            <div class="opts" role="group" aria-labelledby="cq-t">${q.options.map((o) => U.opt(o.value, o.short || o.label)).join('')}</div>
          </section>
          <div class="btnrow"><button type="button" class="btn" id="lock" disabled>Lock in <span class="arr" aria-hidden="true">→</span></button><span class="lockhint" id="lockhint">Pick one answer.</span></div>
        </div>
      </div>`
    );
    const opts = [...el.querySelectorAll('.opt')];
    const lock = el.querySelector('#lock');
    const hint = el.querySelector('#lockhint');
    const refresh = () => {
      lock.disabled = c.first == null;
      hint.textContent = c.first == null ? 'Pick one answer.' : 'Ready when you are.';
    };
    opts.forEach((b) => b.addEventListener('click', () => { pressOne(opts, b); c.first = +b.dataset.v; refresh(); }));
    lock.addEventListener('click', () => { if (lock.disabled) return; lock.disabled = true; go('crowd-debrief', 'flip'); });
    if (c.first != null) pressOne(opts, opts.find((o) => +o.dataset.v === c.first));
    refresh();
    el._mount = () => animateLive(el, c);
    return el;
  }

  function crowdLater() {
    const c = state.crowd;
    const q = S.q('q77');
    const opts = q.options;
    const r = crowdResult();
    const idx = (v) => opts.findIndex((o) => o.value === v);
    const label = (v) => (opts[idx(v)] ? opts[idx(v)].short || opts[idx(v)].label : '');
    const steps = Math.abs(r.pull);
    const stepWord = `${WORD[steps] || steps} step${steps === 1 ? '' : 's'}`;
    const msg =
      r.pull > 0 ? { pen: 'You moved towards the fake crowd.', t: `With the fake crowd watching, you answered <b>${stepWord} closer to it</b> than you did alone.` }
        : r.pull === 0 ? { pen: "You didn't move – nice.", t: 'Same answer both times. The crowd did not move you.' }
          : { pen: 'You pushed back.', t: `With the crowd watching, you answered ${stepWord} further from it than you did alone. Pushing back against a crowd is still reacting to it.` };

    const dots = opts
      .map((o) => {
        const a = o.value === c.first;
        const b = o.value === c.second;
        return `<span class="shift-dot${a ? ' is-a' : ''}${b ? ' is-b' : ''}">${a ? '<span class="shift-pin a">With crowd</span>' : ''}${b ? '<span class="shift-pin b lower">Alone</span>' : ''}</span>`;
      })
      .join('');
    const crowdSide = c.side === 'unacceptable' ? 'l' : 'r';
    // Arrow shows which way your answer moved alone -> with crowd: towards the crowd's side, or away from it.
    const towardsLeft = (crowdSide === 'l') === (r.pull > 0);
    const verdictIcon = r.pull === 0 ? U.icon.equal : towardsLeft ? U.icon.arrowLeft : U.icon.arrowRight;
    const shift = `<div class="shift" role="img" aria-label="${esc(`With the crowd you answered ${label(c.first)}. Alone you answered ${label(c.second)}.`)}">
        <div class="shift-scale"><span class="shift-crowd ${crowdSide}">${crowdSide === 'l' ? '← fake crowd' : 'fake crowd →'}</span>${dots}</div>
        <div class="shift-ends"><span>${esc(opts[0].short || opts[0].label)}</span><span>${esc(opts[opts.length - 1].short || opts[opts.length - 1].label)}</span></div>
      </div>`;

    const unacc = U.share('q77', (o) => o.value <= 2);
    const neither = U.share('q77', (o) => o.value === 3);
    const acc = U.share('q77', (o) => o.value >= 4);
    const has59 = U.hasQ('q59');
    const has61 = U.hasQ('q61');
    const mirror = has59 || has61
      ? `<p class="mirror-lede">In the survey, <b>${has59 ? fmt(U.ag('q59')) : '–'}</b> agreed they'd oppose a data centre if their local community did, and <b>${has61 ? fmt(U.ag('q61')) : '–'}</b> that public protests had influenced their views.</p>${U.agreeBar('q59')}${U.agreeBar('q61')}<p class="who">${esc(U.who())}.</p>`
      : '';

    return `
      ${dsec('B', 'Did the crowd move you?', 'assume', `
        <p class="said">With the crowd: <b>${esc(label(c.first))}</b>. Alone: <b class="hl swipe">${esc(label(c.second))}</b>.</p>
        ${shift}
        <p class="verdict">${verdictIcon}<span>${msg.t}</span></p>
        <p class="pen sm aside">${msg.pen}</p>
        <p class="small muted">One pair of answers isn't proof. It's a small, honest measurement of you, today.</p>`)}
      ${dsec('C', 'What respondents actually said', 'opinion', `
        <div class="db-cap"><strong>${esc(q.text)}</strong></div>
        ${U.distBar({ rows: U.surveyRows('q77'), you: idx(c.second), youText: 'You', aria: `Survey answers to q77. ${U.surveyRows('q77').map((row) => `${row.label} ${fmt(row.pct)}`).join(', ')}.` })}
        <p class="said" style="margin-top:14px">The real split: <b>${fmt(unacc)}</b> unacceptable, <b>${fmt(neither)}</b> neither, <b>${fmt(acc)}</b> acceptable.${Math.max(unacc, acc) < 60 ? ` Nowhere near ${FAKE_CROWD}% either way.` : ''}</p>
        <p class="who">${esc(U.who())} · n = ${q.n_answered} answered this question.</p>`)}
      ${mirror ? dsec('D', 'How they see themselves', 'opinion', mirror) : ''}
      ${reassure('<b>Falling for it is normal.</b> Following the crowd is often a sensible shortcut when the crowd is real. Here it was one line of code.')}
      ${nextBtn('See your lab report')}`;
  }

  function renderCrowdDebrief() {
    const c = state.crowd;
    const q = S.q('q77');
    const el = sheet(
      { left: head('03', 'Social proof'), right: '<span class="copy">Researcher\'s copy</span>', debrief: true },
      `<div class="d-top">
        <div class="rig-visual"><div class="fake-live ringed">${livePanel(c, false)}
          <svg class="scribble" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M6 12 C30 30 60 58 95 90"/><path vector-effect="non-scaling-stroke" d="M94 10 C70 34 40 62 5 92"/></svg></div></div>
        <div>
          <p class="kicker">Debrief · Experiment 03</p>
          <h1 class="title" tabindex="-1">The crowd</h1>
          <p class="pen lg">There were no other players. That bar was made up.</p>
          <p class="lede">The game tosses a coin: half of players see “${FAKE_CROWD}% unacceptable”, half see “${FAKE_CROWD}% acceptable”. You got <b>${c.side}</b>. The player counter was a timer.</p>
        </div>
      </div>
      ${dsec('A', 'Answer again', 'assume', `
        <div class="reask">
          <p class="qnum">Answer again – no crowd this time</p>
          <h2 class="qtext" id="re-t">${esc(q.text)}</h2>
          <div class="opts" role="group" aria-labelledby="re-t">${q.options.map((o) => U.opt(o.value, o.short || o.label)).join('')}</div>
          <div class="btnrow" style="margin-top:16px"><button type="button" class="btn" id="relock" disabled>Lock in second answer <span class="arr" aria-hidden="true">→</span></button></div>
        </div>`)}
      <div class="reveal-later" id="later"${c.second == null ? ' hidden' : ''}>${c.second != null ? crowdLater() : ''}</div>`
    );
    const opts = [...el.querySelectorAll('.reask .opt')];
    const relock = el.querySelector('#relock');
    const laterEl = el.querySelector('#later');
    let pick = c.second;
    const wireNext = () => {
      const nb = el.querySelector('#next');
      if (nb) nb.addEventListener('click', () => go('finale'));
    };
    opts.forEach((b) => b.addEventListener('click', () => { pressOne(opts, b); pick = +b.dataset.v; relock.disabled = false; }));
    relock.addEventListener('click', () => {
      if (pick == null || relock.disabled || c.second != null) return;
      relock.disabled = true;
      c.second = pick;
      laterEl.innerHTML = crowdLater();
      laterEl.hidden = false;
      laterEl.classList.add('reveal');
      wireNext();
      relock.disabled = true;
      relock.innerHTML = 'Locked in';
      opts.forEach((o) => { o.disabled = true; });
      const h = laterEl.querySelector('.dsec');
      if (h) {
        h.setAttribute('tabindex', '-1');
        h.focus({ preventScroll: true });
        h.scrollIntoView({ behavior: U.reduced() ? 'auto' : 'smooth', block: 'start' });
      }
      announce('Second answer locked in. Your comparison is below.');
    });
    if (c.second != null) {
      pressOne(opts, opts.find((o) => +o.dataset.v === c.second));
      opts.forEach((o) => { o.disabled = true; });
      relock.innerHTML = 'Locked in';
      wireNext();
    }
    el._mount = () => stampIt(el);
    return el;
  }

  /* ======================================================================
     FINALE - the blind spot (lab report)
     ====================================================================== */
  const SHORT = {
    q62: 'My first impression has stayed with me',
    q65: 'I trust the first source I come across',
    q55: 'News stories have strongly shaped my views',
    q57: "What I've seen has mostly been negative",
    q59: 'If my community opposed one, I would too',
    q61: 'Protests have influenced my views',
  };
  // Statements where respondents rated their OWN susceptibility (q57 is about their news, so it is left out).
  const SELF_IDS = ['q62', 'q65', 'q55', 'q59', 'q61'];
  function miniAB(id, note = '') {
    if (!U.hasQ(id)) return '';
    const a = U.ag(id);
    const n = U.neu(id);
    const d = U.dis(id);
    return `<div class="mini-ab"><div class="s"><i>${esc(SHORT[id])}</i> <span class="muted mono qid">${id}</span>${note ? `<span class="mini-note">${note}</span>` : ''}</div>
      <div class="t" role="img" aria-label="${esc(`${SHORT[id]}: ${fmt(a)} agree, ${fmt(d)} disagree`)}"><i style="width:${d.toFixed(1)}%;background:#3B2E58"></i><i style="width:${n.toFixed(1)}%;background:#E3DDEB"></i><i style="width:${a.toFixed(1)}%;background:#7A3DB8"></i></div>
      <div class="n"><b>${fmt(a)} agree</b> · ${fmt(d)} disagree</div></div>`;
  }
  const markHTML = (fell, fellText, heldText) =>
    fell ? `<span class="mark fell">${U.icon.penCross}${fellText}</span>` : `<span class="mark held">${U.icon.penCheck}${heldText}</span>`;
  const dataLine = (html) => `<span class="m-data"><span class="dtag">Data</span>${html}</span>`;

  function renderFinale() {
    const w = state.wheel;
    const f = state.feed;
    const c = state.crowd;
    const wr = wheelResult();
    const fr = feedResult();
    const cr = crowdResult();
    const rows = [];
    const said = []; // one "said vs did" card per experiment
    if (wr) {
      const wheelMark = wr.pulled ? 'Leaned towards the anchor' : wr.close && wr.diff !== 0 ? 'Close to the truth' : 'Held firm';
      rows.push(`<tr>
        <td data-h="Experiment"><span class="exp-n">01</span><span class="exp-name">The wheel</span><span class="exp-bias">Anchoring</span></td>
        <td data-h="What was rigged">The wheel only lands on ${rigRanges()}. You got <b>${w.anchor}</b> (${w.anchorType}).</td>
        <td data-h="What you did"><div class="measure">Estimate <b class="hl">${w.guess}%</b><br>${dataLine(`Truth ${CSO.pct}% (CSO, ${CSO.year})`)}${wr.diff === 0 ? 'Exactly right' : `${Math.abs(wr.diff)} pts ${wr.diff > 0 ? 'above' : 'below'} · ${wr.close ? 'close' : wr.anchorSide ? 'anchor side' : 'far side'}`}</div>${markHTML(wr.pulled, wheelMark, wheelMark)}</td>
        <td data-h="What respondents said about themselves">${miniAB('q62')}${miniAB('q65')}</td>
      </tr>`);
      said.push({ n: '01', bias: 'Anchoring', id: 'q62', fell: wr.pulled, did: wr.pulled ? 'Leaned towards the anchor' : wheelMark });
    }
    if (fr) {
      rows.push(`<tr>
        <td data-h="Experiment"><span class="exp-n">02</span><span class="exp-name">The feed</span><span class="exp-bias">Availability</span></td>
        <td data-h="What was rigged">${fr.alarm} of ${fr.total} posts picked to be alarming, and those got the big likes. All engagement invented.</td>
        <td data-h="What you did"><div class="measure">Water guess <b class="hl">${f.guess.toFixed(1)}%</b><br>${dataLine(`Truth under ${WATER.pct}%`)}Feed felt: ${{ negative: 'mostly negative', balanced: 'balanced', positive: 'mostly positive' }[f.tone]}</div>${markHTML(fr.fell, 'Way above the real share', 'Kept it in proportion')}</td>
        <td data-h="What respondents said about themselves">${miniAB('q55')}${miniAB('q57', 'About their news, not themselves: not in the headline count')}</td>
      </tr>`);
      said.push({ n: '02', bias: 'Availability', id: 'q55', fell: fr.fell, did: fr.fell ? 'Way above the real share' : 'Kept it in proportion' });
    }
    if (cr) {
      const opts = S.q('q77').options;
      const lab = (v) => { const o = opts.find((x) => x.value === v); return o ? o.short || o.label : ''; };
      const crowdMark = cr.fell ? 'Moved with the crowd' : cr.pull < 0 ? 'Pushed back' : 'Held firm';
      rows.push(`<tr>
        <td data-h="Experiment"><span class="exp-n">03</span><span class="exp-name">The crowd</span><span class="exp-bias">Social proof</span></td>
        <td data-h="What was rigged">A fake “live” bar: ${FAKE_CROWD}% said ${c.side}. There were no other players.</td>
        <td data-h="What you did"><div class="measure">With crowd: <b>${esc(lab(c.first))}</b><br>Alone: <b class="hl">${esc(lab(c.second))}</b><br>${cr.pull === 0 ? 'No shift' : `${Math.abs(cr.pull)} step${Math.abs(cr.pull) === 1 ? '' : 's'} ${cr.pull > 0 ? 'towards' : 'away from'} the crowd`}</div>${markHTML(cr.fell, crowdMark, crowdMark)}</td>
        <td data-h="What respondents said about themselves">${miniAB('q59')}${miniAB('q61')}</td>
      </tr>`);
      said.push({ n: '03', bias: 'Social proof', id: 'q59', fell: cr.fell, did: crowdMark });
    }
    const fellN = [wr && wr.pulled, fr && fr.fell, cr && cr.fell].filter(Boolean).length;
    const total = rows.length;

    // headline, computed from the survey: only the statements that are self-ratings
    const mids = SELF_IDS.filter(U.hasQ);
    const more = mids.filter((id) => U.dis(id) > U.ag(id)).length;
    const headline = !mids.length ? ''
      : more === mids.length
        ? `On all ${mids.length} statements where survey respondents rated their own susceptibility, more said “not me” than “me”.`
        : `On ${more} of ${mids.length} statements where survey respondents rated their own susceptibility, more said “not me” than “me”.`;

    // said vs did: one survey self-rating per experiment next to what this player did
    const svd = said.filter((s) => U.hasQ(s.id));
    const svdHTML = svd.length
      ? `<div class="svd" role="list">${svd
        .map((s, i) => `<div class="svd-card" role="listitem" style="--i:${i}">
          <p class="svd-k"><span>${s.n}</span>${s.bias}</p>
          <div class="svd-said"><span class="svd-lab">They said ${U.chip('opinion')}</span><span class="svd-num">${fmt(U.ag(s.id))}</span><span class="svd-t">agreed <i>${esc(SHORT[s.id])}</i> <span class="mono qid">${s.id}</span></span></div>
          <div class="svd-did"><span class="svd-lab">You did ${U.chip('assume')}</span>${markHTML(s.fell, s.did, s.did)}</div>
        </div>`)
        .join('')}</div>`
      : '';

    const g = state.gut;
    const q66 = U.hasQ('q66') ? S.q('q66') : null;
    let letter = 0;
    const nextLetter = () => 'ABCDEF'[letter++];
    const gutBlock = q66
      ? dsec(nextLetter(), 'Gut check', 'opinion', `
          <h2>One last question from the survey.</h2>
          <p class="qtext" id="gut-t" style="max-width:40ch">${esc(q66.text)}</p>
          <div class="opts" role="group" aria-labelledby="gut-t">${q66.options.map((o) => U.opt(o.value, o.short || o.label)).join('')}</div>
          <div id="gut-res" aria-live="polite"></div>`, 'gut')
      : '';
    const byeLetter = nextLetter();
    const srcLetter = nextLetter();

    const sources = [
      { t: `${S.meta.title}. ${S.meta.source}. ${S.n} respondents; aggregate results only.` },
      wr && { t: CSO.source, url: CSO.url },
      fr && { t: `${WATER.source}: data-centre water use`, url: WATER.url },
      ...(fr ? f.posts.map((p) => { const cl = CLAIMS[p.id]; return { t: `${cl.outlet}, ${cl.date} – paraphrased claim: ${cl.claim}`, url: cl.url }; }) : []),
      wr && { t: 'Tversky, A. & Kahneman, D. (1974). Judgment under uncertainty: heuristics and biases. Science, 185(4157), 1124–1131.', url: 'https://doi.org/10.1126/science.185.4157.1124' },
      { t: 'Pronin, E., Lin, D. Y. & Ross, L. (2002). The bias blind spot: perceptions of bias in self versus others. Personality and Social Psychology Bulletin, 28(3), 369–381.', url: 'https://doi.org/10.1177/0146167202286008' },
    ].filter(Boolean);

    const el = sheet(
      { left: `<b>Lab report</b> · Results sheet · Participant #${state.pid}`, right: '<span class="copy">Researcher\'s copy</span>', debrief: true, stamp: false, cls: 'finale' },
      `<div class="report-head">
        <div>
          <p class="kicker">Finale · Lab report</p>
          <h1 class="title" tabindex="-1">The blind spot</h1>
        </div>
        <div class="tally ringed" style="--i:0"><p class="pen">Leaned the rigged way</p><span class="tally-n">${fellN} of ${total}</span><span class="tally-cap">one run · no control group</span></div>
      </div>
      ${headline ? `<p class="headline">${headline}</p>` : ''}
      ${svdHTML}
      <p class="headline-sub">${U.hasQ('q62') ? `<b>${fmt(U.dis('q62'))}</b> disagreed that their first impression of data centres had stuck. ` : ''}That pattern fits what psychologists call the <em>bias blind spot</em>: we spot bias in others more easily than in ourselves (Pronin, Lin &amp; Ross, 2002). Your answers leaned the way the rig pushed in <b>${fellN} of ${total}</b> experiments (one run, no control group). That doesn't prove the respondents are wrong about themselves – a survey answer is an opinion, not a measurement. That's why labs measure what people do.</p>
      <table class="report">
        <thead><tr><th>Experiment</th><th>What was rigged</th><th>What you did<br>${U.chip('assume')}</th><th>What respondents said about themselves<br>${U.chip('opinion')}</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p class="who">Right-hand column: ${esc(U.who())}. Bars show disagree · neither · agree.</p>
      <details class="how">
        <summary>How this is measured</summary>
        <div class="how-b">
          ${wr ? `<p><b>Anchoring:</b> “leaned” if your estimate landed on the same side of the true ${CSO.pct}% as your anchor, and at least ${CLOSE_PTS + 1} points away from it. Within ${CLOSE_PTS} points counts as close to the truth.</p>` : ''}
          ${fr ? `<p><b>Availability:</b> “way above” if your water guess was more than three times the real share (under ${WATER.pct}%). That bar is low on purpose; the debrief shows how far above it you went.</p>` : ''}
          ${cr ? '<p><b>Social proof:</b> “moved” if your answer with the fake crowd was closer to the crowd than your answer alone.</p>' : ''}
          <p>This is a toy measurement: one person, one run, no control group, so any single “lean” could also be chance. The right-hand column is what survey respondents said about themselves (${mids.join(', ')})${U.hasQ('q57') && fr ? ' and about their news (q57)' : ''}, not a measurement of their behaviour. The headline counts only the ${mids.length} self-ratings.</p>
        </div>
      </details>
      ${gutBlock}
      ${dsec(byeLetter, 'Before you go', '', `
        <p class="ethics">${ETHICS}</p>
        <div class="btnrow end-actions"><button type="button" class="btn" id="again">Play again <span class="arr" aria-hidden="true">↻</span></button><a class="btn ghost" href="index.html">Back to all games</a></div>`)}
      ${dsec(srcLetter, 'Sources', 'data', `<ol class="sources">${sources.map((s) => `<li><span><span class="s-t">${esc(s.t)}</span>${s.url ? U.src(new URL(s.url).hostname.replace(/^www\./, ''), s.url) : ''}</span></li>`).join('')}</ol>
        ${fr ? '<p class="who">Feed posts were paraphrased claims attributed to their outlets, not real posts or headlines. Likes and shares were invented.</p>' : ''}`, 'sources')}`
    );

    // gut check
    const gutRes = el.querySelector('#gut-res');
    const gutOpts = [...el.querySelectorAll('#gut .opt')];
    const showGut = (v) => {
      if (!q66) return;
      const you = q66.options.findIndex((o) => o.value === v);
      const dev = deviceGut();
      const n = dev.length;
      const devRows = q66.options.map((o) => {
        const k = dev.filter((x) => x === o.value).length;
        return { label: o.short || o.label, pct: n ? (100 * k) / n : 0, count: k };
      });
      const notSaving = storageFailed && !DEBUG;
      gutRes.innerHTML = `<div class="gut-cols reveal">
        <div><h3>Survey respondents ${U.chip('opinion')}</h3>
          ${U.distBar({ rows: U.surveyRows('q66'), you, youText: 'You', aria: `Survey answers to q66: ${U.surveyRows('q66').map((r) => `${r.label} ${fmt(r.pct)}`).join(', ')}.` })}
          <p class="who">${esc(U.who())} · n = ${q66.n_answered} answered.</p></div>
        <div><h3>Players on this device ${U.chip('opinion')}</h3>
          ${notSaving ? `<p class="who">${NOT_SAVING}</p>`
            : `${n ? U.distBar({ rows: devRows, you, youText: 'You', tone: 'assume', aria: `Answers saved on this device: ${devRows.map((r) => `${r.label} ${r.count}`).join(', ')}.` }) : ''}
          <p class="who">Saved in this browser only: ${n} answer${n === 1 ? '' : 's'}${n < 30 ? ` <span class="caveat">small group (n = ${n})</span>` : ''}. Not a poll – the same person may have played more than once.</p>`}</div>
      </div>`;
    };
    gutOpts.forEach((b) =>
      b.addEventListener('click', () => {
        pressOne(gutOpts, b);
        const v = +b.dataset.v;
        state.gut = v;
        const arr = store.get(KEYS.gut);
        if (state.gutSaved && arr.length) arr[arr.length - 1] = v; // changing your mind replaces, not adds
        else arr.push(v);
        store.set(KEYS.gut, arr);
        if (DEBUG) {
          if (state.gutSaved && debugDevice.gut.length) debugDevice.gut[debugDevice.gut.length - 1] = v;
          else debugDevice.gut.push(v);
        }
        state.gutSaved = true;
        showGut(v);
      })
    );
    if (g != null && q66) {
      pressOne(gutOpts, gutOpts.find((o) => +o.dataset.v === g));
      showGut(g);
    }

    el.querySelector('#again').addEventListener('click', () => {
      state = fresh();
      go('start');
    });
    el._mount = () => stampIt(el);
    return el;
  }

  const RENDER = {
    start: renderStart,
    wheel: renderWheel,
    'wheel-debrief': renderWheelDebrief,
    feed: renderFeed,
    'feed-debrief': renderFeedDebrief,
    crowd: renderCrowd,
    'crowd-debrief': renderCrowdDebrief,
    finale: renderFinale,
  };

  /* ======================================================================
     DEBUG SCREENS - #screen=<name> jumps to a representative state
     ====================================================================== */
  function sampleWheel() {
    Object.assign(state.wheel, { anchorType: 'high', anchor: 72, side: 'less', guess: 38, rot: spinTarget(0, 72) });
  }
  function sampleFeed() {
    Object.assign(state.feed, { idx: state.feed.posts.length - 1, started: true, ended: true, paused: false, guess: 6.5, tone: 'negative' });
  }
  function sampleCrowd(second) {
    Object.assign(state.crowd, { side: 'unacceptable', first: 2, second: second === undefined ? 3 : second });
  }
  function sampleAll() {
    if (AVAILABLE.wheel) sampleWheel();
    if (AVAILABLE.feed) sampleFeed();
    if (AVAILABLE.crowd) sampleCrowd();
  }
  const DEBUG_SETUP = {
    start: () => 'start',
    wheel: () => 'wheel',
    'wheel-q': () => { sampleWheel(); return 'wheel'; },
    'wheel-debrief': () => { sampleWheel(); return 'wheel-debrief'; },
    'wheel-debrief-device': () => {
      sampleWheel();
      debugDevice.anchor = [{ t: 'low', g: 14 }, { t: 'high', g: 38 }, { t: 'low', g: 20 }, { t: 'high', g: 45 }, { t: 'high', g: 30 }];
      return 'wheel-debrief';
    },
    'feed-start': () => 'feed',
    feed: () => { Object.assign(state.feed, { started: true, idx: 2, paused: true }); return 'feed'; },
    'feed-q': () => { sampleFeed(); return 'feed'; },
    'feed-debrief': () => { sampleFeed(); return 'feed-debrief'; },
    crowd: () => { sampleCrowd(null); state.crowd.second = null; return 'crowd'; },
    'crowd-reask': () => { sampleCrowd(null); state.crowd.second = null; return 'crowd-debrief'; },
    'crowd-debrief': () => { sampleCrowd(); return 'crowd-debrief'; },
    finale: () => { sampleAll(); return 'finale'; },
    gut: () => { sampleAll(); debugDevice.gut = [3, 4, 2, 4, 5, 3]; state.gut = 4; state.gutSaved = true; return { screen: 'finale', scrollTo: 'gut' }; },
    sources: () => { sampleAll(); state.gut = 3; return { screen: 'finale', scrollTo: 'sources' }; },
  };

  function boot() {
    const foot = document.getElementById('foot-survey');
    if (foot) foot.textContent = `Survey comparisons: ${U.who()}`;
    const name = HASH_SCREEN();
    DEBUG = !!name;
    if (name && DEBUG_SETUP[name]) {
      state = fresh();
      debugDevice = { anchor: [], gut: [] };
      const r = DEBUG_SETUP[name]();
      const target = typeof r === 'string' ? { screen: r } : r;
      if (!RENDER[target.screen] || (target.screen !== 'start' && target.screen !== 'finale' && !AVAILABLE[target.screen.replace('-debrief', '')])) {
        go('start', 'none');
        return;
      }
      stage.innerHTML = '';
      go(target.screen, 'none').then(() => {
        if (target.scrollTo) {
          // Debug only: headless screenshots of a scrolled page can come out blank, so instead of
          // scrolling, hide the report sections before the target and show it at the top.
          const t = document.getElementById(target.scrollTo);
          if (t) {
            for (let s = t.previousElementSibling; s; s = s.previousElementSibling) s.style.display = 'none';
            window.scrollTo(0, 0);
          }
        }
      });
      return;
    }
    go('start', 'none');
  }

  window.addEventListener('hashchange', () => { if (HASH_SCREEN()) boot(); });
  boot();
})();

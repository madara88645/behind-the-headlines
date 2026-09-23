/*
 * Bubble Sort - game logic.
 * Survey numbers: window.Survey (shared/survey.js), always computed at runtime.
 * Facts and the true/false answer key: window.DC_FACTS (data/facts.js).
 * Card wording and explanations: window.BUBBLE_DECK (deck.js).
 *
 * Screens: start -> round (card + reveal sheet) x12 -> score -> paradox -> bubble (ask, portrait) -> end.
 * Debug: #screen=start | round | selected | drag | help | reveal-guess | reveal | reveal-opinion |
 *        reveal-data | score | paradox | ask | portrait | end
 */
(function () {
  'use strict';

  var S = window.Survey;
  var F = window.DC_FACTS;
  var D = window.BUBBLE_DECK;
  if (!S || !F || !D) {
    if (window.SURVEY_STATS) {
      document.addEventListener('DOMContentLoaded', function () {
        document.body.innerHTML = '<p style="font:16px/1.5 system-ui;max-width:520px;margin:15vh auto;padding:24px">The game data did not load. Check that <code>data/facts.js</code> and <code>deck.js</code> sit where <code>index.html</code> expects them, then reload.</p>';
      });
    }
    return;
  }

  /* ------------------------------------------------------------------ helpers */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var fill = function (tpl, obj) { return String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return obj[k] != null ? obj[k] : m; }); };
  var icon = function (id, cls) { return '<svg class="' + (cls || 'ico') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var reduceMotion = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var safe = function (fn, fallback) { try { return fn(); } catch (e) { return fallback === undefined ? null : fallback; } };
  var fmt = function (p) { return S.fmt(p); };
  var MINUS = '−';
  var signed = function (n) { return n > 0 ? '+' + n : n < 0 ? MINUS + Math.abs(n) : '0'; };
  var link = function (url, text, cls) {
    return '<a class="' + (cls || 'src-link') + '" href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(text) + icon('i-ext') + '</a>';
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  var pickOne = function (arr, rng) { return arr[Math.floor(rng() * arr.length)]; };

  var BINS = ['data', 'opinion', 'assume'];
  var BIN_NAME = { data: 'Data', opinion: 'Opinion', assume: 'Assumption' };
  var BET_NAME = { 1: 'Hunch', 2: 'Fairly sure', 3: 'Certain' };
  var SMALL = 30; // groups below this get a visible caveat
  var RULE = {
    data: 'Something that was measured and has a source you can check.',
    opinion: 'A judgement about what is good, bad, fair or what should happen. It can\u2019t be proven true or false.',
    assume: 'A claim about how the world is that could be checked, stated without evidence.',
  };

  var hasQ = function (id) { return safe(function () { return !!S.q(id); }, false); };
  var factById = function (id) { return (F.facts || []).filter(function (f) { return f.id === id; })[0] || null; };
  var surveyWho = function () { return S.n + ' people in Ireland'; };
  var smallTag = function (n) { return n != null && n < SMALL ? '<span class="small-tag">small group (n = ' + n + ')</span>' : ''; };
  // "181 of the 200 people in Ireland who took the Maynooth University survey answered"
  var whoAnswered = function (q) {
    return (q.n_answered === S.n ? 'all ' : q.n_answered + ' of the ') + S.n + ' people in Ireland who took the Maynooth University survey answered';
  };
  var ARTICLE = { data: 'It’s', opinion: 'It’s an', assume: 'It’s an' };

  /* Parts of a whole, rounded so they still add up to 100 (largest remainder). Used wherever the game
     shows a split side by side, so a reader never sees 52 + 29 + 20 = 101. */
  function roundParts(arr) {
    var vals = arr.map(function (v) { return v || 0; });
    var total = Math.round(vals.reduce(function (s, v) { return s + v; }, 0));
    var out = vals.map(Math.floor);
    var left = total - out.reduce(function (s, v) { return s + v; }, 0);
    vals.map(function (v, i) { return { i: i, r: v - Math.floor(v) }; })
      .sort(function (a, b) { return b.r - a.r || a.i - b.i; })
      .slice(0, Math.max(0, left))
      .forEach(function (o) { out[o.i] += 1; });
    return out;
  }
  var pc = function (n) { return n + '%'; };
  // True / False / Don't know for the q18-q25 items, rounded together.
  function tfSplit(qid) {
    var raw = [S.pct(qid, 'True'), S.pct(qid, 'False'), S.pct(qid, /^Don.t know$/)];
    var r = roundParts(raw);
    return { T: r[0], F: r[1], D: r[2], raw: { T: raw[0], F: raw[1], D: raw[2] } };
  }
  // 5-point agree scale, rounded together; the three-way split is built from the same rounded parts.
  function likert(q) {
    var r = roundParts(q.options.map(function (o) { return o.pct; }));
    return { parts: r, dis: r[0] + r[1], neu: r[2], agr: r[3] + r[4] };
  }

  /* Atkinson Hyperlegible draws a slashed zero ("2Ø24"), which reads as a glitch on a page full of
     numbers. Digits in body text are wrapped so they use the display face instead. */
  var DIGIT_RUN = /\d+(?:[.,]\d+)*%?/g;
  function fixDigits(root) {
    if (!root || !document.createTreeWalker || !window.getComputedStyle) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (walker.nextNode()) if (/\d/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var p = n.parentNode;
      if (!p || p.nodeType !== 1 || p.classList.contains('num') || /^(SCRIPT|STYLE|TITLE)$/.test(p.nodeName)) return;
      var cs = getComputedStyle(p);
      if (!/Atkinson/i.test(cs.fontFamily.split(',')[0])) return;
      // In a flex/grid parent every text node is its own item (with gaps), so keep the run in one span.
      var holder = /flex|grid/.test(cs.display) ? document.createElement('span') : null;
      var s = n.nodeValue, frag = document.createDocumentFragment(), last = 0;
      s.replace(DIGIT_RUN, function (m, at) {
        if (at > last) frag.appendChild(document.createTextNode(s.slice(last, at)));
        var span = document.createElement('span');
        span.className = 'num';
        span.textContent = m;
        frag.appendChild(span);
        last = at + m.length;
        return m;
      });
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      if (holder) { holder.appendChild(frag); p.replaceChild(holder, n); } else p.replaceChild(frag, n);
    });
  }

  /* ------------------------------------------------------------------ deck */
  function makeDataCard(id) {
    var f = factById(id);
    if (!f || !f.text || !f.url) return null;
    var face = f.text;
    var cut = D.data.cut && D.data.cut[id];
    if (cut) {
      var k = f.text.indexOf(cut);
      if (k > 0) face = f.text.slice(0, k).replace(/[.;,\s]+$/, '') + '.';
    }
    return { type: 'data', key: id, text: face, trimmed: face !== f.text, fact: f, tag: 'Source: ' + f.source };
  }
  function makeOpinionCard(qid) {
    if (!hasQ(qid)) return null;
    var q = S.q(qid);
    if (!q.ordered || !q.options || q.options.length !== 5) return null;
    return { type: 'opinion', key: qid, text: (D.opinion.say && D.opinion.say[qid]) || S.label(qid), q: q };
  }
  function makeAssumeCard(qid) {
    var tf = F.trueFalse && F.trueFalse[qid];
    if (!tf || !hasQ(qid)) return null;
    var text = String(tf.statement || S.label(qid)).trim();
    if (!/[.!?]$/.test(text)) text += '.';
    return { type: 'assume', key: qid, text: text, tf: tf, q: S.q(qid) };
  }
  // pick n ids from pool: one from each "must" group first, then random
  function pickSet(pool, musts, n, rng) {
    var chosen = [];
    musts.forEach(function (group) {
      var opts = (group || []).filter(function (x) { return pool.indexOf(x) > -1 && chosen.indexOf(x) < 0; });
      if (opts.length && chosen.length < n) chosen.push(pickOne(opts, rng));
    });
    var rest = shuffle(pool.filter(function (x) { return chosen.indexOf(x) < 0; }), rng);
    while (chosen.length < n && rest.length) chosen.push(rest.shift());
    return chosen;
  }
  var runOfThree = function (c) {
    for (var i = 2; i < c.length; i++) if (c[i].type === c[i - 1].type && c[i].type === c[i - 2].type) return true;
    return false;
  };
  function buildDeck(rng) {
    var dataPool = D.data.pool.filter(function (id) { return makeDataCard(id); });
    var opPool = D.opinion.pool.filter(function (id) { return makeOpinionCard(id); });
    var asPool = D.assume.pool.filter(function (id) { return makeAssumeCard(id); });
    var cards = []
      .concat(pickSet(dataPool, [D.data.alarming, D.data.soundsLikeOpinion], 4, rng).map(makeDataCard))
      .concat(pickSet(opPool, [D.opinion.factSounding], 4, rng).map(makeOpinionCard))
      .concat(pickSet(asPool, [D.assume.mustInclude, D.assume.trueOnes], 4, rng).map(makeAssumeCard))
      .filter(Boolean);
    for (var t = 0; t < 80; t++) { shuffle(cards, rng); if (!runOfThree(cards)) break; }
    // One shared pool of unsourced tags for OPINION and ASSUMPTION cards, dealt at random, so the
    // grey tag line never tells the two apart. Only DATA cards carry a "Source:".
    var tags = shuffle((D.tags && D.tags.length ? D.tags : ['Heard in conversation']).slice(), rng);
    var ti = 0;
    cards.forEach(function (c) {
      if (c.type !== 'data') c.tag = tags[ti++ % tags.length];
      c.tilt = (rng() * 4 - 2).toFixed(2);
      c.long = c.text.split(/\s+/).length > 22;
    });
    return cards;
  }

  /* ------------------------------------------------------------------ state */
  var state = {
    screen: 'start', deck: [], i: 0, bet: 1, score: 0, results: [],
    selected: false, busy: false, drag: null, ask: { src: null, know: null, done: false },
    seen: {}, // card types whose one-line definition has already been shown in a reveal
  };

  var screens = {
    start: $('#s-start'), round: $('#s-round'), score: $('#s-score'),
    paradox: $('#s-paradox'), bubble: $('#s-bubble'), end: $('#s-end'),
  };
  var el = {
    card: $('#card'), cardText: $('#cardText'), cardTag: $('#cardTag'), stack: $('#deckStack'),
    pips: $('#pips'), count: $('#roundCount'), stake: $('#stake'), bins: $('#bins'), hint: $('#dropHint'),
    sheet: $('#sheet'), scrim: $('#scrim'), sheetBody: $('#sheetBody'), next: $('#nextBtn'), nextLabel: $('#nextLabel'),
    scoreChip: $('#scoreChip'), scoreNum: $('#scoreNum'), scoreDelta: $('#scoreDelta'),
    help: $('#help'), helpBtn: $('#helpBtn'), helpClose: $('#helpClose'), live: $('#live'),
  };
  var bubbleEl = function (bin) { return $('.bins .bubble[data-bin="' + bin + '"]'); };

  function announce(msg) {
    el.live.textContent = '';
    setTimeout(function () { el.live.textContent = msg; }, 30);
  }

  function show(name, opts) {
    opts = opts || {};
    var target = screens[name];
    var already = !target.hidden;
    Object.keys(screens).forEach(function (k) { screens[k].hidden = k !== name; });
    if (already) { target.style.animation = 'none'; void target.offsetWidth; target.style.animation = ''; }
    state.screen = name;
    document.body.setAttribute('data-screen', name);
    el.scoreChip.hidden = name === 'start';
    if (name !== 'round') closeSheet(true);
    fixDigits(target);
    window.scrollTo(0, 0);
    if (opts.focus) {
      var t = opts.focus === true ? screens[name].querySelector('h1') : opts.focus;
      if (t) {
        if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      }
    }
  }

  /* ------------------------------------------------------------------ score chip */
  function setScore(v, delta) {
    state.score = v;
    el.scoreNum.textContent = v < 0 ? MINUS + Math.abs(v) : String(v);
    if (delta) {
      var d = el.scoreDelta;
      d.textContent = signed(delta);
      d.className = 'score-delta ' + (delta > 0 ? 'up' : 'down');
      void d.offsetWidth;
      d.classList.add('go');
      el.scoreChip.classList.remove('bump');
      void el.scoreChip.offsetWidth;
      el.scoreChip.classList.add('bump');
    }
  }

  /* ------------------------------------------------------------------ round */
  function startGame(seed) {
    var rng = seed != null ? mulberry32(seed) : Math.random;
    state.deck = buildDeck(rng);
    state.i = 0; state.results = []; state.bet = 1; state.busy = false; state.drag = null;
    state.ask = { src: null, know: null, done: false };
    state.seen = {};
    $$('.swallowed').forEach(function (s) { s.innerHTML = ''; });
    setScore(0);
    show('round');
    renderCard(true);
  }

  function setBet(v) {
    state.bet = v;
    var r = $('input[name="bet"][value="' + v + '"]');
    if (r) r.checked = true;
    el.stake.innerHTML = 'Right <b>+' + v + '</b> · wrong <b>' + MINUS + v + '</b>';
  }

  function setSelected(v) {
    state.selected = !!v;
    el.card.classList.toggle('is-selected', state.selected);
    el.bins.classList.toggle('is-armed', state.selected);
    el.hint.innerHTML = state.selected
      ? '<span class="only-wide">Now click the bubble it belongs in - or press 1, 2 or 3.</span><span class="only-narrow">Now tap the bubble it belongs in.</span>'
      : '<span class="only-wide">Drag the card into a bubble, click a bubble, or press 1, 2 or 3.</span><span class="only-narrow">Drag the card into a bubble, or tap the card then a bubble.</span>';
  }

  function renderPips() {
    var n = state.deck.length;
    var html = '';
    for (var k = 0; k < n; k++) {
      var r = state.results[k];
      var cls = r ? (r.right ? 'done' : 'pip-miss') : (k === state.i ? 'now' : '');
      html += '<li class="' + cls + '"></li>';
    }
    el.pips.innerHTML = html;
    el.count.textContent = 'Card ' + Math.min(state.i + 1, n) + ' of ' + n;
    var left = n - state.i - 1;
    el.stack.className = 'deck-stack' + (left <= 0 ? ' n0' : left === 1 ? ' n1' : '');
  }

  function renderCard(animate) {
    var c = state.deck[state.i];
    if (!c) return;
    var card = el.card;
    card.className = 'card' + (c.long ? ' is-long' : '');
    card.style.transform = '';
    card.style.opacity = '';
    card.style.setProperty('--tilt', c.tilt + 'deg');
    el.cardText.textContent = c.text;
    el.cardTag.innerHTML = icon(c.type === 'data' ? 'i-doc' : 'i-speech') + '<span>' + esc(c.tag) + '</span>';
    if (animate) { void card.offsetWidth; card.classList.add('is-entering'); }
    setBet(1);
    setSelected(false);
    renderPips();
    announce('Card ' + (state.i + 1) + ' of ' + state.deck.length + '. ' + c.text + ' ' + c.tag + '.');
  }

  function drop(bin, fromDrag) {
    if (state.screen !== 'round' || state.busy || !el.sheet.hidden || !state.deck[state.i]) return;
    state.busy = true;
    var c = state.deck[state.i];
    var bet = state.bet;
    var right = c.type === bin;
    var r = { card: c, choice: bin, bet: bet, right: right, delta: right ? bet : -bet };
    if (c.type === 'assume') r.guess = undefined; // asked in the reveal, before the evidence
    state.results.push(r);
    var bubble = bubbleEl(bin);
    $$('.bins .bubble.is-target').forEach(function (b) { b.classList.remove('is-target'); });
    flyInto(bubble, fromDrag).then(function () {
      state.drag = null;
      gulp(bubble);
      addSwallowed(bin, right);
      setScore(state.score + r.delta, r.delta);
      setTimeout(openReveal, reduceMotion() ? 60 : 300);
    });
  }

  function flyInto(bubble, fromDrag) {
    return new Promise(function (resolve) {
      var card = el.card;
      setSelected(false);
      card.classList.remove('is-entering', 'is-dragging');
      if (reduceMotion()) {
        card.classList.add('is-flying');
        card.style.opacity = '0';
        setTimeout(resolve, 200);
        return;
      }
      var cr = card.getBoundingClientRect();
      var br = bubble.getBoundingClientRect();
      var cur = fromDrag && state.drag ? state.drag : { dx: 0, dy: 0, rot: 0 };
      var dx = cur.dx + (br.left + br.width / 2) - (cr.left + cr.width / 2);
      var dy = cur.dy + (br.top + br.height / 2) - (cr.top + cr.height / 2);
      card.style.transform = 'translate(' + cur.dx + 'px,' + cur.dy + 'px) rotate(' + (cur.rot || 0) + 'deg)';
      void card.offsetWidth;
      card.classList.add('is-flying');
      card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + ((cur.rot || 0) + (dx > 0 ? 18 : -18)) + 'deg) scale(.08)';
      card.style.opacity = '0';
      var done = false;
      var fin = function () { if (!done) { done = true; resolve(); } };
      card.addEventListener('transitionend', fin, { once: true });
      setTimeout(fin, 470);
    });
  }

  function gulp(b) {
    b.classList.remove('gulp');
    void b.offsetWidth;
    b.classList.add('gulp');
    setTimeout(function () { b.classList.remove('gulp'); }, 560);
  }

  var SLOTS = [[19, 60], [64, 60], [27, 73], [56, 75], [9, 44], [75, 43], [61, 17], [72, 29], [41, 83], [45, 8], [14, 30], [34, 62]];
  function addSwallowed(bin, right) {
    var box = $('.bins .bubble[data-bin="' + bin + '"] .swallowed');
    if (!box) return;
    var n = box.children.length;
    var s = SLOTS[n % SLOTS.length];
    var i = document.createElement('i');
    if (!right) i.className = 'miss';
    i.style.setProperty('--x', s[0] + '%');
    i.style.setProperty('--y', s[1] + '%');
    i.style.setProperty('--r', ((n * 37) % 50 - 25) + 'deg');
    i.style.setProperty('--d', (-(n * 0.9)) + 's');
    box.appendChild(i);
  }

  /* ------------------------------------------------------------------ drag & tap */
  function hitBubble(x, y) {
    var hit = null;
    $$('.bins .bubble').forEach(function (b) {
      var r = b.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var round = Math.abs(r.width - r.height) < 4;
      if (round) {
        if (Math.hypot(x - cx, y - cy) <= (r.width / 2) * 1.18) hit = b;
      } else if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 24 && y <= r.bottom + 24) {
        hit = b;
      }
    });
    return hit;
  }

  function onDown(e) {
    if (state.screen !== 'round' || state.busy || !el.sheet.hidden) return;
    if (e.button != null && e.button > 0) return;
    el.card.classList.remove('is-entering');
    state.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, rot: 0, moved: false, target: null };
    try { el.card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function onMove(e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    d.dx = e.clientX - d.x0;
    d.dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(d.dx, d.dy) < 7) return;
    if (!d.moved) { d.moved = true; el.card.classList.add('is-dragging'); setSelected(false); }
    d.rot = Math.max(-9, Math.min(9, d.dx / 28));
    el.card.style.transform = 'translate(' + d.dx + 'px,' + d.dy + 'px) rotate(' + d.rot + 'deg)';
    var t = hitBubble(e.clientX, e.clientY);
    if (t !== d.target) {
      if (d.target) d.target.classList.remove('is-target');
      if (t) t.classList.add('is-target');
      d.target = t;
    }
  }
  function onUp(e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved) { state.drag = null; setSelected(!state.selected); return; }
    if (d.target) {
      drop(d.target.getAttribute('data-bin'), true);
    } else {
      state.drag = null;
      el.card.classList.remove('is-dragging');
      el.card.style.transform = '';
    }
  }
  function onCancel(e) {
    var d = state.drag;
    if (!d || e.pointerId !== d.id) return;
    if (d.target) d.target.classList.remove('is-target');
    state.drag = null;
    el.card.classList.remove('is-dragging');
    el.card.style.transform = '';
  }

  /* ------------------------------------------------------------------ reveal */
  function tfClass(v) { return v === 'true' ? 'v-true' : v === 'false' ? 'v-false' : 'v-partly'; }
  function tfIcon(v) { return v === 'true' ? 'i-check' : v === 'false' ? 'i-cross' : 'i-tilde'; }
  // Did a true/false guess match the answer key? null when the key is "partly" or there was no firm guess.
  function guessMatch(guess, verdict) {
    if (guess !== 'True' && guess !== 'False') return null;
    if (verdict !== 'true' && verdict !== 'false') return null;
    return (guess === 'True') === (verdict === 'true');
  }
  var GUESSES = ['True', 'False', 'Not sure'];
  var GUESS_KEY = { t: 'True', f: 'False', n: 'Not sure' };
  var isPending = function (r) { return !!r && r.card.type === 'assume' && r.guess === undefined; };

  // One explanation per reveal (not three). For assumptions it must not hint at true/false,
  // because the player is asked that next.
  function explainText(r) {
    var c = r.card;
    if (c.type === 'data') return fill(D.data.why[c.key] || D.data.whyDefault, { source: c.fact.source, year: c.fact.year });
    if (c.type === 'opinion') return D.opinion.why[c.key] || 'It’s a judgement about what is good, fair or should happen - you can agree or disagree, but not prove it.';
    if (!r.right && D.miss && D.miss[r.choice]) return D.miss[r.choice];
    return D.assume.why || 'It’s a claim about how things are that could be checked, stated without evidence.';
  }

  function bar3(qid, verdict) {
    var sp = tfSplit(qid), raw = sp.raw;
    var tick = function (on) { return on ? ' <span class="match">' + icon('i-check') + ' matches the check</span>' : ''; };
    return '<div class="bar3" role="img" aria-label="True ' + pc(sp.T) + ', false ' + pc(sp.F) + ', don’t know ' + pc(sp.D) + '">' +
      '<span class="b-true" style="width:' + raw.T + '%"></span><span class="b-false" style="width:' + raw.F + '%"></span><span class="b-dk" style="width:' + raw.D + '%"></span></div>' +
      '<ul class="legend">' +
      '<li><span class="sw b-true"></span>True ' + pc(sp.T) + tick(verdict === 'true') + '</li>' +
      '<li><span class="sw b-false"></span>False ' + pc(sp.F) + tick(verdict === 'false') + '</li>' +
      '<li><span class="sw b-dk"></span>Don’t know ' + pc(sp.D) + '</li></ul>';
  }

  function div5(q) {
    var o = q.options;
    var p = o.map(function (x) { return x.pct; });
    var L = likert(q);
    var left = p[0] + p[1] + p[2] / 2, right = p[2] / 2 + p[3] + p[4];
    var scale = 50 / Math.max(left, right, 1);
    var x = 50 - left * scale;
    var cls = ['d-sd', 'd-d', 'd-n', 'd-a', 'd-sa'];
    var segs = p.map(function (v, i) {
      var s = '<span class="' + cls[i] + '" style="left:' + x.toFixed(2) + '%;width:' + (v * scale).toFixed(2) + '%"></span>';
      x += v * scale;
      return s;
    }).join('');
    var names = o.map(function (x) { return x.short || x.label; });
    return '<div class="div5" role="img" aria-label="' + esc(names.map(function (nm, i) { return nm + ' ' + pc(L.parts[i]); }).join(', ')) + '">' + segs + '</div>' +
      '<div class="div5-scale"><span>Disagree ' + pc(L.dis) + '</span><span class="mid">Neither ' + pc(L.neu) + '</span><span>Agree ' + pc(L.agr) + '</span></div>' +
      '<ul class="legend legend5">' + names.map(function (nm, i) {
        return '<li><span class="sw ' + cls[i] + '"></span>' + esc(nm) + ' ' + pc(L.parts[i]) + '</li>';
      }).join('') + '</ul>';
  }

  // "You said False - like 29% of the survey."
  function youLineHTML(qid, guess, verdict) {
    if (!guess || guess === 'skip') return '';
    var sp = tfSplit(qid);
    var share = guess === 'True' ? sp.T : guess === 'False' ? sp.F : sp.D;
    var m = guessMatch(guess, verdict);
    var txt = guess === 'Not sure'
      ? 'You weren’t sure - like the <strong>' + pc(share) + '</strong> of the survey who said they didn’t know.'
      : 'You said <strong>' + guess + '</strong> - like <strong>' + pc(share) + '</strong> of the survey.';
    var tail = m === true ? '<span class="hit ok">' + icon('i-check') + 'Matches the check</span>'
      : m === false ? '<span class="hit no">' + icon('i-cross') + 'The check says otherwise</span>'
      : guess !== 'Not sure' ? '<span class="hit part">' + icon('i-tilde') + 'Only partly - see the check</span>' : '';
    return '<p class="you-line"><span class="label label-you">You</span><span>' + txt + ' ' + tail + '</span></p>';
  }

  // Asked on every ASSUMPTION reveal, after the sort and before the evidence.
  function guessHTML() {
    return '<div class="ev guess">' +
      '<div class="ev-head"><span class="label label-you">You</span><span class="ev-sub">before we check it</span></div>' +
      '<p class="guess-q" id="guessQ">Do you think it’s true or false?</p>' +
      '<div class="guess-opts" role="group" aria-labelledby="guessQ">' +
        GUESSES.map(function (g) {
          return '<button class="guess-btn" type="button" data-guess="' + g + '"><kbd aria-hidden="true">' + g.charAt(0) + '</kbd>' + g + '</button>';
        }).join('') +
      '</div>' +
      '<p class="ev-sub guess-note">Then see what the evidence says - and what the ' + S.n + ' people in the survey thought.</p>' +
    '</div>';
  }

  function evidenceHTML(r) {
    var c = r.card;
    if (c.type === 'data') {
      var f = c.fact;
      var conf = f.confidence === 'high' ? 'high (official body or IEA)' : f.confidence === 'medium' ? 'medium (reputable report)' : 'low (single estimate)';
      return '<div class="ev">' +
        '<div class="ev-head"><span class="label label-data">Data</span><span class="ev-sub">measured, with a source</span></div>' +
        (c.trimmed ? '<p><strong>The full figure:</strong> ' + esc(f.text) + '</p>' : '') +
        '<div class="fact-meta"' + (c.trimmed ? '' : ' style="margin-top:0"') + '><span>Source <b>' + esc(f.source) + '</b></span><span>Year <b>' + esc(f.year) + '</b></span><span>Confidence <b>' + esc(conf) + '</b></span></div>' +
        link(f.url, 'Check the source: ' + f.source) +
        '</div>' +
        '<div class="ev ev-three"><div class="ev-head"><span class="ev-sub">Three things that make it data</span></div>' +
        '<ul class="legend" style="gap:8px 18px"><li><span class="match">' + icon('i-check') + '</span>It was measured</li><li><span class="match">' + icon('i-check') + '</span>It names a source</li><li><span class="match">' + icon('i-check') + '</span>You can check it</li></ul></div>';
    }
    if (c.type === 'opinion') {
      var q = c.q, L = likert(q);
      return '<div class="ev">' +
        '<div class="ev-head"><span class="label label-survey">Survey</span><span class="ev-sub">what people said</span></div>' +
        '<p class="big">In the survey, <strong>' + pc(L.agr) + '</strong> agreed and <strong>' + pc(L.dis) + '</strong> disagreed (' + whoAnswered(q) + '). That split is data about people - not about data centres.</p>' +
        div5(q) +
        '<p class="ev-sub" style="margin-top:12px">Survey statement: “' + esc(S.label(q.id)) + '”</p>' +
        '</div>';
    }
    // assumption
    if (isPending(r)) return guessHTML();
    var tf = c.tf, qa = c.q, sp = tfSplit(qa.id);
    var first = tf.sources && tf.sources[0];
    var id = 'more-' + c.key;
    var after = D.assume.after && D.assume.after[tf.verdict];
    return '<div class="ev">' +
      '<div class="ev-head"><span class="label label-data">Data</span><span class="ev-sub">what the evidence says</span></div>' +
      '<p class="tf-row"><span class="tf-chip ' + tfClass(tf.verdict) + '">' + icon(tfIcon(tf.verdict)) + esc(tf.tag) + '</span>' +
        (after ? '<span class="after">' + esc(after) + '</span>' : '') + '</p>' +
      '<p style="margin-top:10px">' + esc(tf.short) + '</p>' +
      (first ? link(first.url, 'Source: ' + first.label) : '') +
      '<div><button class="linkish more-toggle" type="button" aria-expanded="false" aria-controls="' + id + '">Read more</button></div>' +
      '<div class="more" id="' + id + '" hidden><p>' + esc(tf.explain) + '</p><ul class="src-list">' +
      (tf.sources || []).map(function (s) { return '<li>' + link(s.url, s.label) + '</li>'; }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="ev">' +
      '<div class="ev-head"><span class="label label-survey">Survey</span><span class="ev-sub">what people believed</span></div>' +
      '<p>In the survey, <strong>' + pc(sp.T) + '</strong> said this was true, ' + pc(sp.F) + ' false and ' + pc(sp.D) + ' didn’t know (' + whoAnswered(qa) + ').</p>' +
      bar3(qa.id, tf.verdict) +
      youLineHTML(qa.id, r.guess, tf.verdict) +
      (tf.verdict === 'partly' ? '<p class="ev-sub" style="margin-top:10px">The check says “' + esc(tf.tag.toLowerCase()) + '” - neither answer tells the whole story.</p>' : '') +
      '</div>';
  }

  function revealHTML(r) {
    var c = r.card;
    var title = r.right ? (r.bet === 3 ? 'Right - and you called it!' : 'Right!') : 'Not quite';
    // The one-line definition shows the first time each type comes up, then the "?" help has it.
    var showRule = !state.seen[c.type];
    state.seen[c.type] = true;
    return '<div class="verdict ' + (r.right ? 'is-right' : 'is-wrong') + '">' +
        '<span class="verdict-icon">' + icon(r.right ? 'i-check' : 'i-cross') + '</span>' +
        '<h2 id="sheetTitle" tabindex="-1">' + esc(title) + '</h2>' +
        '<span class="delta" aria-label="' + (r.delta > 0 ? 'plus ' : 'minus ') + Math.abs(r.delta) + ' points">' + signed(r.delta) + '<small>points</small></span>' +
      '</div>' +
      '<p class="answer-line"><span>' + ARTICLE[c.type] + ' <span class="bin-chip" data-bin="' + c.type + '">' + BIN_NAME[c.type] + '</span></span>' +
        '<span class="you-said">You said ' + BIN_NAME[r.choice] + ' · bet ' + BET_NAME[r.bet] + '</span></p>' +
      '<div class="sheet-grid">' +
        '<div class="sheet-main">' +
          '<blockquote class="mini-quote">“' + esc(c.text) + '”<cite>' + esc(c.tag) + '</cite></blockquote>' +
          '<p class="why">' + esc(explainText(r)) + '</p>' +
          (showRule ? '<p class="rule" data-bin="' + c.type + '"><span class="dot" aria-hidden="true"></span><span><b>' + BIN_NAME[c.type] + '</b> ' + esc(RULE[c.type]) + '</span></p>' : '') +
        '</div>' +
        '<div class="sheet-evidence" id="sheetEvidence" tabindex="-1">' + evidenceHTML(r) + '</div>' +
      '</div>';
  }

  function setNextLabel(r) {
    el.nextLabel.textContent = isPending(r) ? 'Skip - show the check'
      : state.i >= state.deck.length - 1 ? 'See your results' : 'Next card';
  }

  function wireEvidence(root) {
    $$('.more-toggle', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.getElementById(b.getAttribute('aria-controls'));
        var open = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.textContent = open ? 'Show less' : 'Read more';
        box.hidden = !open;
      });
    });
    $$('.guess-btn', root).forEach(function (b) {
      b.addEventListener('click', function () { answerGuess(b.getAttribute('data-guess')); });
    });
  }

  // guess: 'True' | 'False' | 'Not sure' | 'skip'
  function answerGuess(guess) {
    var r = state.results[state.results.length - 1];
    if (!isPending(r) || el.sheet.hidden) return;
    r.guess = guess;
    var box = $('#sheetEvidence');
    if (!box) return;
    box.innerHTML = evidenceHTML(r);
    box.classList.remove('is-in'); void box.offsetWidth; box.classList.add('is-in');
    wireEvidence(box);
    fixDigits(box);
    setNextLabel(r);
    box.focus({ preventScroll: true });
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches && box.scrollIntoView) {
      box.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
    var tf = r.card.tf, m = guessMatch(guess, tf.verdict);
    announce('The check says: ' + tf.tag + '. ' + (m === true ? 'Your guess matches. ' : m === false ? 'Your guess does not match. ' : '') +
      'In the survey, ' + pc(tfSplit(r.card.q.id).T) + ' said it was true.');
  }

  function openReveal() {
    var r = state.results[state.results.length - 1];
    if (!r) return;
    el.sheetBody.innerHTML = revealHTML(r);
    el.sheetBody.scrollTop = 0;
    setNextLabel(r);
    el.sheet.classList.remove('is-closing');
    el.scrim.classList.remove('is-closing');
    el.scrim.hidden = false;
    el.sheet.hidden = false;
    wireEvidence(el.sheetBody);
    fixDigits(el.sheetBody);
    var t = $('#sheetTitle');
    if (t) t.focus({ preventScroll: true });
    state.busy = false;
    renderPips();
    announce((r.right ? 'Right. ' : 'Not quite. ') + (r.delta > 0 ? 'Plus ' : 'Minus ') + Math.abs(r.delta) + ' points. ' + ARTICLE[r.card.type] + ' ' + BIN_NAME[r.card.type] + '.' +
      (isPending(r) ? ' Before we check it: true, false or not sure? Press T, F or N.' : ''));
  }

  function closeSheet(instant) {
    if (el.sheet.hidden) return;
    if (instant || reduceMotion()) {
      el.sheet.hidden = true; el.scrim.hidden = true;
      return;
    }
    el.sheet.classList.add('is-closing');
    el.scrim.classList.add('is-closing');
    setTimeout(function () {
      el.sheet.hidden = true; el.scrim.hidden = true;
      el.sheet.classList.remove('is-closing'); el.scrim.classList.remove('is-closing');
    }, 260);
  }

  function next() {
    if (el.sheet.hidden || state.busy || el.sheet.classList.contains('is-closing')) return;
    var r = state.results[state.results.length - 1];
    if (isPending(r)) { answerGuess('skip'); return; } // never blocks: first press shows the check
    closeSheet();
    state.i++;
    if (state.i >= state.deck.length) {
      setTimeout(function () { renderScore(); show('score', { focus: true }); }, reduceMotion() ? 0 : 220);
      return;
    }
    setTimeout(function () {
      renderCard(true);
      el.card.focus({ preventScroll: true });
    }, reduceMotion() ? 0 : 180);
  }

  /* ------------------------------------------------------------------ results: shared */
  function stepHTML(k, label) {
    var dots = '';
    for (var i = 1; i <= 3; i++) dots += '<i class="' + (i <= k ? 'on' : '') + '"></i>';
    return '<p class="step"><span class="dots" aria-hidden="true">' + dots + '</span><span>Results · ' + k + ' of 3<span class="step-extra"> · ' + esc(label) + '</span></span></p>';
  }
  function keyHTML() {
    return '<ul class="key" aria-label="Labels used">' +
      '<li><span class="label label-data">Data</span>measured, with a source</li>' +
      '<li><span class="label label-survey">Survey</span>what ' + surveyWho() + ' said</li>' +
      '<li><span class="label label-you">You</span>your own answers and bets</li></ul>';
  }
  function backHTML(to) {
    return to ? '<button class="linkish back-btn" type="button" data-go="' + to + '">' + icon('i-back') + 'Back</button>' : '';
  }
  function footHTML(tease, go, label, back) {
    return '<div class="final-foot sticky"><div class="foot-left">' + backHTML(back) + '<span class="next-tease">' + esc(tease) + '</span></div>' +
      '<button class="btn btn-primary" type="button" data-go="' + go + '">' + esc(label || 'Next') + ' ' + icon('i-arrow') + '</button></div>';
  }

  function howHTML(summary, text) {
    return '<details class="how"><summary>' + esc(summary) + '</summary><p>' + text + '</p></details>';
  }
  var minCell = function () { return (S.meta && S.meta.min_cell) || 3; };

  // How often each bet level implies you expect to be right.
  var EXPECT = { 1: 0.5, 2: 0.7, 3: 0.9 };
  function tally() {
    var R = state.results;
    var by = function (fn) { return R.filter(fn); };
    var acc = function (arr) { return arr.length ? arr.filter(function (r) { return r.right; }).length / arr.length : null; };
    var bets = { 1: by(function (r) { return r.bet === 1; }), 2: by(function (r) { return r.bet === 2; }), 3: by(function (r) { return r.bet === 3; }) };
    var types = {};
    BINS.forEach(function (b) { types[b] = by(function (r) { return r.card.type === b; }); });
    var correct = by(function (r) { return r.right; }).length;
    // actual hit rate minus the rate those bets imply; null when there are too few cards to judge
    var gap = function (arr, min) {
      if (arr.length < min) return null;
      var expected = arr.reduce(function (s, r) { return s + EXPECT[r.bet]; }, 0) / arr.length;
      return acc(arr) - expected;
    };
    var gSure = gap(by(function (r) { return r.bet >= 2; }), 3); // Fairly sure + Certain
    var gLow = gap(by(function (r) { return r.bet <= 2; }), 2);  // Hunch + Fairly sure
    var overCert = bets[3].some(function (r) { return !r.right; }) && acc(bets[3]) < 0.75;
    var over = overCert || (gSure != null && gSure <= -0.2 + 1e-9);
    var modest = gLow != null && gLow >= 0.2 - 1e-9;
    var verdict = over ? 'over' : modest ? 'modest' : 'calibrated';
    return { R: R, bets: bets, types: types, correct: correct, total: R.length, acc: acc, verdict: verdict, over: over, modest: modest };
  }
  var rightOf = function (arr) { return arr.filter(function (r) { return r.right; }).length; };
  // The bet level the calibration sentence talks about: the one behind the verdict, else the most used.
  function focusLevel(T) {
    if (T.verdict === 'over') return T.bets[3].length ? 3 : 2;
    if (T.verdict === 'modest') return T.bets[1].length ? 1 : 2;
    var best = 0;
    [3, 2, 1].forEach(function (b) { if (T.bets[b].length > (best ? T.bets[best].length : 0)) best = b; });
    return best;
  }

  /* ------------------------------------------------------------------ results 1: score */
  function renderScore() {
    var T = tally();
    var maxPts = T.total * 3;
    var typeRows = BINS.map(function (b) {
      var arr = T.types[b];
      var ticks = arr.map(function (r) { return '<i class="' + (r.right ? 'ok' : 'no') + '">' + icon(r.right ? 'i-check' : 'i-cross') + '</i>'; }).join('');
      return '<li class="type-row" data-bin="' + b + '"><span class="bin-chip" data-bin="' + b + '">' + BIN_NAME[b] + '</span>' +
        '<span class="ticks" aria-hidden="true">' + ticks + '</span><span class="frac">' + rightOf(arr) + ' of ' + arr.length + '</span></li>';
    }).join('');
    var worst = BINS.slice().sort(function (a, b) { return (T.acc(T.types[a]) || 0) - (T.acc(T.types[b]) || 0); })[0];
    var allSame = BINS.every(function (b) { return T.acc(T.types[b]) === T.acc(T.types[worst]); });
    var tricky = allSame
      ? (T.correct === T.total ? 'A clean sweep - every bubble right.' : 'No bubble was harder than the others for you.')
      : 'Your trickiest bubble: <b>' + BIN_NAME[worst] + '</b> (' + rightOf(T.types[worst]) + ' of ' + T.types[worst].length + ').';

    var rows = [1, 2, 3].map(function (b) {
      var arr = T.bets[b];
      var net = arr.reduce(function (s, r) { return s + r.delta; }, 0);
      var dots = '<i></i><i></i><i></i>'.slice(0, 7 * b);
      var cell = arr.length
        ? '<span class="betdots" aria-hidden="true">' + arr.map(function (r) { return '<i class="' + (r.right ? 'ok' : 'no') + '">' + icon(r.right ? 'i-check' : 'i-cross') + '</i>'; }).join('') + '</span>'
        : '<span class="none">Not used</span>';
      return '<tr><td class="lvl"><span class="bet-dots" aria-hidden="true">' + dots + '</span>' + BET_NAME[b] + '</td>' +
        '<td>' + cell + '</td>' +
        '<td>' + (arr.length ? rightOf(arr) + ' of ' + arr.length : '–') + '</td>' +
        '<td><span class="net ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '') + '">' + (arr.length ? signed(net) : '–') + '</span></td></tr>';
    }).join('');

    var lvl = focusLevel(T);
    var la = (lvl && T.bets[lvl]) || [];
    var sentence = !la.length ? ''
      : la.length === 1
        ? 'You said <em>' + BET_NAME[lvl] + '</em> once - and you were ' + (la[0].right ? 'right' : 'wrong') + '.'
        : 'When you said <em>' + BET_NAME[lvl] + '</em>, you were right ' + rightOf(la) + ' of ' + la.length + ' times.';
    var V = {
      calibrated: { cls: 'vb-calibrated', ic: 'i-check', h: 'Well calibrated', p: 'Your confidence tracked how often you were right. That’s a rarer skill than just being right.' },
      over: { cls: 'vb-over', ic: 'i-cross', h: 'Overconfident', p: 'Your sure bets were right less often than you expected - feeling sure didn’t make you right.' + (T.modest ? ' Meanwhile your lower bets were mostly right: you were sure about the wrong ones.' : '') },
      modest: { cls: 'vb-modest', ic: 'i-tilde', h: 'Too modest', p: 'You were right far more often than your bets said. You knew more than you let yourself bet.' },
    }[T.verdict];

    screens.score.innerHTML =
      stepHTML(1, 'Your score') +
      '<h1 class="final-title" id="scoreTitle">Your score &amp; calibration</h1>' +
      '<p class="final-lede">Being right is one skill. Knowing <em>when</em> you’re right is another - that’s what your bets measured.</p>' +
      '<div class="score-grid">' +
        '<div class="panel">' +
          '<span class="label label-you">You</span>' +
          '<div class="big-score" style="margin-top:16px"><span class="num">' + (state.score < 0 ? MINUS + Math.abs(state.score) : state.score) + '</span><span class="of">points<br>out of a possible ' + maxPts + '</span></div>' +
          '<p class="sorted-line">You sorted <b>' + T.correct + '/' + T.total + '</b> correctly.</p>' +
          '<ul class="type-rows">' + typeRows + '</ul>' +
          '<p class="tricky">' + tricky + '</p>' +
        '</div>' +
        '<div class="panel">' +
          '<h3>Did your bets match your answers?</h3>' +
          '<table class="calib"><thead><tr><th scope="col">Bet</th><th scope="col">Your cards</th><th scope="col">Right</th><th scope="col">Points</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          (sentence ? '<p class="calib-sentence">' + sentence + '</p>' : '') +
          '<div class="verdict-box ' + V.cls + '"><span class="vb-icon">' + icon(V.ic) + '</span><h4>' + V.h + '</h4><p>' + V.p + '</p></div>' +
          howHTML('How the verdict is worked out',
            'Each bet says how often you expect to be right: <b>Hunch</b> about 1 in 2, <b>Fairly sure</b> about 7 in 10, <b>Certain</b> about 9 in 10. ' +
            '<b>Overconfident</b>: your Fairly sure and Certain bets (at least 3 of them) were right at least 20 percentage points less often than that - ' +
            'or a Certain bet was wrong and fewer than 3 in 4 of your Certain bets were right. ' +
            '<b>Too modest</b>: your Hunch and Fairly sure bets (at least 2 of them) were right at least 20 percentage points more often than that. ' +
            'Anything else counts as <b>well calibrated</b>. It’s a rule of thumb for twelve cards, not a personality test.') +
        '</div>' +
      '</div>' +
      footHTML('Next: were the most confident people in the survey the most right?', 'paradox');
  }

  /* ------------------------------------------------------------------ results 2: paradox */
  function renderParadox() {
    var q17 = safe(function () { return S.q('q17'); });
    var rows = q17 ? q17.options.map(function (o) {
      return { label: o.label, short: o.short || o.label, r: S.within('q17', o.label, 'q18', 'True') };
    }) : [];
    var top = rows[rows.length - 1];
    var all18 = hasQ('q18') ? tfSplit('q18') : null;
    var overall = all18 ? all18.raw.T : null;
    var tf18 = F.trueFalse && F.trueFalse.q18;
    var T = tally();
    var cert = T.bets[3];

    var head, chart = '', caveat = '';
    if (top && top.r) {
      head = '<span class="headline-num">' + fmt(top.r.pct) + '</span> of people who said they know ‘' + esc(top.short.toLowerCase()) +
        '’ about data-centre energy believed that all Irish data centres run on fossil fuels - which is false.';
      var cols = rows.map(function (row, i) {
        var hot = i === rows.length - 1;
        if (!row.r) {
          // no height at all, so nothing reads as a value
          return '<div class="col null" style="--i:' + i + '"><div class="null-box"><span>too few people to show</span></div></div>';
        }
        var p = row.r.pct;
        // A label just under the dashed "everyone" line would be crossed by it, so it goes inside the bar.
        var inside = overall != null && p < overall && overall - p < 16 && p >= 18;
        var val = '<div class="val' + (inside ? ' in' : '') + '"' + (inside ? ' style="bottom:calc(' + p.toFixed(1) + '% - 34px)"' : '') + '>' + fmt(p) + '</div>';
        return '<div class="col' + (hot ? ' hot' : '') + '" style="--i:' + i + '">' + val + '<div class="bar" style="height:' + p.toFixed(1) + '%"></div></div>';
      }).join('');
      var avg = overall != null ? '<div class="avg-line" style="bottom:' + overall.toFixed(1) + '%"></div>' : '';
      var xl = rows.map(function (row) {
        var n = row.r ? row.r.n : null;
        return '<div><div class="xl">' + esc(row.short) + '</div><div class="xn">n = ' + (n == null ? '–' : n) + '</div>' + smallTag(n) + '</div>';
      }).join('');
      chart =
        '<div class="chart" role="img" aria-label="' + esc(rows.map(function (row) { return row.short + ': ' + (row.r ? fmt(row.r.pct) + ' (n = ' + row.r.n + ')' : 'too few people to show'); }).join('; ')) + '">' + cols + avg + '</div>' +
        '<div class="xlabels" aria-hidden="true">' + xl + '</div>';
      caveat = '<p class="caveat">The ‘' + esc(top.short.toLowerCase()) + '’ group is only ' + top.r.n + ' people - treat this as a clue, not a law.</p>';
    } else {
      head = 'The survey split for this comparison is not available, so there is nothing to show here.';
    }

    // Same group, a different true/false item. Survey data, so it gets its own Survey box and a small-group tag.
    var alt = top ? S.within('q17', top.label, 'q24', 'True') : null;
    var tf24 = F.trueFalse && F.trueFalse.q24;
    var all24 = hasQ('q24') ? tfSplit('q24') : null;
    var altHTML = alt && tf24 && tf24.verdict === 'true' && all24 && alt.pct - all24.raw.T >= 5
      ? '<div class="ev"><div class="ev-head"><span class="label label-survey">Survey</span><span class="ev-sub">same group, another statement</span></div>' +
          '<p>On another statement - “' + esc(tf24.statement) + '”, which is true - the same group more often got it right: <strong>' + fmt(alt.pct) + '</strong> said true, against ' + pc(all24.T) + ' of everyone. Being sure lined up with being right there, but not here.</p>' +
          smallTag(alt.n) + '</div>'
      : '';

    var q18r = state.results.filter(function (r) { return r.card.key === 'q18'; })[0];
    var youLines = [];
    if (q18r && all18 && GUESSES.indexOf(q18r.guess) > -1) {
      youLines.push(q18r.guess === 'Not sure'
        ? 'On the fossil-fuel claim you weren’t sure before the check - like the ' + pc(all18.D) + ' of the survey who didn’t know.'
        : 'On the fossil-fuel claim you said <b>' + q18r.guess + '</b> before the check - ' + (q18r.guess === 'False' ? 'right, ' : '') + 'like ' + pc(q18r.guess === 'True' ? all18.T : all18.F) + ' of the survey.');
    }
    youLines.push(cert.length ? 'Your own <b>Certain</b> bets: right ' + rightOf(cert) + ' of ' + cert.length + '.' : 'You never bet <b>Certain</b>. Being unsure can be the honest answer.');

    var avgKey = overall != null ? '<span class="avg-key"><i aria-hidden="true"></i>Everyone who answered: ' + pc(all18.T) + '</span>' : '';
    screens.paradox.innerHTML =
      stepHTML(2, 'The confidence paradox') +
      '<h1 class="final-title" id="paradoxTitle">People who were most sure were not the most right.</h1>' +
      '<p class="final-lede paradox-head">' + head + '</p>' +
      '<div class="paradox-grid">' +
        '<div class="panel chart-panel">' +
          '<div class="chart-top"><div><p class="chart-q"><span class="label label-survey">Survey</span>&nbsp; Share who answered <b>True</b> to “' + esc(safe(function () { return S.label('q18'); }, 'All data centres in Ireland run on fossil fuels')) + '”, by how much they feel they know about data-centre energy.</p>' +
            '<p class="chart-meta">' + avgKey + '<span class="ev-sub">Maynooth University survey of ' + surveyWho() + '</span></p></div></div>' +
          chart + caveat +
        '</div>' +
        '<div class="paradox-side">' +
          '<div class="ev"><div class="ev-head"><span class="label label-data">Data</span><span class="ev-sub">why the statement is false</span></div>' +
            '<p>' + esc(tf18 ? tf18.short : '') + '</p>' + (tf18 && tf18.sources[0] ? link(tf18.sources[0].url, 'Source: ' + tf18.sources[0].label) : '') + '</div>' +
          altHTML +
          '<div class="ev"><div class="ev-head"><span class="label label-you">You</span><span class="ev-sub">your own answers, for comparison</span></div>' +
            youLines.map(function (t) { return '<p>' + t + '</p>'; }).join('') + '</div>' +
          howHTML('How this is calculated',
            'Each bar = people in that group who answered “True” to q18, divided by everyone in the group who answered both q17 and q18 (that is the n). ' +
            'The dashed line is everyone who answered q18. Source: Maynooth University survey of ' + surveyWho() + '. ' +
            'Any answer given by fewer than ' + minCell() + ' people in a group is hidden in the data file, and the game shows “too few people to show” instead of a number.') +
        '</div>' +
      '</div>' +
      keyHTML() +
      footHTML('Next: whose information bubble are you in?', 'bubble', null, 'score');
  }

  /* ------------------------------------------------------------------ results 3: whose bubble */
  function cohortFor(label) {
    var list = D.cohorts || [];
    for (var i = 0; i < list.length; i++) if (list[i].match.test(label)) return list[i];
    return { name: label.replace(/\s*\(.*?\)\s*/g, ''), icon: 'question' };
  }
  var srcShort = function (label) { return label.replace(/\s*\(.*?\)\s*/g, '').trim(); };
  function q16Options() {
    return safe(function () { return S.q('q16').options.filter(function (o) { return !/something else|written in/i.test(o.label); }); }, []);
  }

  function renderAsk() {
    var srcs = q16Options();
    var know = safe(function () { return S.q('q17').options; }, []);
    var srcPills = srcs.map(function (o, i) {
      var c = cohortFor(o.label);
      return '<label class="pill"><input type="radio" name="src" value="' + i + '"' + (state.ask.src === o.label ? ' checked' : '') + '>' +
        '<span>' + icon('c-' + c.icon, 'pi') + esc(o.label) + '</span></label>';
    }).join('');
    var knowPills = know.map(function (o, i) {
      return '<label class="pill"><input type="radio" name="know" value="' + i + '"' + (state.ask.know === o.label ? ' checked' : '') + '><span>' + esc(o.short || o.label) + '</span></label>';
    }).join('');
    screens.bubble.innerHTML =
      stepHTML(3, 'Whose bubble are you in?') +
      '<h1 class="final-title" id="bubbleTitle">Whose bubble are you in?</h1>' +
      '<p class="final-lede">Two quick questions, using the survey’s own answer options. Then we’ll show you the people in the survey who answered the same way.</p>' +
      '<form class="ask" id="askForm" novalidate>' +
        '<fieldset class="q-block"><legend>Where have you mostly formed your view on data centres?</legend>' +
          '<p class="q-note">Pick the one that fits best. (In the survey people could pick several.)</p><div class="pills">' + srcPills + '</div></fieldset>' +
        '<fieldset class="q-block"><legend>How much do you feel you know about how data centres use energy?</legend>' +
          '<p class="q-note">Your gut feeling is fine - that’s what the survey asked.</p><div class="pills scale-pills">' + knowPills + '</div></fieldset>' +
      '</form>' +
      '<div class="final-foot sticky"><div class="foot-left">' + backHTML('paradox') + '<span class="next-tease keep">Your answers stay on this page - nothing is saved or sent.</span></div>' +
        '<button class="btn btn-primary" type="button" id="showBubble"' + (state.ask.src && state.ask.know ? '' : ' disabled') + '>Show my bubble ' + icon('i-arrow') + '</button></div>';

    var form = $('#askForm');
    form.addEventListener('change', function (e) {
      if (e.target.name === 'src') state.ask.src = srcs[+e.target.value].label;
      if (e.target.name === 'know') state.ask.know = know[+e.target.value].label;
      $('#showBubble').disabled = !(state.ask.src && state.ask.know);
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $('#showBubble').addEventListener('click', function () {
      if (!(state.ask.src && state.ask.know)) return;
      state.ask.done = true;
      renderPortrait();
      show('bubble', { focus: true });
    });
  }

  function statHTML(label, res, overall) {
    if (!res) {
      return '<div class="stat is-na"><span class="sl">' + esc(label) + '</span><span class="sv na">too few people to show</span></div>';
    }
    return '<div class="stat"><span class="sl">' + esc(label) + '<small>n = ' + res.n + '</small></span><span class="sv">' + fmt(res.pct) + '</span>' +
      '<span class="sbar" aria-hidden="true"><i style="width:' + res.pct.toFixed(1) + '%"></i>' +
      (overall != null ? '<b style="left:' + overall.toFixed(1) + '%"></b>' : '') + '</span></div>';
  }
  function groupHead(text, a, b) {
    var ns = [a, b].filter(Boolean).map(function (x) { return x.n; });
    var n = ns.length ? Math.min.apply(null, ns) : null;
    return '<h5>' + esc(text) + '</h5>' + smallTag(n);
  }
  // "a higher share than everyone in the survey (56%)". Small groups need a bigger gap before we call it.
  function compareText(res, overall) {
    if (!res || overall == null) return null;
    var d = res.pct - overall;
    var small = res.n < SMALL;
    var word = Math.abs(d) < (small ? 15 : 5) ? 'about the same as' : d > 0 ? 'a higher share than' : 'a lower share than';
    return word + ' everyone in the survey (' + fmt(overall) + ')' + (small ? ' - small group, so treat it as a hint' : '');
  }

  function renderPortrait() {
    var srcs = q16Options();
    var idx = srcs.map(function (o) { return o.label; }).indexOf(state.ask.src);
    var src = srcs[idx] || srcs[0];
    var coh = cohortFor(src.label);
    var notFormed = /not formed/i.test(src.label);
    var knowOpt = safe(function () { return S.q('q17').options.filter(function (o) { return o.label === state.ask.know; })[0]; });
    var knowShort = knowOpt ? (knowOpt.short || knowOpt.label) : state.ask.know;
    var allSupport = safe(function () { return S.pct('q96', /supportive/); });
    var allMyth = safe(function () { return tfSplit('q18').raw.T; });
    var sSup = S.within('q16', src.label, 'q96', /supportive/);
    var sMyth = S.within('q16', src.label, 'q18', 'True');
    var kSup = S.within('q17', state.ask.know, 'q96', /supportive/);
    var kMyth = S.within('q17', state.ask.know, 'q18', 'True');
    var share = src.pct;
    var rarity = share >= 30 ? 'Common' : share >= 15 ? 'Uncommon' : 'Rare';
    var T = tally();
    var q18r = state.results.filter(function (r) { return r.card.key === 'q18'; })[0];

    var flecks = [[14, 22, 18], [80, 18, 12], [86, 70, 22], [10, 72, 10], [26, 84, 8], [70, 86, 9]].map(function (f) {
      return '<span class="fleck" style="left:' + f[0] + '%;top:' + f[1] + '%;width:' + f[2] + 'px;height:' + f[2] + 'px"></span>';
    }).join('');

    var card =
      '<div class="tcard">' +
        '<div class="tcard-in">' +
          '<div class="tcard-top"><span>Bubble card</span><span>No. ' + String(idx + 1).padStart(2, '0') + ' / ' + String(srcs.length).padStart(2, '0') + '</span></div>' +
          '<div class="tcard-art">' + flecks + '<div class="bubble" aria-hidden="true"><span class="film"></span>' + icon('c-' + coh.icon, '') + '</div></div>' +
          '<h2 class="tcard-name">The ' + esc(coh.name) + ' bubble</h2>' +
          '<p class="tcard-rarity">' + rarity + ' · ' + fmt(share) + ' of people in the survey picked this answer</p>' +
          '<div class="tcard-group">' + groupHead(notFormed ? 'Have not formed a view yet' : 'Formed their view via ' + srcShort(src.label).toLowerCase(), sSup, sMyth) +
            statHTML('Support sustainable data centres', sSup, allSupport) +
            statHTML('Believed the fossil-fuel myth', sMyth, allMyth) +
          '</div>' +
          '<div class="tcard-group">' + groupHead('Say they know ‘' + knowShort.toLowerCase() + '’ about energy use', kSup, kMyth) +
            statHTML('Support sustainable data centres', kSup, allSupport) +
            statHTML('Believed the fossil-fuel myth', kMyth, allMyth) +
          '</div>' +
          '<div class="tcard-you"><span class="label label-you">You</span><span>You sorted <b>' + T.correct + '/' + T.total + '</b> correctly.</span></div>' +
        '</div>' +
      '</div>';

    var cmpSup = compareText(sSup, allSupport);
    var cmpMyth = compareText(sMyth, allMyth);
    var lines = [];
    if (sSup && cmpSup) lines.push(fmt(sSup.pct) + ' of them support sustainable data centres - ' + cmpSup + '.');
    if (sMyth && cmpMyth) lines.push(fmt(sMyth.pct) + ' believed all Irish data centres run on fossil fuels - ' + cmpMyth + '.');
    if (!sSup || !sMyth) lines.push('Some numbers for this group are hidden because too few people gave that answer.');
    var cmpKSup = compareText(kSup, allSupport);
    var cmpKMyth = compareText(kMyth, allMyth);
    var klines = [];
    if (kSup && cmpKSup) klines.push(fmt(kSup.pct) + ' support sustainable data centres - ' + cmpKSup + '.');
    if (kMyth && cmpKMyth) klines.push(fmt(kMyth.pct) + ' believed the fossil-fuel myth - ' + cmpKMyth + '.');
    if (!kSup || !kMyth) klines.push('Some numbers for this group are hidden because too few people gave that answer.');
    var kn = [kSup, kMyth].filter(Boolean).map(function (x) { return x.n; });
    var kSmall = kn.length ? smallTag(Math.min.apply(null, kn)) : '';
    var yourMyth = q18r
      ? '<p>The fossil-fuel claim was in your deck. You put it in <span class="bin-chip" data-bin="' + q18r.choice + '">' + BIN_NAME[q18r.choice] + '</span> - ' +
        (q18r.right ? 'right: it’s an assumption, and a false one.' : 'it was an assumption, and a false one.') + '</p>'
      : '';

    screens.bubble.innerHTML =
      stepHTML(3, 'Whose bubble are you in?') +
      '<h1 class="final-title" id="bubbleTitle">Whose bubble are you in?</h1>' +
      '<div class="portrait-grid">' + card +
        '<div class="side">' +
          '<div class="panel">' +
            '<h3>How your bubble compares</h3>' +
            '<p><span class="label label-survey">Survey</span>&nbsp; ' + (notFormed ? 'People who said <b>they have not formed a view</b> yet:' : 'People who said they formed their view mostly via <b>' + esc(srcShort(src.label).toLowerCase()) + '</b>:') + '</p>' +
            (lines.length ? '<p>' + lines.map(esc).join(' ') + '</p>' : '') +
            '<div class="grp"><p>People who say they know <b>‘' + esc(knowShort.toLowerCase()) + '’</b> about data-centre energy: ' + klines.map(esc).join(' ') + '</p>' + kSmall + '</div>' +
            '<p class="tick-key" style="margin-top:12px"><i></i> the black tick on each bar = everyone in the survey</p>' +
            '<div class="grp">' + yourMyth + '</div>' +
            howHTML('How this is calculated',
              '<b>Support</b> = share answering ' + '“' + 'Somewhat supportive' + '”' + ' or ' + '“' + 'Strongly supportive' + '”' + ' to q96 (attitude to sustainable data centres). ' +
              '<b>Fossil-fuel myth</b> = share answering ' + '“' + 'True' + '”' + ' to q18. Your source group comes from q16, where people could tick several; your knowledge group from q17. ' +
              '<b>Rarity</b> = share of respondents who ticked that answer in q16. Any answer given by fewer than ' + minCell() + ' people in a group is hidden in the data file, and the game shows “too few people to show” instead of a number. Groups under ' + SMALL + ' people are marked.') +
            '<p class="disclaimer">Matched on the two answers you just gave - it’s a comparison with people who answered the same way, not a prediction about you. People could pick more than one source, so these groups overlap. Groups under ' + SMALL + ' people are marked “small group”.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      keyHTML() +
      '<div class="final-foot sticky"><div class="foot-left"><button class="linkish" type="button" id="changeAns">Change my answers</button></div>' +
        '<button class="btn btn-primary" type="button" data-go="end">Finish ' + icon('i-arrow') + '</button></div>';

    $('#changeAns').addEventListener('click', function () {
      state.ask.done = false;
      renderAsk();
      show('bubble', { focus: true });
    });
  }

  function renderBubble() { if (state.ask.done) renderPortrait(); else renderAsk(); }

  /* ------------------------------------------------------------------ end */
  function shortText(t, words) {
    var w = String(t).split(/\s+/);
    return w.length <= words ? t : w.slice(0, words).join(' ').replace(/[,;:.\-]+$/, '') + '…';
  }
  function collectSources() {
    var seen = {}, list = [];
    var add = function (label, url, kind) { if (url && !seen[url]) { seen[url] = 1; list.push({ label: label, url: url, kind: kind }); } };
    state.results.forEach(function (r) {
      var c = r.card;
      if (c.type === 'data') add(c.fact.source + ' (' + c.fact.year + ') - ' + shortText(c.fact.text, 12), c.fact.url, 'data');
      if (c.type === 'assume') (c.tf.sources || []).forEach(function (s) { add(s.label, s.url, 'evidence'); });
    });
    var tf18 = F.trueFalse && F.trueFalse.q18;
    if (tf18) (tf18.sources || []).forEach(function (s) { add(s.label, s.url, 'evidence'); });
    return list;
  }

  // The player's own true/false guesses next to the evidence and the survey - the same question for both.
  function vsHTML() {
    var rows = state.results.filter(function (r) { return r.card.type === 'assume'; });
    if (!rows.length) return '';
    var isClear = function (r) { return r.card.tf.verdict === 'true' || r.card.tf.verdict === 'false'; };
    var clear = rows.filter(function (r) { return isClear(r) && GUESSES.indexOf(r.guess) > -1; });
    var mine = clear.filter(function (r) { return guessMatch(r.guess, r.card.tf.verdict); }).length;
    var theirs = clear.length ? clear.reduce(function (s, r) {
      var raw = tfSplit(r.card.q.id).raw;
      return s + (r.card.tf.verdict === 'true' ? raw.T : raw.F);
    }, 0) / clear.length : null;

    var items = rows.map(function (r) {
      var c = r.card, sp = tfSplit(c.q.id);
      var g = GUESSES.indexOf(r.guess) > -1 ? r.guess : null;
      var m = g ? guessMatch(g, c.tf.verdict) : null;
      var share = g === 'True' ? sp.T : g === 'False' ? sp.F : sp.D;
      var mark = m === true ? icon('i-check', 'ico ok') + '<span class="sr-only">Matches the check. </span>'
        : m === false ? icon('i-cross', 'ico no') + '<span class="sr-only">Does not match the check. </span>'
        : icon('i-tilde', 'ico part');
      var you = g
        ? mark + '<span>' + (g === 'Not sure' ? 'You weren’t sure' : 'You said <b>' + g + '</b>') + '<small>' + (g === 'Not sure' ? 'like the ' + pc(share) + ' who didn’t know' : 'like ' + pc(share) + ' of the survey') + '</small></span>'
        : '<span class="none">No guess - you skipped it</span>';
      return '<li>' +
        '<span class="vs-claim">' + esc(c.text) + '</span>' +
        '<span class="vs-check"><span class="tf-chip ' + tfClass(c.tf.verdict) + '">' + icon(tfIcon(c.tf.verdict)) + esc(c.tf.tag) + '</span></span>' +
        '<span class="vs-survey"><b>' + pc(sp.T) + '</b> said true<span class="vs-bar" aria-hidden="true"><i style="width:' + sp.raw.T.toFixed(1) + '%"></i></span></span>' +
        '<span class="vs-you">' + you + '</span>' +
      '</li>';
    }).join('');

    var score = clear.length
      ? '<div class="vs-score">' +
          '<div><span class="label label-you">You</span><p><b>' + mine + ' of ' + clear.length + '</b> of your guesses matched the evidence</p></div>' +
          '<div><span class="label label-survey">Survey</span><p><b>' + fmt(theirs) + '</b> of people in the survey got the same ' + (clear.length === 1 ? 'statement' : 'statements') + ' right, on average</p></div>' +
        '</div>' +
        '<p class="vs-note">Counts only the statements with a clear true-or-false answer. “Not sure” and “Don’t know” count as not matching.</p>'
      : '';

    return '<div class="panel vs"><h3>You vs the survey: true or false?</h3>' +
      '<p class="vs-lede">Before each check you guessed whether the assumption was true. Here are your guesses next to the evidence and the ' + S.n + ' people in the survey, who were asked the same thing.</p>' +
      score +
      '<ul class="key vs-key"><li><span class="label label-data">Data</span>what the evidence says</li><li><span class="label label-survey">Survey</span>what the ' + S.n + ' people believed</li><li><span class="label label-you">You</span>what you guessed before the check</li></ul>' +
      '<ul class="vs-list">' + items + '</ul></div>';
  }

  function renderEnd() {
    var T = tally();
    var vName = { calibrated: 'Well calibrated', over: 'Overconfident', modest: 'Too modest' }[T.verdict];
    var coh = state.ask.src ? cohortFor(state.ask.src) : null;
    var recap = state.results.map(function (r) {
      var c = r.card;
      return '<li><span class="rk ' + (r.right ? 'ok' : 'no') + '">' + icon(r.right ? 'i-check' : 'i-cross') + '<span class="sr-only">' + (r.right ? 'Right' : 'Wrong') + '</span></span>' +
        '<span class="rt">' + esc(c.text) + '<small>' + ARTICLE[c.type] + ' <span class="c" data-bin="' + c.type + '">' + BIN_NAME[c.type] + '</span>' +
        (r.right ? '' : ' · you said ' + BIN_NAME[r.choice]) + ' · ' + BET_NAME[r.bet] + '</small></span>' +
        '<span class="rp ' + (r.delta > 0 ? 'pos' : 'neg') + '">' + signed(r.delta) + '</span></li>';
    }).join('');
    var srcs = collectSources();
    var meta = S.meta || {};

    screens.end.innerHTML =
      '<div class="end-head"><div>' +
        '<p class="step">That’s a wrap</p>' +
        '<h1 class="final-title" id="endTitle">Data, opinion, assumption - sorted.</h1>' +
        '<p class="final-lede">Next time a claim about data centres lands in your feed, ask the bubble question: was it measured, is it a judgement, or is it just assumed?</p>' +
      '</div></div>' +
      '<div class="summary-strip">' +
        '<div class="sum"><p class="k">Score</p><p class="v">' + (state.score < 0 ? MINUS + Math.abs(state.score) : state.score) + ' <small>of ' + T.total * 3 + '</small></p></div>' +
        '<div class="sum"><p class="k">Sorted right</p><p class="v">' + T.correct + ' <small>of ' + T.total + '</small></p></div>' +
        '<div class="sum"><p class="k">Your bets</p><p class="v txt">' + vName + '</p></div>' +
        '<div class="sum"><p class="k">Your bubble</p><p class="v txt">' + (coh ? 'The ' + esc(coh.name) + ' bubble' : 'Not picked') + '</p></div>' +
      '</div>' +
      vsHTML() +
      '<div class="end-grid">' +
        '<div class="panel"><h3>Your twelve cards</h3><ul class="recap">' + recap + '</ul></div>' +
        '<div class="panel"><h3>Sources</h3><ul class="sources">' +
          '<li><span class="label label-survey">Survey</span><span>' + esc(meta.title || 'Social Acceptance of Sustainable Data Centres in Ireland') + ' - Maynooth University survey, ' + S.n + ' respondents in Ireland. Every percentage in this game is calculated from it.</span></li>' +
          srcs.map(function (s) {
            var lab = s.kind === 'data' ? '<span class="label label-data">Data</span>' : '<span class="label label-evidence">Evidence</span>';
            return '<li>' + lab + '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a></li>';
          }).join('') +
        '</ul>' +
        '<p class="fine"><b>Data</b> = a measured figure shown on a card. <b>Evidence</b> = the sources used to check an assumption. Survey figures are what these ' + S.n + ' people said - not a measure of everyone in Ireland. Facts were checked on ' + esc(F.checked || '') + '. Cards are dealt at random, so the sources change from run to run.</p></div>' +
      '</div>' +
      '<div class="final-foot sticky"><div class="foot-left"><span class="next-tease">Cards are dealt at random - play again for a new deck.</span></div>' +
        '<div class="foot-actions">' +
          '<a class="btn btn-ghost" href="index.html">' + icon('i-back') + '<span class="only-wide-inline">Back to all games</span><span class="only-narrow-inline">All games</span></a>' +
          '<button class="btn btn-primary" type="button" id="againBtn">' + icon('i-replay') + ' Play again</button>' +
        '</div></div>';
    $('#againBtn').addEventListener('click', function () { startGame(); el.card.focus({ preventScroll: true }); });
  }

  /* ------------------------------------------------------------------ navigation */
  function go(name) {
    if (name === 'paradox') renderParadox();
    if (name === 'bubble') renderBubble();
    if (name === 'end') renderEnd();
    if (name === 'score') renderScore();
    show(name, { focus: true });
  }

  /* ------------------------------------------------------------------ help */
  var helpReturn = null;
  function openHelp() {
    helpReturn = document.activeElement;
    el.help.hidden = false;
    el.helpClose.focus();
  }
  function closeHelp() {
    el.help.hidden = true;
    if (helpReturn && helpReturn.focus) helpReturn.focus({ preventScroll: true });
  }

  function trapTab(e, root) {
    var f = $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
      .filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ events */
  $('#startBtn').addEventListener('click', function () { startGame(); el.card.focus({ preventScroll: true }); });
  $$('input[name="bet"]').forEach(function (r) { r.addEventListener('change', function () { setBet(+r.value); }); });
  $$('.bins .bubble').forEach(function (b) { b.addEventListener('click', function () { drop(b.getAttribute('data-bin')); }); });
  el.card.addEventListener('pointerdown', onDown);
  el.card.addEventListener('pointermove', onMove);
  el.card.addEventListener('pointerup', onUp);
  el.card.addEventListener('pointercancel', onCancel);
  el.card.addEventListener('lostpointercapture', function (e) { if (state.drag && !state.busy && state.drag.id === e.pointerId && state.drag.moved) onCancel(e); });
  el.next.addEventListener('click', next);
  el.helpBtn.addEventListener('click', openHelp);
  el.helpClose.addEventListener('click', closeHelp);
  el.help.addEventListener('click', function (e) { if (e.target === el.help) closeHelp(); });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-go]');
    if (t) go(t.getAttribute('data-go'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!el.help.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeHelp(); }
      else if (e.key === 'Tab') trapTab(e, el.help);
      return;
    }
    if (state.screen !== 'round') return;
    if (!el.sheet.hidden) {
      if (e.key === 'Tab') { trapTab(e, el.sheet); return; }
      var gk = GUESS_KEY[e.key.toLowerCase()];
      if (gk && isPending(state.results[state.results.length - 1])) { e.preventDefault(); answerGuess(gk); return; }
      if (e.key === 'Enter') {
        var tgt = e.target;
        if (tgt && tgt.closest && tgt.closest('button, a, input, textarea, select')) return;
        e.preventDefault();
        next();
      }
      return;
    }
    if (e.key === '1' || e.key === '2' || e.key === '3') { e.preventDefault(); drop(BINS[+e.key - 1]); return; }
    var k = e.key.toLowerCase();
    if (k === 'h' || k === 'f' || k === 'c') { setBet({ h: 1, f: 2, c: 3 }[k]); return; }
    if (e.key === 'Escape') { setSelected(false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target === el.card) { e.preventDefault(); setSelected(!state.selected); }
  });

  $$('.js-n').forEach(function (n) { n.textContent = S.n; });
  fixDigits(el.help);

  /* ------------------------------------------------------------------ debug screens */
  var DEBUG_SEED = 20260922;
  var PATTERN_RIGHT = [1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1];
  var PATTERN_BET = [1, 2, 3, 1, 1, 2, 3, 1, 2, 3, 1, 3];
  var PATTERN_GUESS = ['True', 'False', 'True', 'Not sure']; // true/false guesses, in order of the assumption cards

  function moveCard(pred, pos) {
    var k = -1;
    for (var i = 0; i < state.deck.length; i++) if (pred(state.deck[i])) { k = i; break; }
    if (k < 0 || k === pos) return;
    var c = state.deck.splice(k, 1)[0];
    state.deck.splice(pos, 0, c);
  }
  function wrongBin(t) { return BINS[(BINS.indexOf(t) + 1) % 3]; }
  function simulate(n) {
    var score = 0, a = 0;
    for (var k = 0; k < n && k < state.deck.length; k++) {
      var c = state.deck[k];
      var right = !!PATTERN_RIGHT[k];
      var bet = PATTERN_BET[k];
      var choice = right ? c.type : wrongBin(c.type);
      var r = { card: c, choice: choice, bet: bet, right: right, delta: right ? bet : -bet };
      if (c.type === 'assume') r.guess = PATTERN_GUESS[a++ % PATTERN_GUESS.length];
      state.seen[c.type] = true;
      state.results.push(r);
      score += r.delta;
      addSwallowed(choice, right);
    }
    state.i = Math.min(n, state.deck.length);
    setScore(score);
  }
  function debugPrepare() {
    startGame(DEBUG_SEED);
    el.card.classList.remove('is-entering');
  }
  function answerCurrent(choice, bet, guess) {
    var c = state.deck[state.i];
    var right = c.type === choice;
    var r = { card: c, choice: choice, bet: bet, right: right, delta: right ? bet : -bet };
    if (c.type === 'assume') r.guess = guess; // undefined = still to be asked
    state.results.push(r);
    addSwallowed(choice, right);
    setScore(state.score + r.delta);
    el.card.classList.add('is-gone');
    openReveal();
  }

  function applyDebug(name) {
    switch (name) {
      case 'start':
        show('start');
        return true;
      case 'round': case 'selected': case 'drag': case 'help':
        debugPrepare();
        moveCard(function (c) { return c.key === 'q46' || c.key === 'q50'; }, 3);
        simulate(3);
        renderCard(false);
        el.card.classList.remove('is-entering');
        if (name !== 'help') setBet(2);
        if (name === 'selected') setSelected(true);
        if (name === 'drag') {
          requestAnimationFrame(function () {
            var b = bubbleEl('opinion');
            var cr = el.card.getBoundingClientRect(), br = b.getBoundingClientRect();
            var dx = (br.left + br.width / 2) - (cr.left + cr.width / 2) + 40;
            var dy = (br.top + br.height / 2) - (cr.top + cr.height / 2) - br.height * 0.75;
            el.card.classList.add('is-dragging');
            el.card.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(4deg) scale(.9)';
            b.classList.add('is-target');
          });
        }
        if (name === 'help') openHelp();
        return true;
      case 'reveal': case 'reveal-assumption':
        debugPrepare();
        moveCard(function (c) { return c.key === 'q18'; }, 4);
        simulate(4);
        renderCard(false);
        answerCurrent('data', 3, 'True');
        return true;
      case 'reveal-guess':
        debugPrepare();
        moveCard(function (c) { return c.key === 'q18'; }, 4);
        simulate(4);
        renderCard(false);
        answerCurrent('assume', 2);
        return true;
      case 'reveal-opinion':
        debugPrepare();
        moveCard(function (c) { return c.key === 'q46' || c.key === 'q50'; }, 4);
        simulate(4);
        renderCard(false);
        answerCurrent('data', 2);
        return true;
      case 'reveal-data':
        debugPrepare();
        moveCard(function (c) { return c.key === 'ie-share-2025' || c.key === 'ie-water'; }, 4);
        simulate(4);
        renderCard(false);
        answerCurrent('data', 2);
        return true;
      case 'score': case 'paradox': case 'ask': case 'bubble': case 'portrait': case 'end':
        debugPrepare();
        simulate(12);
        if (name === 'portrait' || name === 'end') {
          var so = q16Options()[0];
          var ko = safe(function () { return S.q('q17').options[3]; });
          state.ask = { src: so ? so.label : null, know: ko ? ko.label : null, done: true };
        }
        if (name === 'score') renderScore();
        if (name === 'paradox') renderParadox();
        if (name === 'ask' || name === 'bubble') { state.ask = { src: null, know: null, done: false }; renderAsk(); name = 'bubble'; }
        if (name === 'portrait') { renderPortrait(); name = 'bubble'; }
        if (name === 'end') renderEnd();
        show(name);
        return true;
      default:
        return false;
    }
  }

  function readHash() {
    var m = /(?:^#|&)screen=([\w-]+)/.exec(location.hash || '');
    return m ? m[1] : null;
  }
  function boot() {
    var name = readHash();
    if (!name || !applyDebug(name)) show('start');
  }
  window.addEventListener('hashchange', function () {
    var name = readHash();
    if (name) { closeHelp(); applyDebug(name); }
  });
  boot();
})();

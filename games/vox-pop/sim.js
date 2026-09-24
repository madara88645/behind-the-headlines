/*
 * Vox Pop - sim.js
 * Everything that turns the survey into the game's made-up residents:
 *   - districts = survey q4 (urban / suburban / rural)
 *   - a resident's answer = a random draw from the q4 x question cross-tab row for their district
 *   - "meet the 200" crowd = the real cross-tab counts, one figure per respondent
 *   - "100 parallel vox pops" = a simulation using the same draws
 * All numbers come from window.Survey at runtime. Nothing here is hard-coded survey data.
 */
(function () {
  'use strict';
  const VP = (window.VP = window.VP || {});
  const S = window.Survey;
  if (!S) return;

  const TOWN = 'Ballinacloud';
  const SMALL_N = 30;

  const has = (id) => { try { S.q(id); return true; } catch (e) { return false; } };

  /* ------------------------------------------------------------ districts (survey q4) */
  const DISTRICTS = [
    { key: 'urban', re: /^Urban/, name: 'Town centre', inText: 'the town centre', short: 'centre', area: 'urban' },
    { key: 'suburban', re: /^Suburban/, name: 'Oakfield estate', inText: 'Oakfield estate', short: 'estate', area: 'suburban' },
    { key: 'rural', re: /^Rural/, name: 'The farms', inText: 'the farms', short: 'farms', area: 'rural' },
  ];
  const D = {};
  DISTRICTS.forEach((d) => { D[d.key] = d; });

  function q4Count(dkey) {
    if (!has('q4')) return 0;
    const o = S.q('q4').options.find((x) => D[dkey].re.test(x.label));
    return o ? o.count : 0;
  }

  /** Split `total` residents across districts in proportion to q4 (largest remainder). */
  function residentsPerDistrict(total) {
    const w = DISTRICTS.map((d) => q4Count(d.key));
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    const raw = w.map((x) => (x / sum) * total);
    const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach((p) => { if (left > 0) { out[p[1]]++; left--; } });
    const res = {};
    DISTRICTS.forEach((d, i) => { res[d.key] = out[i]; });
    return res;
  }

  /* ------------------------------------------------------------ question pool */
  const atLeast4 = (o) => o.value != null && o.value >= 4;
  const atMost2 = (o) => o.value != null && o.value <= 2;

  const SPOKEN = {
    // the middle answers name both ends: a bare "Neither" sounds like a reply to an either/or question
    agree: ['Strongly disagree.', "I'd disagree, yeah.", 'Neither agree nor disagree, really.', "I'd agree with that.", 'Strongly agree.'],
    accept: ['Completely unacceptable.', 'Somewhat unacceptable.', 'Neither acceptable nor unacceptable, to be honest.', 'Somewhat acceptable.', 'Completely acceptable.'],
    freq: ['Never.', 'Rarely.', 'Sometimes.', 'Often.', 'Every day, pretty much.'],
    change: ['Much more negative.', 'A bit more negative.', "It's stayed the same.", 'A bit more positive.', 'Much more positive.'],
  };

  const Q = {
    q67: {
      type: 'agree', measure: atLeast4, title: 'Uneasy about living near one?',
      headline: (p) => p + '% of ' + TOWN + ' feel uneasy about data centres being built near them',
      facts: ['ie-water', 'ie-tallaght', 'ie-share-2025'],
      extras: [{ by: 'q7', groups: [{ m: 'Yes', label: 'people who said a data centre is within 10 km of their home' }, { m: 'No', label: 'people who said there isn\'t one' }] }],
    },
    q77: {
      type: 'accept', measure: atLeast4, title: 'A data centre within 5 km?',
      headline: (p) => p + '% of ' + TOWN + ' would accept a data centre within 5 km of home',
      facts: ['ie-cru-2025', 'ie-tallaght', 'ie-share-2034'],
      extras: [{ by: 'q7', groups: [{ m: 'Yes', label: 'people who said a data centre is within 10 km of their home' }, { m: 'No', label: 'people who said there isn\'t one' }] }],
    },
    q11: {
      type: 'freq', measure: atLeast4, title: 'How much AI do people use?',
      headline: (p) => p + '% of ' + TOWN + ' use AI tools often or every day',
      facts: ['prompt-gemini', 'global-2030'],
      extras: [{ by: 'q11', of: 'q96', ofMatch: /supportive/, ofText: 'support sustainable data centres (q96)', groups: [{ m: 'Daily', label: 'people who use AI tools daily' }, { m: 'Never', label: 'people who never use them' }] }],
    },
    q8: {
      type: 'freq', measure: atLeast4, title: 'How much streaming?',
      headline: (p) => p + '% of ' + TOWN + ' stream often or every day',
      facts: ['streaming', 'global-2030'],
      extras: [],
    },
    q97: {
      type: 'change', measure: atMost2, title: 'Turning against data centres?',
      headline: (p) => p + '% of ' + TOWN + ' have grown more negative about data centres',
      facts: ['ie-share-2025', 'ie-share-2034'],
      extras: [],
    },
    q99: {
      type: 'agree', measure: atLeast4, title: 'Keep attracting data centres?',
      headline: (p) => p + '% of ' + TOWN + ' want Ireland to keep attracting data centre investment',
      facts: ['ie-gva', 'ie-jobs'],
      extras: [],
    },
    q104: {
      type: 'agree', measure: atLeast4, title: 'Worth the cost?',
      headline: (p) => p + '% of ' + TOWN + ' say data centres\' benefits can outweigh their costs',
      facts: ['ie-gva', 'ie-bills'],
      extras: [],
    },
  };

  const SLOTS = [
    { n: 1, name: 'The new hall', bulletin: 'Morning bulletin', start: 9 * 60, editor: 'The campus has asked for planning permission for another data hall. Get me a vox pop: how does ' + TOWN + ' feel about living next to data centres?', angles: ['q67', 'q77'] },
    { n: 2, name: 'Life online', bulletin: 'Lunchtime bulletin', start: 12 * 60, editor: 'Everyone\'s phones and laptops run on places like that campus. How much do people here actually use this stuff?', angles: ['q11', 'q8'] },
    { n: 3, name: 'The six o\'clock news', bulletin: 'Evening news', start: 16 * 60, editor: 'Top story at six. Where is the town heading on data centres? Pick your angle and get me a number.', angles: ['q97', 'q99', 'q104'] },
  ];

  /** The question as the reporter reads it out - taken from the survey wording. */
  function askText(id) {
    const q = S.q(id);
    if (Q[id] && Q[id].type === 'agree') return 'Agree or disagree: “' + q.item + '”';
    if (Q[id] && Q[id].type === 'freq') return 'How often do you use ' + lowerFirst(q.item) + '? Never, rarely, sometimes, often or daily?';
    return q.text;
  }
  function lowerFirst(s) { return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s; }
  function surveyWording(id) { const q = S.q(id); return q.item ? (q.group ? q.group + ' - ' : '') + q.item : q.text; }

  /** "Agree or Strongly Agree" - built from the option labels that count. */
  function measureText(id) {
    const q = S.q(id), m = Q[id].measure;
    const names = q.options.filter(m).map((o) => '“' + (o.short || o.label) + '”');
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0] || '';
  }
  function spoken(id, opt) {
    const t = Q[id] ? SPOKEN[Q[id].type] : null;
    if (t && opt.value != null && t[opt.value - 1]) return t[opt.value - 1];
    const s = opt.short || opt.label;
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/\.?$/, '.');
  }

  /* ------------------------------------------------------------ answer distributions */
  /**
   * How a resident of district `dkey` answers question `id`:
   * weights = counts in that district's q4 cross-tab row; decline = share of that district who skipped the question.
   * Falls back to the overall answers if the cross-tab row is missing or has a suppressed cell.
   */
  const distCache = {};
  function distribution(id, dkey) {
    const k = id + '|' + dkey;
    if (distCache[k]) return distCache[k];
    const q = S.q(id);
    const total = q4Count(dkey);
    const rows = has('q4') ? S.crosstab('q4', id) : null;
    const row = rows && rows.find((r) => D[dkey].re.test(r.label));
    let out;
    if (row && row.n && total && row.cells.every((c) => c.count != null)) {
      out = { weights: row.cells.map((c) => c.count), decline: Math.max(0, total - row.n) / total, n: row.n, total, fallback: false };
    } else {
      out = { weights: q.options.map((o) => o.count || 0), decline: Math.max(0, 1 - q.n_answered / S.n), n: q.n_answered, total: S.n, fallback: true };
    }
    distCache[k] = out;
    return out;
  }
  function pickWeighted(w, r) {
    const sum = w.reduce((a, b) => a + b, 0);
    let x = r * sum;
    for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; }
    return w.length - 1;
  }
  /** Draw one answer: returns an option index, or -1 for "I'd rather not say". */
  function sample(id, dkey, rng) {
    const d = distribution(id, dkey);
    if (rng() < d.decline) return -1;
    return pickWeighted(d.weights, rng());
  }
  const isYes = (id, idx) => idx >= 0 && !!Q[id].measure(S.q(id).options[idx]);

  /* ------------------------------------------------------------ survey results */
  function surveyResult(id) {
    const q = S.q(id);
    return { pct: S.pct(id, Q[id].measure), yes: S.count(id, Q[id].measure), n: q.n_answered, skipped: S.n - q.n_answered };
  }
  function districtResult(id, dkey) {
    const w = has('q4') ? S.within('q4', D[dkey].re, id, Q[id].measure) : null;
    return w ? { pct: w.pct, n: w.n, small: w.n < SMALL_N } : null;
  }
  /** Story extras: a cross-tab pattern shown in the report (pattern, not a cause). */
  function extraResults(id) {
    return (Q[id].extras || []).map((e) => {
      if (!has(e.by)) return null;
      const of = e.of || id, m = e.ofMatch || Q[id].measure;
      if (!has(of)) return null;
      const groups = e.groups.map((g) => { const w = S.within(e.by, g.m, of, m); return w ? { label: g.label, pct: w.pct, n: w.n, small: w.n < SMALL_N } : null; });
      if (groups.some((g) => !g)) return null;
      return { by: e.by, of, ofText: e.ofText || null, groups };
    }).filter(Boolean);
  }

  /** The survey's 200 people as figures: by district (q4 cross-tab counts) and answer category. */
  function crowd(id) {
    const q = S.q(id);
    const figs = [];
    const placed = q.options.map(() => 0);
    DISTRICTS.forEach((d) => {
      const total = q4Count(d.key);
      const rows = has('q4') ? S.crosstab('q4', id) : null;
      const row = rows && rows.find((r) => d.re.test(r.label));
      if (!row || !row.n) { for (let i = 0; i < total; i++) figs.push({ d: d.key, cat: 'hidden' }); return; }
      let known = 0;
      row.cells.forEach((c, j) => {
        if (c.count == null) return;
        known += c.count;
        placed[j] += c.count;
        for (let i = 0; i < c.count; i++) figs.push({ d: d.key, cat: isYes(id, j) ? 'yes' : 'no', opt: j });
      });
      for (let i = 0; i < row.n - known; i++) figs.push({ d: d.key, cat: 'hidden' });
      for (let i = 0; i < total - row.n; i++) figs.push({ d: d.key, cat: 'none' });
    });
    // anyone left over (e.g. people who didn't answer q4) stands in the square
    q.options.forEach((o, j) => { for (let i = 0; i < Math.max(0, o.count - placed[j]); i++) figs.push({ d: 'unknown', cat: isYes(id, j) ? 'yes' : 'no', opt: j }); });
    while (figs.length < S.n) figs.push({ d: 'unknown', cat: 'none' });
    return figs.slice(0, S.n);
  }

  /* ------------------------------------------------------------ parallel vox pops */
  /** reps simulated reporters, each asking k random residents who answer. Returns % "yes" for each. */
  function simulate(id, k, reps, rng) {
    const w = DISTRICTS.map((d) => q4Count(d.key));
    const dists = DISTRICTS.map((d) => distribution(id, d.key));
    const yes = S.q(id).options.map((o) => !!Q[id].measure(o));
    const out = [];
    for (let r = 0; r < reps; r++) {
      let y = 0;
      for (let i = 0; i < k; i++) {
        const di = pickWeighted(w, rng());
        if (yes[pickWeighted(dists[di].weights, rng())]) y++;
      }
      out.push(k ? (100 * y) / k : 0);
    }
    return out;
  }
  function percentile(arr, p) {
    const a = arr.slice().sort((x, y) => x - y);
    if (!a.length) return 0;
    const i = Math.min(a.length - 1, Math.max(0, Math.round((p / 100) * (a.length - 1))));
    return a[i];
  }

  /* ------------------------------------------------------------ facts */
  function fact(id) {
    const F = window.DC_FACTS;
    return (F && F.facts || []).find((f) => f.id === id) || null;
  }

  /* ------------------------------------------------------------ rng */
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Which angles are playable (question present in the data). */
  function availableAngles(slot) { return slot.angles.filter((id) => has(id) && Q[id]); }

  VP.Sim = {
    TOWN, SMALL_N, DISTRICTS, D, Q, SLOTS, has,
    q4Count, residentsPerDistrict, askText, surveyWording, measureText, spoken,
    distribution, sample, isYes, surveyResult, districtResult, extraResults, crowd, simulate, percentile, fact, rng, availableAngles,
  };
})();

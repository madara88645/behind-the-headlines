/**
 * build-data.mjs - computes EVERY number the video shows from the project's data files.
 *
 *   Inputs (read-only):  ../data/survey_stats.json   (aggregate survey counts + cross-tabs)
 *                        ../data/facts.js            (window.DC_FACTS - verified facts with sources)
 *                        ../shared/survey.js         (the games' own helper - reused so semantics match)
 *   Output:              src/data/generated.ts       (typed constant, imported by the scenes)
 *
 * Run: `npm run data` (also runs automatically before `npm run dev`, `render`, `stills`).
 * Never edit src/data/generated.ts by hand - change the data files and re-run this script.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const out = path.resolve(here, "..", "src", "data", "generated.ts");

const stats = JSON.parse(fs.readFileSync(path.join(root, "data", "survey_stats.json"), "utf8"));

// facts.js and survey.js are browser scripts that assign to window.* - evaluate them in a sandbox.
const sandbox = { window: { SURVEY_STATS: stats }, document: { addEventListener() {} } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "data", "facts.js"), "utf8"), sandbox);
vm.runInContext(fs.readFileSync(path.join(root, "shared", "survey.js"), "utf8"), sandbox);
const F = sandbox.window.DC_FACTS;
const S = sandbox.window.Survey;
if (!F || !S) throw new Error("Could not load DC_FACTS or Survey helper");

const round = (p) => (p == null ? null : Math.round(p)); // same rounding as Survey.fmt
// NOTE: predicates are plain functions / arrays / strings. A RegExp created here would fail the
// `instanceof RegExp` check inside the vm realm, so regex matches are wrapped in functions.
const re = (rx) => (o) => rx.test(o.label);
const ACCEPT = (o) => o.value != null && o.value >= 4; // q77: somewhat + completely acceptable (value 4-5)
// Cross-tab cells carry labels but no `value`, so within() matches acceptance by label list:
const ACCEPT_LABELS = S.q("q77").options.filter(ACCEPT).map((o) => o.label);
const fact = (id) => {
  const f = F.facts.find((x) => x.id === id);
  if (!f) throw new Error("Missing fact " + id);
  return f;
};
/** First "<number>%" in a fact sentence (so we never retype a number from facts.js). */
const pctIn = (text, nth = 0) => {
  const all = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
  if (all[nth] == null) throw new Error("No % in: " + text);
  return all[nth];
};
const within = (by, byMatch, of, ofMatch) => {
  const r = S.within(by, byMatch, of, ofMatch);
  if (!r) throw new Error(`Suppressed/missing cross-tab ${by}>${of}`);
  return { pct: round(r.pct), raw: r.pct, n: r.n };
};
const agreeSplit = (id) => ({
  id,
  text: S.label(id),
  n: S.q(id).n_answered,
  agree: round(S.agree(id)),
  neither: round(S.neutral(id)),
  disagree: round(S.disagree(id)),
  // raw option shares in scale order (1..5) for 5-segment bars
  options: S.q(id)
    .options.filter((o) => o.value != null)
    .sort((a, b) => a.value - b.value)
    .map((o) => ({ label: o.short || o.label, pct: o.pct })),
});

// ---------------------------------------------------------------- CSO (DATA)
const cso = F.csoSeries;
const years = cso.years.map((y) => ({ year: y.year, pct: y.pct }));
const first = years[0];
const last = years[years.length - 1];

// ---------------------------------------------------------------- survey basics
const meta = {
  respondents: S.n,
  questions: S.questions.length,
  title: S.meta.title,
  source: S.meta.source,
  minCell: S.meta.min_cell,
};

// ---------------------------------------------------------------- thesis numbers
const q96 = S.q("q96");
const q77 = S.q("q77");
const q18 = S.q("q18");
const support = { pct: round(S.pct("q96", re(/supportive/))), raw: S.pct("q96", re(/supportive/)), n: q96.n_answered };
const opposed = { pct: round(S.pct("q96", re(/opposed/))), n: q96.n_answered };
const accept5km = { pct: round(S.pct("q77", ACCEPT)), raw: S.pct("q77", ACCEPT), n: q77.n_answered };
const fossil = {
  statement: F.trueFalse.q18.statement,
  verdictTag: F.trueFalse.q18.tag,
  short: F.trueFalse.q18.short,
  sourceLabel: F.trueFalse.q18.sources[0].label,
  sourceUrl: F.trueFalse.q18.sources[0].url,
  n: q18.n_answered,
  true: round(S.pct("q18", "True")),
  false: round(S.pct("q18", "False")),
  dontKnow: round(S.pct("q18", "Don't know")),
  rawTrue: S.pct("q18", "True"),
  rawFalse: S.pct("q18", "False"),
  rawDontKnow: S.pct("q18", "Don't know"),
};
const rese = fact("ie-rese");
const renewables = { pct: pctIn(rese.text, 0), year: rese.year, source: rese.source, url: rese.url, text: rese.text };

// ---------------------------------------------------------------- confidence paradox (q17 x q18)
const q17 = S.q("q17");
const paradox = q17.options
  .filter((o) => o.value != null)
  .sort((a, b) => a.value - b.value)
  .map((o) => {
    const r = within("q17", o.label, "q18", "True");
    return { label: o.short || o.label, pct: r.pct, raw: r.raw, n: r.n, small: r.n < 30 };
  });
const greatDeal = paradox[paradox.length - 1];
// same group on q24 (a TRUE statement) - "confidence helped there"
const greatDealQ24 = within("q17", "A great deal", "q24", "True");

// ---------------------------------------------------------------- 5 KM: town hall + conditions
const opts77 = q77.options.filter((o) => o.value != null).sort((a, b) => a.value - b.value);
const total77 = opts77.reduce((s, o) => s + o.count, 0);
const raw77 = opts77.map((o) => (o.count / total77) * 100);
const base = raw77.map(Math.floor);
const left = 100 - base.reduce((a, b) => a + b, 0);
raw77
  .map((r, i) => [r - base[i], i])
  .sort((a, b) => b[0] - a[0])
  .slice(0, left)
  .forEach((p) => (base[p[1]] += 1));
const room = opts77.map((o, i) => ({ value: o.value, label: o.label, count: base[i] }));
const roomBy = Object.fromEntries(room.map((g) => [g.value, g.count]));

// Short names for the ten conditions (text only - the numbers come from the survey)
const COND = [
  ["q78", "Renewable power"],
  ["q79", "Waste heat for homes"],
  ["q80", "Community fund"],
  ["q81", "Local jobs quota"],
  ["q82", "Independent monitoring"],
  ["q83", "Landscape-friendly design"],
  ["q84", "Open days"],
  ["q85", "STEM in local schools"],
  ["q86", "Lower local bills"],
  ["q87", "Liaison committee"],
];
const q88 = S.q("q88");
const key = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 25);
const conds = COND.map(([id, short]) => {
  const label = S.label(id);
  const m = q88.options.find((o) => key(o.label) === key(label));
  if (!m) throw new Error("No q88 match for " + id);
  return { id, short, label, rating: S.pct(id, ACCEPT), nRating: S.q(id).n_answered, pick: m.pct };
});
[...conds].sort((a, b) => b.rating - a.rating).forEach((c, i) => (c.rRank = i + 1));
[...conds].sort((a, b) => b.pick - a.pick).forEach((c, i) => (c.pRank = i + 1));
conds.forEach((c) => (c.diff = c.rRank - c.pRank));
const up = conds.reduce((a, b) => (b.diff > a.diff ? b : a)); // picked far more than rated
const down = conds.reduce((a, b) => (b.diff < a.diff ? b : a)); // rated far more than picked

// Same simplified model as games/5km (documented in its "How this is calculated" panel)
const model = (ids) => {
  const ps = ids.map((id) => conds.find((c) => c.id === id).pick / 100);
  let none = 1;
  ps.forEach((p) => (none *= 1 - p));
  let one = 0;
  ps.forEach((p, i) => {
    let t = p;
    ps.forEach((q, j) => {
      if (j !== i) t *= 1 - q;
    });
    one += t;
  });
  const P1 = 1 - none;
  const P2 = Math.max(0, 1 - none - one);
  const convNeither = Math.round(P1 * roomBy[3]);
  const convSomewhat = Math.round(P2 * roomBy[2]);
  return { convNeither, convSomewhat, accepting: roomBy[4] + roomBy[5] + convNeither + convSomewhat };
};
// SAMPLE PLAY: one package a player might pick (6 planning points: 3 + 2 + 1 in the game).
const samplePackage = ["q79", "q81", "q82"];
const sampleVote = model(samplePackage);

const nearby = {
  yes: within("q7", "Yes", "q77", ACCEPT_LABELS),
  no: within("q7", "No", "q77", ACCEPT_LABELS),
};
const strongSupp = within("q96", "Strongly supportive", "q77", ACCEPT_LABELS);

// ---------------------------------------------------------------- RIGGED: bias blind spot
const bias = {
  q62: agreeSplit("q62"), // first impression stayed
  q65: agreeSplit("q65"), // trust first source
  q55: agreeSplit("q55"), // news stories shaped views
  q57: agreeSplit("q57"), // info mostly negative
  q59: agreeSplit("q59"), // oppose if community opposed
  q61: agreeSplit("q61"), // protests influenced
};
const water = fact("ie-water");

// ---------------------------------------------------------------- sources shown in the data section
const officialSources = [
  { name: "CSO", what: "electricity 2015-2025", url: cso.url },
  { name: "SEAI", what: "renewables", url: rese.url },
  { name: "EirGrid", what: "wind curtailment", url: fact("ie-wind-dd").url },
  { name: "CRU", what: "grid policy", url: fact("ie-share-2034").url },
  { name: "IEA", what: "global demand", url: fact("global-2024").url },
  { name: "Uisce Éireann", what: "water", url: water.url },
];
const counts = {
  facts: F.facts.length,
  claims: F.claims.length,
  policies: F.policies.length,
  trueFalse: Object.keys(F.trueFalse).length,
};

const D = {
  generatedFrom: ["data/survey_stats.json", "data/facts.js", "shared/survey.js"],
  factsChecked: F.checked,
  meta,
  cso: {
    source: cso.source,
    url: cso.url,
    years,
    first,
    last,
    urbanHomes: cso.compare2025.urbanHomes,
    allHomes: cso.compare2025.allHomes,
    ruralHomes: cso.compare2025.ruralHomes,
    projection2034: pctIn(fact("ie-share-2034").text, 0),
  },
  support,
  opposed,
  accept5km,
  fossil,
  renewables,
  paradox,
  greatDeal,
  greatDealQ24,
  room,
  conds: conds.map((c) => ({
    id: c.id,
    short: c.short,
    rating: c.rating,
    ratingPct: round(c.rating),
    pick: c.pick,
    pickPct: round(c.pick),
    rRank: c.rRank,
    pRank: c.pRank,
    nRating: c.nRating,
  })),
  nPick: q88.n_answered,
  mismatch: { pickedMore: up.id, ratedMore: down.id },
  samplePackage,
  sampleVote,
  nearby,
  strongSupp,
  bias,
  water: { text: water.text, source: water.source, url: water.url, share: pctIn(water.text, 0) },
  officialSources,
  counts,
};

const banner = `/* AUTO-GENERATED by scripts/build-data.mjs on ${new Date().toISOString().slice(0, 10)} - do not edit by hand.
 * Every number in the video comes from this file, which is computed from
 * ../data/survey_stats.json, ../data/facts.js and ../shared/survey.js. Re-run: npm run data */\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, banner + "export const D = " + JSON.stringify(D, null, 2) + " as const;\n");

// Human-readable audit to the console
const line = (k, v) => console.log(k.padEnd(46), v);
console.log("\nNumbers shown in the video (all computed):");
line("Survey respondents / questions", `${meta.respondents} / ${meta.questions}`);
line("CSO share 2015 -> 2025", `${first.pct}% -> ${last.pct}%  (urban homes ${cso.compare2025.urbanHomes}%)`);
line("q96 supportive", `${support.pct}% (n=${support.n})`);
line("q77 acceptable within 5 km", `${accept5km.pct}% (n=${accept5km.n})`);
line("q18 True / False / Don't know", `${fossil.true}% / ${fossil.false}% / ${fossil.dontKnow}% (n=${fossil.n})`);
line("SEAI renewables", `${renewables.pct}% (${renewables.year})`);
paradox.forEach((p) => line(`q18 True | q17 ${p.label}`, `${p.pct}% (n=${p.n})${p.small ? " SMALL" : ""}`));
line("Town hall (q77 scaled to 100)", room.map((r) => r.count).join(" / "));
conds.forEach((c) => line(`${c.id} ${c.short}`, `rated ${round(c.rating)}%  top-3 ${round(c.pick)}%  (ranks ${c.rRank} / ${c.pRank})`));
line("Mismatch picked-more / rated-more", `${up.id} / ${down.id}`);
line("Sample package vote (model)", `${samplePackage.join("+")} -> ${sampleVote.accepting}/100`);
line("q77 accept | q7 Yes / No", `${nearby.yes.pct}% (n=${nearby.yes.n}) / ${nearby.no.pct}% (n=${nearby.no.n})`);
Object.values(bias).forEach((b) => line(`${b.id} agree / disagree`, `${b.agree}% / ${b.disagree}% (n=${b.n})`));
line("Water share", `${D.water.share}%`);
console.log("\nWrote", path.relative(process.cwd(), out));

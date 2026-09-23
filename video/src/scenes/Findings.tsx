import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { pop, prog, tween } from "../anim";
import { Chip, Chrome, Count, Kind, SourceLine } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { C, EASE, F, SAFE } from "../theme";

/**
 * 06 WHAT WE DISCOVERED (dark) - five findings, each with its caveat and source.
 */
const INTRO = 80;
const LEN = [150, 230, 240, 210, 190];
export const FINDINGS_DURATION = INTRO + LEN.reduce((a, b) => a + b, 0);

const starts = LEN.map((_, i) => INTRO + LEN.slice(0, i).reduce((a, b) => a + b, 0));

/* ------------------------------------------------------------------ shared frame */
const FindingFrame: React.FC<{
  index: number;
  kicker: string;
  kind: Kind;
  headline: string;
  caveat?: string;
  source: string;
  children: React.ReactNode;
}> = ({ index, kicker, kind, headline, caveat, source, children }) => {
  const frame = useCurrentFrame();
  const len = LEN[index];
  const out = prog(frame, len - 14, 14, EASE.inOut);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, translate: `0 ${out * -30}px` }}>
      <div style={{ position: "absolute", left: SAFE.x, top: 140, width: 1680 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: prog(frame, 0, 14) }}>
          <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 24, color: C.neq, letterSpacing: "0.08em" }}>
            {String(index + 1).padStart(2, "0")} / {String(LEN.length).padStart(2, "0")}
          </span>
          <span style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 24, color: C.mutedDark, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {kicker}
          </span>
          <Chip kind={kind} dark size={18} />
        </div>
        <Words
          text={headline}
          start={4}
          stagger={2}
          accent={C.neq}
          style={{
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 60,
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
            color: C.white,
            marginTop: 22,
            maxWidth: 1600,
          }}
        />
      </div>
      {children}
      {caveat && (
        <div
          style={{
            position: "absolute",
            left: SAFE.x,
            right: SAFE.x,
            top: 930,
            display: "flex",
            alignItems: "center",
            gap: 16,
            opacity: prog(frame, 40, 16),
          }}
        >
          <Chip kind="caveat" label="Caveat" dark size={18} />
          <span style={{ fontFamily: F.display, fontSize: 30, color: C.white }}>{caveat}</span>
        </div>
      )}
      <SourceLine text={source} start={30} color={C.mutedDark} bottom={44} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 01 the 5 km gap */
const Gap: React.FC = () => {
  const frame = useCurrentFrame();
  const W = 1180;
  const rows = [
    { label: "Support sustainable data centres in Ireland", pct: D.support.pct, raw: D.support.raw, color: C.opinionDark, n: `q96 · ${D.support.n} answered` },
    { label: "Would accept one within 5 km of home", pct: D.accept5km.pct, raw: D.accept5km.raw, color: C.neq, n: `q77 · ${D.accept5km.n} answered` },
    {
      label: "…even among the strongly supportive",
      pct: D.strongSupp.pct,
      raw: D.strongSupp.raw,
      color: C.neq,
      n: `q96 × q77 · n = ${D.strongSupp.n}`,
    },
  ];
  return (
    <FindingFrame
      index={0}
      kicker="The 5 km gap"
      kind="opinion"
      headline={`**${D.support.pct}%** support sustainable data centres. Only **${D.accept5km.pct}%** would accept one near home.`}
      source={`Survey q96 and q77 · ${D.meta.respondents} people in Ireland (Maynooth University survey)`}
    >
      <div style={{ position: "absolute", left: SAFE.x, top: 440, width: 1680 }}>
        {rows.map((r, i) => {
          const p = tween(frame, [24 + i * 16, 60 + i * 16], [0, 1], EASE.out);
          const small = i === 2;
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "center", marginTop: i === 0 ? 0 : small ? 30 : 38 }}>
              <div style={{ width: 460, paddingRight: 30, textAlign: "right" }}>
                <div style={{ fontFamily: F.display, fontWeight: small ? 500 : 700, fontSize: small ? 28 : 32, lineHeight: 1.2, color: small ? C.mutedDark : C.white }}>
                  {r.label}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 19, color: C.mutedDark, marginTop: 6 }}>{r.n}</div>
              </div>
              <div style={{ position: "relative", width: W, height: small ? 44 : 84, background: C.inkRaised, borderRadius: 6 }}>
                <div style={{ width: (r.raw / 100) * W * p, height: "100%", background: r.color, borderRadius: 6, opacity: small ? 0.7 : 1 }} />
                <div
                  style={{
                    position: "absolute",
                    left: (r.raw / 100) * W * p + 18,
                    top: "50%",
                    translate: "0 -50%",
                    fontFamily: F.display,
                    fontWeight: 900,
                    fontSize: small ? 36 : 64,
                    color: C.white,
                    opacity: p,
                  }}
                >
                  {r.pct}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </FindingFrame>
  );
};

/* ------------------------------------------------------------------ 02 confidence paradox */
const Paradox: React.FC = () => {
  const frame = useCurrentFrame();
  const BASE = 800;
  const H = 300;
  const BW = 200;
  const GAPX = 110;
  const X0 = 330;
  const overall = D.fossil.rawTrue;
  return (
    <FindingFrame
      index={1}
      kicker="Confidence ≠ correctness"
      kind="assumption"
      headline={`Of those who said they know "a great deal" about data-centre energy, **${D.greatDeal.pct}%** believed a false claim.`}
      caveat={`"A great deal" is only ${D.greatDeal.n} people - a clue, not a law.`}
      source={`Survey q17 × q18 (${D.fossil.n} answered q18) · the claim checked against ${D.renewables.source}: ${D.renewables.pct}% of Irish electricity was renewable in ${D.renewables.year}`}
    >
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: 342,
          width: 1680,
          fontFamily: F.display,
          fontSize: 28,
          lineHeight: 1.3,
          color: C.mutedDark,
          opacity: prog(frame, 20, 16),
        }}
      >
        Said <span style={{ color: C.white }}>&ldquo;{D.fossil.statement}&rdquo;</span> is true (
        <span style={{ color: C.assumeDark }}>it&apos;s false</span>) - split by how much they feel they know.
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {/* overall reference */}
        <line
          x1={X0 - 30}
          x2={X0 + 5 * BW + 4 * GAPX + 30}
          y1={BASE - (overall / 100) * H}
          y2={BASE - (overall / 100) * H}
          stroke={C.mutedDark}
          strokeWidth={2}
          strokeDasharray="8 8"
          opacity={prog(frame, 30, 16)}
        />
        <text
          x={SAFE.x}
          y={BASE - (overall / 100) * H + 8}
          fontFamily={F.mono}
          fontSize={21}
          fill={C.mutedDark}
          opacity={prog(frame, 30, 16)}
        >
          everyone: {D.fossil.true}%
        </text>
        <line x1={X0 - 30} x2={X0 + 5 * BW + 4 * GAPX + 30} y1={BASE} y2={BASE} stroke={C.ruleDark} strokeWidth={2} />
        {D.paradox.map((g, i) => {
          const hot = i === D.paradox.length - 1;
          const p = tween(frame, [26 + i * 8, 62 + i * 8], [0, 1], EASE.out);
          const h = (g.raw / 100) * H * p;
          const x = X0 + i * (BW + GAPX);
          return (
            <g key={g.label}>
              <rect x={x} y={BASE - h} width={BW} height={h} rx={6} fill={hot ? C.assumeDark : "#3A3F4B"} />
              <text
                x={x + BW / 2}
                y={BASE - h - 16}
                textAnchor="middle"
                fontFamily={F.display}
                fontWeight={900}
                fontSize={hot ? 64 : 44}
                fill={hot ? C.white : C.mutedDark}
                stroke={C.ink}
                strokeWidth={10}
                paintOrder="stroke"
                strokeLinejoin="round"
                opacity={p}
              >
                {g.pct}%
              </text>
              <text x={x + BW / 2} y={BASE + 40} textAnchor="middle" fontFamily={F.display} fontWeight={700} fontSize={27} fill={C.white}>
                {g.label}
              </text>
              <text x={x + BW / 2} y={BASE + 72} textAnchor="middle" fontFamily={F.mono} fontSize={21} fill={C.mutedDark}>
                n = {g.n}
              </text>
              {g.small && (
                <g opacity={prog(frame, 60 + i * 4, 12)}>
                  <rect x={x + BW / 2 - 124} y={BASE - h - 110 - (hot ? 12 : 0)} width={248} height={34} rx={6} fill={C.ink} stroke={C.assumeDark} strokeWidth={2} />
                  <text
                    x={x + BW / 2}
                    y={BASE - h - 87 - (hot ? 12 : 0)}
                    textAnchor="middle"
                    fontFamily={F.mono}
                    fontSize={19}
                    fill={C.assumeDark}
                  >
                    small group (n = {g.n})
                  </text>
                </g>
              )}
            </g>
          );
        })}
        <text x={X0 - 30} y={BASE + 102} fontFamily={F.mono} fontSize={20} fill={C.mutedDark} opacity={prog(frame, 40, 16)}>
          ← feel they know less
        </text>
        <text
          x={X0 + 5 * BW + 4 * GAPX + 30}
          y={BASE + 102}
          textAnchor="end"
          fontFamily={F.mono}
          fontSize={20}
          fill={C.mutedDark}
          opacity={prog(frame, 40, 16)}
        >
          feel they know more →
        </text>
      </svg>
    </FindingFrame>
  );
};

/* ------------------------------------------------------------------ 03 rated vs chosen (slope chart) */
const RatedChosen: React.FC = () => {
  const frame = useCurrentFrame();
  const LX = 700;
  const RX = 1300;
  const Y0 = 860; // 0%
  const PX = 7.6; // px per percentage point
  const y = (v: number) => Y0 - v * PX;
  const hot: Record<string, string> = {
    [D.mismatch.ratedMore]: C.neq,
    [D.mismatch.pickedMore]: C.white,
  };
  const draw = tween(frame, [30, 80], [0, 1], EASE.inOut);
  const bills = D.conds.find((c) => c.id === D.mismatch.ratedMore)!;
  const renew = D.conds.find((c) => c.id === D.mismatch.pickedMore)!;
  const ratings = D.conds.map((c) => c.ratingPct);
  return (
    <FindingFrame
      index={2}
      kicker="Rated ≠ chosen"
      kind="opinion"
      headline="Asked one by one, every condition sounds good. Forced to pick three, real priorities appear."
      caveat="Picking three means the right-hand shares add up to more than 100%."
      source={`Survey q78-q87 (each condition rated on its own) and q88 (pick your top three, ${D.nPick} answered)`}
    >
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {[LX, RX].map((x) => (
          <line key={x} x1={x} x2={x} y1={y(0)} y2={y(60)} stroke={C.ruleDark} strokeWidth={2} />
        ))}
        {[0, 20, 40, 60].map((v) => (
          <g key={v}>
            <text x={LX - 24} y={y(v) + 7} textAnchor="end" fontFamily={F.mono} fontSize={19} fill="#6B7180" opacity={v < 60 ? 1 : 0}>
              {v}%
            </text>
            <line x1={LX - 10} x2={LX} y1={y(v)} y2={y(v)} stroke={C.ruleDark} strokeWidth={2} />
            <line x1={RX} x2={RX + 10} y1={y(v)} y2={y(v)} stroke={C.ruleDark} strokeWidth={2} />
          </g>
        ))}
        <text x={LX} y={y(60) - 34} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={22} fill={C.white} opacity={prog(frame, 16, 14)}>
          RATED ON ITS OWN
        </text>
        <text x={LX} y={y(60) - 10} textAnchor="middle" fontFamily={F.mono} fontSize={19} fill={C.mutedDark} opacity={prog(frame, 16, 14)}>
          &ldquo;large&rdquo; or &ldquo;fully accepting&rdquo;
        </text>
        <text x={RX} y={y(60) - 34} textAnchor="middle" fontFamily={F.mono} fontWeight={500} fontSize={22} fill={C.white} opacity={prog(frame, 16, 14)}>
          PICKED IN TOP THREE
        </text>
        <text x={RX} y={y(60) - 10} textAnchor="middle" fontFamily={F.mono} fontSize={19} fill={C.mutedDark} opacity={prog(frame, 16, 14)}>
          when forced to choose
        </text>
        {[...D.conds]
          .sort((a, b) => (hot[a.id] ? 1 : 0) - (hot[b.id] ? 1 : 0))
          .map((c) => {
            const col = hot[c.id] ?? "#4A505D";
            const x2 = LX + (RX - LX) * draw;
            const y2 = y(c.rating) + (y(c.pick) - y(c.rating)) * draw;
            return (
              <g key={c.id}>
                <line x1={LX} y1={y(c.rating)} x2={x2} y2={y2} stroke={col} strokeWidth={hot[c.id] ? 6 : 3} strokeLinecap="round" />
                <circle cx={LX} cy={y(c.rating)} r={hot[c.id] ? 9 : 6} fill={col} />
                <circle cx={x2} cy={y2} r={hot[c.id] ? 9 : 6} fill={col} opacity={draw} />
              </g>
            );
          })}
        {/* labels for the two biggest mismatches (computed in build-data) */}
        {[bills, renew].map((c) => {
          const col = hot[c.id];
          const p = prog(frame, 84, 16);
          return (
            <g key={c.id} opacity={p}>
              <text x={RX + 30} y={y(c.pick) + 10} fontFamily={F.display} fontWeight={700} fontSize={30} fill={col}>
                {c.short} · {c.pickPct}%
              </text>
            </g>
          );
        })}
      </svg>
      {/* left-hand annotation */}
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: 420,
          width: 470,
          fontFamily: F.display,
          fontSize: 30,
          lineHeight: 1.3,
          color: C.white,
          opacity: prog(frame, 60, 16),
        }}
      >
        Rated one by one, all ten conditions land between{" "}
        <b>
          {Math.min(...ratings)}% and {Math.max(...ratings)}%
        </b>
        .
        <div style={{ marginTop: 26, color: C.mutedDark }}>
          <span style={{ color: C.neq, fontWeight: 700 }}>{bills.short}</span> is rated highest ({bills.ratingPct}%) but picked
          by only {bills.pickPct}%. <span style={{ color: C.white, fontWeight: 700 }}>{renew.short}</span> is rated lowest (
          {renew.ratingPct}%) yet picked by {renew.pickPct}%.
        </div>
      </div>
    </FindingFrame>
  );
};

/* ------------------------------------------------------------------ 04 bias blind spot */
const BlindSpot: React.FC = () => {
  const frame = useCurrentFrame();
  const W = 1000;
  const rows = [
    { b: D.bias.q62, text: "My first impression of data centres has stayed with me" },
    { b: D.bias.q55, text: "News stories about excessive energy use strongly shaped my views" },
    { b: D.bias.q61, text: "Public protests have influenced my own views" },
  ];
  return (
    <FindingFrame
      index={3}
      kicker="The bias blind spot"
      kind="opinion"
      headline="Few people said biases shape their own views. Rigged lets you test that on yourself."
      caveat="These are self-reports - what people believe about themselves, not measured behaviour."
      source={`Survey q62, q55, q61 · "bias blind spot": Pronin, Lin & Ross (2002)`}
    >
      <div style={{ position: "absolute", left: SAFE.x, top: 420, width: 1680 }}>
        <div style={{ display: "flex", gap: 30, marginLeft: 680, marginBottom: 24, opacity: prog(frame, 20, 14) }}>
          {[
            ["Agree", C.opinionDark],
            ["Neither", "#5A6070"],
            ["Disagree", "#2E323C"],
          ].map(([l, c]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: F.mono, fontSize: 21, color: C.mutedDark }}>
              <span style={{ width: 18, height: 18, background: c, display: "inline-block", borderRadius: 3 }} />
              {l}
            </span>
          ))}
        </div>
        {rows.map((r, i) => {
          const p = tween(frame, [26 + i * 12, 64 + i * 12], [0, 1], EASE.out);
          const segs = [
            { v: r.b.agree, c: C.opinionDark, t: C.ink },
            { v: r.b.neither, c: "#5A6070", t: C.white },
            { v: r.b.disagree, c: "#2E323C", t: C.mutedDark },
          ];
          const tot = segs.reduce((s, x) => s + x.v, 0);
          return (
            <div key={r.b.id} style={{ display: "flex", alignItems: "center", marginTop: i ? 34 : 0 }}>
              <div style={{ width: 650, paddingRight: 30 }}>
                <div style={{ fontFamily: F.display, fontWeight: 500, fontSize: 30, lineHeight: 1.25, color: C.white }}>&ldquo;{r.text}&rdquo;</div>
                <div style={{ fontFamily: F.mono, fontSize: 19, color: C.mutedDark, marginTop: 6 }}>
                  {r.b.id} · {r.b.n} answered
                </div>
              </div>
              <div style={{ display: "flex", width: W * p, height: 76, borderRadius: 8, overflow: "hidden" }}>
                {segs.map((s, k) => (
                  <div
                    key={k}
                    style={{
                      width: `${(s.v / tot) * 100}%`,
                      background: s.c,
                      color: s.t,
                      fontFamily: F.display,
                      fontWeight: 900,
                      fontSize: k === 0 ? 40 : 30,
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 16,
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.v}%
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </FindingFrame>
  );
};

/* ------------------------------------------------------------------ 05 nearby != reassured */
const Waffle: React.FC<{ pct: number; color: string; start: number }> = ({ pct, color, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <svg width={420} height={420}>
      {Array.from({ length: 100 }, (_, i) => {
        const col = i % 10;
        const row = 9 - Math.floor(i / 10);
        const on = i < pct;
        const s = on ? pop(frame, fps, start + i * 0.6, { damping: 14, stiffness: 180 }) : 1;
        return (
          <circle key={i} cx={21 + col * 42} cy={21 + row * 42} r={on ? 15 * s : 5} fill={on ? color : "#3A3F4B"} />
        );
      })}
    </svg>
  );
};

const Nearby: React.FC = () => {
  const frame = useCurrentFrame();
  const cols = [
    { title: "Already have a data centre within 10 km", r: D.nearby.yes, color: C.neq, start: 26 },
    { title: "No data centre within 10 km", r: D.nearby.no, color: "#E8E9ED", start: 44 },
  ];
  return (
    <FindingFrame
      index={4}
      kicker="Nearby ≠ reassured"
      kind="opinion"
      headline="People who already live near a data centre were less willing to accept another one."
      caveat="A pattern, not a cause - people near data centres may also live in busier places."
      source={`Survey q7 × q77 (share answering "somewhat" or "completely acceptable" within 5 km)`}
    >
      <div style={{ position: "absolute", left: SAFE.x, top: 390, width: 1680, display: "flex", gap: 90 }}>
        {cols.map((c) => (
          <div key={c.title} style={{ display: "flex", gap: 40, alignItems: "center", opacity: prog(frame, c.start - 10, 14) }}>
            <Waffle pct={c.r.pct} color={c.color} start={c.start} />
            <div style={{ width: 330 }}>
              <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 120, lineHeight: 1, color: c.color }}>
                <Count from={0} to={c.r.pct} start={c.start} dur={40} suffix="%" />
              </div>
              <div style={{ fontFamily: F.display, fontSize: 28, lineHeight: 1.3, color: C.white, marginTop: 10 }}>
                would accept one within 5 km
              </div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 28, lineHeight: 1.3, color: C.mutedDark, marginTop: 14 }}>
                {c.title}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 21, color: C.mutedDark, marginTop: 8 }}>n = {c.r.n}</div>
            </div>
          </div>
        ))}
      </div>
    </FindingFrame>
  );
};

/* ------------------------------------------------------------------ intro + assembly */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const out = prog(frame, INTRO - 14, 14, EASE.inOut);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: "absolute", left: SAFE.x, top: 360, width: 1680 }}>
        <Words
          text="What we discovered"
          start={2}
          stagger={4}
          style={{ fontFamily: F.display, fontWeight: 900, fontSize: 150, letterSpacing: "-0.035em", lineHeight: 1, color: C.white }}
        />
        <Words
          text={`Five patterns in ${D.meta.respondents} people's answers - with the caveats.`}
          start={14}
          stagger={2}
          style={{ fontFamily: F.display, fontWeight: 500, fontSize: 48, color: C.mutedDark, marginTop: 28 }}
        />
      </div>
    </AbsoluteFill>
  );
};

const ProgressTicks: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 112, display: "flex", gap: 10 }}>
      {LEN.map((len, i) => {
        const p = tween(frame, [starts[i], starts[i] + len], [0, 1], [0, 0, 1, 1]);
        return (
          <div key={i} style={{ flex: 1, height: 4, background: C.ruleDark, borderRadius: 2, overflow: "hidden", opacity: prog(frame, INTRO - 10, 10) }}>
            <div style={{ width: `${p * 100}%`, height: "100%", background: C.neq }} />
          </div>
        );
      })}
    </div>
  );
};

export const Findings: React.FC = () => {
  const parts = [Gap, Paradox, RatedChosen, BlindSpot, Nearby];
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Chrome chapter="06 / What we discovered" color={C.mutedDark} rule={C.ruleDark} />
      <ProgressTicks />
      {starts.map((s) => (
        <Sfx key={s} name="tick" at={s + 2} volume={0.35} />
      ))}
      <Sequence durationInFrames={INTRO} name="Intro">
        <Intro />
      </Sequence>
      {parts.map((P, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={LEN[i]} name={`Finding ${i + 1}`} premountFor={15}>
          <P />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

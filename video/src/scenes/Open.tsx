import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, pop, prog, tween } from "../anim";
import { Chip, Chrome, Count, Kicker, Neq, SourceLine } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { BS, C, EASE, F, KM, RG, SAFE } from "../theme";

/**
 * 00 COLD OPEN + THESIS (dark)
 * A: the CSO line draws itself 2015 -> 2025 while the big number counts 5% -> 23%.
 * B: that 23% flies into the DATA card of the launcher's equation: DATA ≠ OPINION ≠ ASSUMPTION.
 * C: title.
 */
export const OPEN_DURATION = 780;

const years = D.cso.years;
const N = years.length;
// chart geometry
const X0 = SAFE.x;
const X1 = 1920 - SAFE.x;
const Y0 = 600;
const Y1 = 920;
const VMAX = 30;
const xAt = (i: number) => X0 + (i * (X1 - X0)) / (N - 1);
const yAt = (v: number) => Y1 - (v / VMAX) * (Y1 - Y0);

// equation cards
const CARD_TOP = 280;
const CARD_H = 560;
const NEQ_W = 110;
const CARD_W = (1920 - 2 * SAFE.x - 2 * NEQ_W) / 3;
const cardX = (i: number) => SAFE.x + i * (CARD_W + NEQ_W);
const NUM_TOP = CARD_TOP + 232;
const NUM_SIZE = 120;

// timeline (frames)
const T = {
  draw: [24, 170] as [number, number],
  headline: 150,
  upFrom: 205,
  refs: 250,
  exitChart: 345,
  fly: [350, 392] as [number, number],
  lead: 352,
  card1: 360,
  neq1: 440,
  card2: 452,
  neq2: 540,
  card3: 552,
  foot: 610,
  exitCards: 686,
  title: 700,
};

/** Frames at which the stepping year ticker advances (inverse of the draw tween, found by scanning). */
const yearTicks: number[] = (() => {
  const out: number[] = [];
  let last = 0;
  for (let f = T.draw[0]; f <= T.draw[1]; f++) {
    const idx = Math.floor(tween(f, T.draw, [0, 1], EASE.inOut) * (N - 1) + 1e-6);
    if (idx > last) {
      out.push(f);
      last = idx;
    }
  }
  return out;
})();

const valueAt = (p: number) => {
  const t = p * (N - 1);
  const i = Math.min(N - 2, Math.floor(t));
  return mix(years[i].pct, years[i + 1].pct, t - i);
};

const Chart: React.FC = () => {
  const frame = useCurrentFrame();
  const p = tween(frame, T.draw, [0, 1], EASE.inOut);
  const clipW = X0 + p * (X1 - X0);
  const line = years.map((y, i) => `${i === 0 ? "M" : "L"}${xAt(i)} ${yAt(y.pct)}`).join(" ");
  const area = `${line} L${X1} ${Y1} L${X0} ${Y1} Z`;
  const tipV = valueAt(p);
  const tipX = mix(X0, X1, p);
  const refs = prog(frame, T.refs, 24);
  const out = prog(frame, T.exitChart, 24, EASE.inOut);
  const refLine = (v: number, label: string, delay: number) => {
    const q = prog(frame, T.refs + delay, 24);
    return (
      <g opacity={q}>
        <line
          x1={X0}
          x2={mix(X0, X1, q)}
          y1={yAt(v)}
          y2={yAt(v)}
          stroke={C.mutedDark}
          strokeWidth={2}
          strokeDasharray="10 10"
        />
        <text x={X0 + 4} y={yAt(v) - 14} fill={C.mutedDark} fontFamily={F.mono} fontSize={22}>
          {label}
        </text>
      </g>
    );
  };
  return (
    <svg
      width={1920}
      height={1080}
      style={{ position: "absolute", opacity: 1 - out, translate: `0 ${out * 40}px` }}
    >
      <defs>
        <clipPath id="grow">
          <rect x={0} y={0} width={clipW} height={1080} />
        </clipPath>
        <linearGradient id="fillA" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={C.dataDark} stopOpacity={0.28} />
          <stop offset="1" stopColor={C.dataDark} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* baseline + year ticks */}
      <line x1={X0} x2={X1} y1={Y1} y2={Y1} stroke={C.ruleDark} strokeWidth={2} />
      {years.map((y, i) => {
        const on = prog(frame, T.draw[0] + (i / (N - 1)) * (T.draw[1] - T.draw[0]) - 4, 10);
        return (
          <g key={y.year} opacity={0.35 + 0.65 * on}>
            <line x1={xAt(i)} x2={xAt(i)} y1={Y1} y2={Y1 + 10} stroke={C.mutedDark} strokeWidth={2} />
            <text
              x={xAt(i)}
              y={Y1 + 44}
              textAnchor="middle"
              fill={C.mutedDark}
              fontFamily={F.mono}
              fontSize={22}
            >
              {y.year}
            </text>
          </g>
        );
      })}
      <g opacity={refs}>
        {refLine(D.cso.allHomes, `All homes in Ireland, ${D.cso.last.year}: ${D.cso.allHomes}%`, 0)}
        {refLine(D.cso.urbanHomes, `All urban homes, ${D.cso.last.year}: ${D.cso.urbanHomes}%`, 10)}
      </g>
      <g clipPath="url(#grow)">
        <path d={area} fill="url(#fillA)" />
        <path d={line} fill="none" stroke={C.dataDark} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
        {years.map((y, i) => (
          <circle key={y.year} cx={xAt(i)} cy={yAt(y.pct)} r={7} fill={C.ink} stroke={C.dataDark} strokeWidth={4} />
        ))}
      </g>
      {/* moving tip */}
      <circle cx={tipX} cy={yAt(tipV)} r={22} fill={C.dataDark} opacity={0.18} />
      <circle cx={tipX} cy={yAt(tipV)} r={11} fill={C.dataDark} />
      {/* end labels */}
      <text
        x={xAt(0)}
        y={yAt(years[0].pct) - 26}
        fill={C.white}
        fontFamily={F.mono}
        fontWeight={500}
        fontSize={26}
        opacity={prog(frame, T.draw[0], 12)}
      >
        {years[0].pct}%
      </text>
      <text
        x={xAt(N - 1)}
        y={yAt(years[N - 1].pct) - 28}
        textAnchor="end"
        fill={C.white}
        fontFamily={F.mono}
        fontWeight={500}
        fontSize={26}
        opacity={prog(frame, T.draw[1] - 4, 12)}
      >
        {years[N - 1].pct}%
      </text>
    </svg>
  );
};

type CardProps = {
  i: number;
  at: number;
  word: string;
  color: string;
  def: string;
  claim: React.ReactNode;
  src: string;
  number: React.ReactNode;
};

const Card: React.FC<CardProps> = ({ i, at, word, color, def, claim, src, number }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, 26);
  const exit = prog(frame, T.exitCards, 18, EASE.inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: cardX(i),
        top: CARD_TOP,
        width: CARD_W,
        height: CARD_H,
        borderRadius: 22,
        background: C.inkRaised,
        border: `1.5px solid ${C.ruleDark}`,
        padding: "34px 34px 30px",
        boxSizing: "border-box",
        opacity: p * (1 - exit),
        translate: `0 ${(1 - p) * 60 + exit * -30}px`,
      }}
    >
      <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 62, lineHeight: 1, letterSpacing: "-0.02em", color }}>
        {word}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 29, lineHeight: 1.3, color: C.mutedDark, marginTop: 16, height: 76 }}>
        {def}
      </div>
      <div style={{ borderTop: `2px dashed ${C.ruleDark}`, marginTop: 18 }} />
      <div
        style={{
          position: "absolute",
          left: 34,
          top: NUM_TOP - CARD_TOP,
          fontFamily: F.display,
          fontWeight: 900,
          fontSize: NUM_SIZE,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: C.white,
        }}
      >
        {number}
      </div>
      <div
        style={{
          position: "absolute",
          left: 34,
          right: 30,
          top: NUM_TOP - CARD_TOP + NUM_SIZE + 12,
          fontFamily: F.display,
          fontSize: 31,
          lineHeight: 1.28,
          color: C.white,
        }}
      >
        {claim}
      </div>
      <div
        style={{
          position: "absolute",
          left: 34,
          right: 30,
          bottom: 26,
          fontFamily: F.mono,
          fontSize: 20,
          color: C.mutedDark,
        }}
      >
        {src}
      </div>
    </div>
  );
};

/** Three tiny emblems of the games (bubble, planning notice, RIGGED stamp) - a teaser on the title card. */
const GameBadges: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (d: number) => pop(frame, fps, at + d, { damping: 12, stiffness: 150 });
  const b1 = s(0);
  const b2 = s(8);
  const b3 = s(16);
  const bob = Math.sin(frame / 22) * 6;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 1270,
          top: 250 + bob,
          width: 250,
          height: 250,
          borderRadius: "50%",
          border: `4px solid ${BS.data}`,
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(238,240,255,.12), rgba(127,162,255,.35) 72%, rgba(238,240,255,.18))`,
          boxShadow: `inset 0 0 50px rgba(31,91,255,.35)`,
          scale: `${b1}`,
          opacity: Math.min(1, b1 * 1.5),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 1470,
          top: 470,
          width: 300,
          padding: "22px 24px 24px",
          background: KM.notice,
          color: KM.ink,
          borderRadius: 4,
          rotate: `${-5 + (1 - b2) * -20}deg`,
          scale: `${b2}`,
          opacity: Math.min(1, b2 * 1.5),
          boxShadow: "0 22px 40px -22px rgba(0,0,0,.7)",
        }}
      >
        <div
          style={{
            fontFamily: F.archivoBlack,
            fontSize: 46,
            letterSpacing: "0.06em",
            lineHeight: 1,
            borderBottom: `4px solid ${KM.ink}`,
            paddingBottom: 10,
          }}
        >
          NOTICE
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 19, lineHeight: 1.35, marginTop: 12 }}>
          Proposed sustainable data centre within 5 km of this site
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1230,
          top: 700,
          padding: "10px 22px 6px",
          border: `6px solid ${RG.red}`,
          borderRadius: 10,
          color: RG.red,
          fontFamily: F.chivo,
          fontWeight: 900,
          fontSize: 66,
          letterSpacing: "0.12em",
          rotate: "-11deg",
          scale: `${1.5 - 0.5 * Math.min(1, b3)}`,
          opacity: Math.min(1, b3 * 2),
        }}
      >
        RIGGED
      </div>
    </>
  );
};

export const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const drawP = tween(frame, T.draw, [0, 1], EASE.inOut);
  // Only real (year, value) pairs are ever shown: the counter steps year by year with the line tip.
  const yearIdx = Math.min(N - 1, Math.floor(drawP * (N - 1) + 1e-6));
  const shownValue = years[yearIdx].pct;
  const shownYear = years[yearIdx].year;

  // the hero number flies from the chart header into the DATA card
  const fly = tween(frame, T.fly, [0, 1], EASE.inOut);
  const heroX = mix(SAFE.x - 8, cardX(0) + 34, fly);
  const heroY = mix(184, NUM_TOP, fly);
  const heroSize = mix(300, NUM_SIZE, fly);
  const heroIn = prog(frame, 6, 20);
  const heroGone = frame >= T.exitCards ? 1 - prog(frame, T.exitCards, 18, EASE.inOut) : 1;

  const topText = 1 - prog(frame, T.exitChart, 20, EASE.inOut);

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Chrome chapter="00 / Cold open" color={C.mutedDark} rule={C.ruleDark} />
      {frame < T.exitChart + 30 && <Chart />}

      {/* Phase A copy */}
      <div style={{ position: "absolute", left: SAFE.x, top: 138, opacity: topText }}>
        <Kicker color={C.mutedDark} start={8}>
          Data centres&apos; share of Ireland&apos;s metered electricity
        </Kicker>
      </div>
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 200,
          width: 1040,
          opacity: topText,
        }}
      >
        <Words
          text={`of Ireland's metered electricity went to data centres in ${D.cso.last.year}.`}
          start={T.headline}
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: 64, lineHeight: 1.12, color: C.white }}
        />
        <Words
          text={`Up from **${D.cso.first.pct}%** in ${D.cso.first.year}. More than all urban homes combined.`}
          start={T.upFrom}
          accent={C.dataDark}
          style={{ fontFamily: F.display, fontWeight: 500, fontSize: 40, lineHeight: 1.3, color: C.mutedDark, marginTop: 22 }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          top: 494,
          fontFamily: F.mono,
          fontSize: 30,
          color: C.dataDark,
          opacity: heroIn * topText,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {shownYear}
      </div>

      {/* hero number (chart header -> DATA card) */}
      <div
        style={{
          position: "absolute",
          left: heroX,
          top: heroY,
          fontFamily: F.display,
          fontWeight: 900,
          fontSize: heroSize,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: C.white,
          opacity: heroIn * heroGone,
          fontVariantNumeric: "tabular-nums",
          zIndex: 5,
        }}
      >
        {shownValue}%
      </div>

      <SourceLine
        text={`Source: ${D.cso.source}`}
        start={T.refs}
        end={T.exitChart + 20}
        color={C.mutedDark}
      />

      {/* Phase B: the equation */}
      {frame >= T.lead - 2 && (
        <>
          <div style={{ position: "absolute", left: SAFE.x, top: 150, width: 1680 }}>
            <Words
              text="Every headline mixes three kinds of number."
              start={T.lead}
              exitAt={T.exitCards}
              style={{ fontFamily: F.display, fontWeight: 700, fontSize: 60, lineHeight: 1.1, color: C.white }}
            />
          </div>
          <Card
            i={0}
            at={T.card1}
            word="Data"
            color={C.dataDark}
            def="Measured, with a source you can check."
            number={<span style={{ opacity: 0 }}>{D.cso.last.pct}%</span>}
            claim={`of Ireland's metered electricity went to data centres in ${D.cso.last.year}.`}
            src="Source: CSO"
          />
          <Card
            i={1}
            at={T.card2}
            word="Opinion"
            color={C.opinionDark}
            def="What people say they feel or want. Real, but not proof."
            number={<Count from={0} to={D.support.pct} start={T.card2 + 10} dur={34} suffix="%" />}
            claim={`of ${D.meta.respondents} people surveyed support sustainable data centres.`}
            src={`Survey q96 · ${D.support.n} answered`}
          />
          <Card
            i={2}
            at={T.card3}
            word="Assumption"
            color={C.assumeDark}
            def="Taken for granted without checking. Sometimes right."
            number={<Count from={0} to={D.fossil.true} start={T.card3 + 10} dur={34} suffix="%" />}
            claim={
              <>
                believed &ldquo;all data centres in Ireland run on fossil fuels&rdquo;.{" "}
                <span style={{ color: C.assumeDark, fontWeight: 700 }}>That&apos;s false.</span>
              </>
            }
            src="Survey q18 · checked against SEAI"
          />
          {[T.neq1, T.neq2].map((at, k) => (
            <div
              key={at}
              style={{
                position: "absolute",
                left: cardX(k) + CARD_W,
                width: NEQ_W,
                top: CARD_TOP + CARD_H / 2 - 60,
                textAlign: "center",
                opacity: 1 - prog(frame, T.exitCards, 18, EASE.inOut),
              }}
            >
              <Neq at={at} size={110} />
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              left: SAFE.x,
              top: CARD_TOP + CARD_H + 34,
              display: "flex",
              alignItems: "center",
              gap: 18,
              opacity: prog(frame, T.foot, 18) * (1 - prog(frame, T.exitCards, 18, EASE.inOut)),
            }}
          >
            <Chip kind="data" dark size={20} />
            <Chip kind="opinion" dark size={20} />
            <Chip kind="assumption" dark size={20} />
            <span style={{ fontFamily: F.mono, fontSize: 22, color: C.mutedDark, marginLeft: 8 }}>
              Every survey figure and fact in this video is calculated from the project&apos;s data files.
            </span>
          </div>
        </>
      )}

      {/* sound: a soft tick per year on the ticker, thumps for the ≠ signs, pops for the badges */}
      {yearTicks.map((f, i) => (
        <Sfx key={`y${i}`} name="tick" at={f} volume={0.22} />
      ))}
      <Sfx name="tick" at={T.card1} volume={0.3} />
      <Sfx name="thump" at={T.neq1} volume={0.42} />
      <Sfx name="thump" at={T.neq2} volume={0.42} />
      <Sfx name="pop" at={T.title + 27} volume={0.4} />
      <Sfx name="tick" at={T.title + 35} volume={0.35} />
      <Sfx name="thump" at={T.title + 43} volume={0.5} />

      {/* Phase C: title */}
      {frame >= T.title - 2 && <GameBadges at={T.title + 26} />}
      {frame >= T.title - 2 && (
        <div style={{ position: "absolute", left: SAFE.x, top: 330, width: 1100 }}>
          <Words
            text="Behind the headlines"
            start={T.title}
            stagger={5}
            dur={26}
            style={{
              fontFamily: F.display,
              fontWeight: 900,
              fontSize: 188,
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              color: C.white,
            }}
          />
          <Words
            text="Three browser games that make one survey playable."
            start={T.title + 18}
            stagger={2}
            style={{ fontFamily: F.display, fontWeight: 500, fontSize: 52, lineHeight: 1.2, color: C.mutedDark, marginTop: 34 }}
          />
          <div
            style={{
              marginTop: 48,
              fontFamily: F.mono,
              fontSize: 24,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: C.neq,
              opacity: prog(frame, T.title + 34, 18),
            }}
          >
            Data ≠ Opinion ≠ Assumption
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

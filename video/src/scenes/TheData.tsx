import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { pop, prog, tween } from "../anim";
import { Chrome, Count, Kicker } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { C, EASE, F, SAFE } from "../theme";

/**
 * 01 THE DATA (paper)
 * 200 dots = 200 respondents; a 104-bar "barcode" = 104 questions; then the official sources we
 * checked against, and the honesty rules every game follows.
 */
export const DATA_DURATION = 450;

const COLS = 20;
const CELL = 42;
const DOT = 26;
const GX = 960;
const GY = 196;
const BAR_Y = 660;
const BAR_W = COLS * CELL;

const T = {
  dots: [6, 70] as [number, number],
  people: 30,
  survey: 64,
  bars: [92, 150] as [number, number],
  sources: 176,
  rules: 262,
  cluster: 400,
};

export const TheData: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = D.meta.respondents;
  const q = D.meta.questions;

  // deterministic pop-in order for the dots
  const order = useMemo(() => {
    const idx = Array.from({ length: n }, (_, i) => i);
    return idx
      .map((i) => ({ i, k: random(`dot-${i}`) }))
      .sort((a, b) => a.k - b.k)
      .map((o) => o.i);
  }, [n]);
  const rank = useMemo(() => {
    const r: number[] = [];
    order.forEach((i, k) => (r[i] = k));
    return r;
  }, [order]);

  const dotStart = (i: number) => T.dots[0] + (rank[i] / n) * (T.dots[1] - T.dots[0]);
  const visible = order.filter((i) => frame >= dotStart(i)).length;

  const barsShown = Math.round(tween(frame, T.bars, [0, q], EASE.inOut));
  const exit = prog(frame, T.cluster, 40, EASE.inOut);

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Chrome chapter="01 / The data" color={C.muted} rule={C.rule} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} name="tick" at={T.rules + 12 + i * 22} volume={0.3} />
      ))}
      <Sfx name="pop" at={T.sources + 10} volume={0.25} />

      {/* left column */}
      <div style={{ position: "absolute", left: SAFE.x, top: 150, width: 800, opacity: 1 - exit }}>
        <Kicker color={C.muted} start={4}>
          The survey we made playable
        </Kicker>
        <div
          style={{
            fontFamily: F.display,
            fontWeight: 900,
            fontSize: 230,
            lineHeight: 0.9,
            letterSpacing: "-0.045em",
            color: C.ink,
            marginTop: 26,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {visible}
        </div>
        <Words
          text="people in Ireland,"
          start={T.people}
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: 56, color: C.ink, marginTop: 8 }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 6 }}>
          <Count
            from={0}
            to={q}
            start={T.bars[0]}
            dur={T.bars[1] - T.bars[0]}
            curve={EASE.inOut}
            style={{
              fontFamily: F.display,
              fontWeight: 900,
              fontSize: 56,
              color: C.neq,
              opacity: prog(frame, T.bars[0], 10),
            }}
          />
          <Words
            text="questions each."
            start={T.bars[0] + 4}
            style={{ fontFamily: F.display, fontWeight: 700, fontSize: 56, color: C.ink }}
          />
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: F.display,
            fontSize: 30,
            lineHeight: 1.35,
            color: C.muted,
            opacity: prog(frame, T.survey, 20),
            width: 760,
          }}
        >
          Maynooth University survey:{" "}
          <span style={{ color: C.ink, fontWeight: 700 }}>{D.meta.title}</span>
        </div>
      </div>

      {/* 200 dots */}
      <svg width={1920} height={1080} style={{ position: "absolute", opacity: 1 - exit * 0.9 }}>
        {Array.from({ length: n }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const s = pop(frame, fps, dotStart(i), { damping: 11, stiffness: 180 });
          const cx = GX + c * CELL + CELL / 2;
          const cy = GY + r * CELL + CELL / 2;
          // at the end the dots drift together, handing over to "what we made"
          const pull = exit * (1 + random(`pull-${i}`) * 0.6);
          const tx = cx + (1440 - cx) * pull * 0.5;
          const ty = cy + (560 - cy) * pull * 0.5;
          return <circle key={i} cx={tx} cy={ty} r={(DOT / 2) * s * (1 - exit * 0.6)} fill={C.ink} />;
        })}
        {/* 104-question barcode */}
        {Array.from({ length: q }, (_, i) => {
          const x = GX + (i + 0.5) * (BAR_W / q);
          const on = i < barsShown ? 1 : 0;
          const h = i % 10 === 9 ? 64 : 44;
          return (
            <rect
              key={i}
              x={x - 1.8}
              y={BAR_Y + (64 - h)}
              width={3.6}
              height={h * on}
              fill={i % 10 === 9 ? C.neq : C.ink}
              opacity={(1 - exit) * on}
            />
          );
        })}
        <text
          x={GX}
          y={BAR_Y + 104}
          fontFamily={F.mono}
          fontSize={22}
          fill={C.muted}
          opacity={prog(frame, T.bars[0], 16) * (1 - exit)}
        >
          q1
        </text>
        <text
          x={GX + BAR_W}
          y={BAR_Y + 104}
          textAnchor="end"
          fontFamily={F.mono}
          fontSize={22}
          fill={C.muted}
          opacity={prog(frame, T.bars[1] - 10, 16) * (1 - exit)}
        >
          q{q}
        </text>
      </svg>

      {/* bottom band: sources + rules */}
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          top: 818,
          display: "flex",
          gap: 60,
          opacity: 1 - exit,
        }}
      >
        <div style={{ width: 800 }}>
          <Kicker color={C.muted} start={T.sources} size={22}>
            Checked against official sources
          </Kicker>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>
            {D.officialSources.map((s, i) => {
              const p = pop(frame, fps, T.sources + 10 + i * 5, { damping: 14, stiffness: 170 });
              return (
                <span
                  key={s.name}
                  style={{
                    fontFamily: F.mono,
                    fontWeight: 500,
                    fontSize: 24,
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: `2px solid ${C.data}`,
                    color: C.data,
                    background: C.card,
                    scale: `${p}`,
                    opacity: Math.min(1, p * 1.4),
                  }}
                >
                  {s.name}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Kicker color={C.muted} start={T.rules} size={22}>
            Rules every game follows
          </Kicker>
          {[
            "Totals and cross-tabs only - no individual answers.",
            "Groups under 30 people get a small-group warning.",
            "No survey number typed by hand.",
          ].map((t, i) => {
            const p = prog(frame, T.rules + 12 + i * 22, 18);
            return (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginTop: i === 0 ? 16 : 8,
                  fontFamily: F.display,
                  fontWeight: 500,
                  fontSize: 30,
                  color: C.ink,
                  opacity: p,
                  translate: `${(1 - p) * 20}px 0`,
                }}
              >
                <svg width={28} height={28} viewBox="0 0 28 28" style={{ flex: "none" }}>
                  <circle cx={14} cy={14} r={13} fill={C.ink} />
                  <path d="M8 14.5l4 4 8-9" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
                </svg>
                {t}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

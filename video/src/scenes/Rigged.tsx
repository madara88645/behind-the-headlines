import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, pop, prog, shake, tween } from "../anim";
import { BrowserFrame, FootageVideo, hasFootage } from "../components/Footage";
import { Chip, Chrome, SourceLine } from "../components/ui";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { EASE, F, RG, SAFE } from "../theme";

/**
 * 05 RIGGED - experiment 01 (anchoring): the wheel spins and "happens" to land on a high number,
 * the player estimates, then the protocol sheet flips to the researcher's red-pen copy and the
 * RIGGED stamp thumps down.
 */
export const RIGGED_DURATION = 520;

// SAMPLE PLAY (same values as the game's own debug screen): a high anchor of 72 and an estimate of 38%.
const ANCHOR = 72;
const GUESS = 38;
const LOW: [number, number] = [6, 12];
const HIGH: [number, number] = [65, 85];

const T = {
  sheet: 6,
  spin: [26, 98] as [number, number],
  q: 104,
  less: 134,
  slide: [150, 178] as [number, number],
  lock: 186,
  flip: [198, 232] as [number, number],
  notes: 240,
  stamp: 286,
  truth: 304,
  line: 322,
  lab: 380,
};

const SHEET = { x: 690, y: 150, w: 1110, h: 830 };
const WHEEL = { cx: 300, cy: 440, r: 214 };

const GridPaper: React.FC = () => (
  <svg width={1920} height={1080} style={{ position: "absolute" }}>
    <defs>
      <pattern id="rg-grid" width={24} height={24} patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke={RG.grid} strokeWidth={1} />
      </pattern>
    </defs>
    <rect width={1920} height={1080} fill="url(#rg-grid)" />
  </svg>
);

const polar = (cx: number, cy: number, r: number, v: number) => {
  const a = (v / 100) * Math.PI * 2 - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx: number, cy: number, r: number, v0: number, v1: number) => {
  const [x0, y0] = polar(cx, cy, r, v0);
  const [x1, y1] = polar(cx, cy, r, v1);
  const large = (v1 - v0) / 100 > 0.5 ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
};

/** The wheel of fortune, numbers 0-100 around the rim. `rot` in degrees. */
const Wheel: React.FC<{ rot: number; annotate: number }> = ({ rot, annotate }) => {
  const { cx, cy, r } = WHEEL;
  const segs = 12;
  return (
    <svg width={620} height={720} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <g transform={`rotate(${rot} ${cx} ${cy})`}>
        <circle cx={cx} cy={cy} r={r + 6} fill="#fff" stroke={RG.ink} strokeWidth={4} />
        {Array.from({ length: segs }, (_, i) => {
          const v0 = (i / segs) * 100;
          const v1 = ((i + 1) / segs) * 100;
          const [x0, y0] = polar(cx, cy, r - 40, v0);
          const [x1, y1] = polar(cx, cy, r - 40, v1);
          const [dx, dy] = polar(cx, cy, r - 90, (v0 + v1) / 2);
          return (
            <g key={i}>
              <path
                d={`M${cx} ${cy} L${x0} ${y0} A${r - 40} ${r - 40} 0 0 1 ${x1} ${y1} Z`}
                fill={i % 2 ? "#2A3A5E" : RG.ink}
                stroke="#F4F7F5"
                strokeWidth={1.5}
              />
              <circle cx={dx} cy={dy} r={7} fill={RG.marker} />
            </g>
          );
        })}
        {Array.from({ length: 101 }, (_, v) => {
          const long = v % 10 === 0;
          const [x0, y0] = polar(cx, cy, r + 4, v);
          const [x1, y1] = polar(cx, cy, r - (long ? 18 : 8), v);
          return <line key={v} x1={x0} y1={y0} x2={x1} y2={y1} stroke={RG.ink} strokeWidth={long ? 3 : 1.4} />;
        })}
        {Array.from({ length: 10 }, (_, k) => {
          const v = k * 10;
          const [x, y] = polar(cx, cy, r - 30, v);
          return (
            <text
              key={v}
              x={x}
              y={y + 7}
              textAnchor="middle"
              fontFamily={F.chivoMono}
              fontWeight={700}
              fontSize={20}
              fill={RG.ink}
              transform={`rotate(${(v / 100) * 360} ${x} ${y})`}
            >
              {v}
            </text>
          );
        })}
        {/* red-pen marks on the researcher's copy: the only two ranges the wheel can land on */}
        <g opacity={annotate}>
          {[LOW, HIGH].map((rg, k) => {
            const d = arc(cx, cy, r + 22, rg[0], rg[1]);
            const len = (((rg[1] - rg[0]) / 100) * 2 * Math.PI * (r + 22)) + 2;
            const p = Math.min(1, Math.max(0, annotate * 1.4 - k * 0.3));
            return (
              <path
                key={k}
                d={d}
                fill="none"
                stroke={RG.red}
                strokeWidth={16}
                strokeOpacity={0.3}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={len * (1 - p)}
              />
            );
          })}
        </g>
        <circle cx={cx} cy={cy} r={34} fill="#fff" stroke={RG.ink} strokeWidth={4} />
        <circle cx={cx} cy={cy} r={10} fill={RG.ink} />
      </g>
      {/* pointer */}
      <path d={`M${cx - 16} ${cy - r - 34} L${cx + 16} ${cy - r - 34} L${cx} ${cy - r - 6} Z`} fill={RG.ink} />
    </svg>
  );
};

const Mono: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({
  children,
  color = RG.pencil,
  style,
}) => (
  <div
    style={{
      fontFamily: F.chivoMono,
      fontWeight: 500,
      fontSize: 21,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

const Highlight: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ position: "relative", display: "inline-block" }}>
    <span
      style={{
        position: "absolute",
        left: -4,
        right: -4,
        top: "18%",
        bottom: "4%",
        background: RG.marker,
        scale: `${p} 1`,
        transformOrigin: "left center",
        zIndex: 0,
      }}
    />
    <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
  </span>
);

const Front: React.FC<{ rot: number }> = ({ rot }) => {
  const frame = useCurrentFrame();
  const qP = prog(frame, T.q, 18);
  const lessP = prog(frame, T.less, 8);
  const slide = tween(frame, T.slide, [0, 1], EASE.inOut);
  const val = Math.round(mix(0, GUESS, slide));
  const SL = 420;
  return (
    <>
      <Wheel rot={rot} annotate={0} />
      <div style={{ position: "absolute", left: 600, top: 150, width: 440, opacity: qP }}>
        <Mono>Question A</Mono>
        <div style={{ fontFamily: F.chivo, fontWeight: 700, fontSize: 40, lineHeight: 1.2, color: RG.ink, marginTop: 12 }}>
          Do data centres use more or less than{" "}
          <Highlight p={prog(frame, T.q + 10, 12)}>{ANCHOR}%</Highlight> of Ireland&apos;s electricity?
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
          {["More", "Less"].map((b) => {
            const on = b === "Less" && lessP > 0.5;
            return (
              <span
                key={b}
                style={{
                  fontFamily: F.chivo,
                  fontWeight: 700,
                  fontSize: 28,
                  padding: "12px 34px",
                  border: `2.5px solid ${RG.ink}`,
                  borderRadius: 8,
                  background: on ? RG.ink : "transparent",
                  color: on ? "#fff" : RG.ink,
                }}
              >
                {b}
              </span>
            );
          })}
        </div>
        <Mono style={{ marginTop: 44, opacity: prog(frame, T.slide[0] - 10, 12) }}>Question B · your best estimate</Mono>
        <div style={{ position: "relative", width: SL, height: 70, marginTop: 20, opacity: prog(frame, T.slide[0] - 10, 12) }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 30, height: 4, background: RG.ink }} />
          {[0, 25, 50, 75, 100].map((v) => (
            <div key={v} style={{ position: "absolute", left: (v / 100) * SL - 1, top: 24, width: 2, height: 16, background: RG.ink }} />
          ))}
          <div
            style={{
              position: "absolute",
              left: (val / 100) * SL - 16,
              top: 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              background: RG.assume,
              border: `3px solid ${RG.ink}`,
              opacity: prog(frame, T.slide[0], 6),
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 6, opacity: prog(frame, T.slide[0], 10) }}>
          <span style={{ fontFamily: F.chivo, fontWeight: 900, fontSize: 64, color: RG.ink }}>
            <Highlight p={prog(frame, T.slide[1], 10)}>{val}%</Highlight>
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: F.chivo,
              fontWeight: 700,
              fontSize: 28,
              padding: "12px 26px",
              background: RG.ink,
              color: "#fff",
              borderRadius: 8,
              opacity: prog(frame, T.slide[1], 8),
              scale: `${frame >= T.lock && frame < T.lock + 6 ? 0.94 : 1}`,
            }}
          >
            Lock in →
          </span>
        </div>
      </div>
    </>
  );
};

const Back: React.FC<{ rot: number }> = ({ rot }) => {
  const frame = useCurrentFrame();
  const notes = prog(frame, T.notes, 34, EASE.inOut);
  const truthP = prog(frame, T.truth, 16);
  const lineP = prog(frame, T.line, 20);
  const LINE = 440;
  const mark = (v: number, color: string, label: string, delay: number, above: boolean) => {
    const p = prog(frame, T.line + delay, 12);
    return (
      <div style={{ position: "absolute", left: (v / 100) * LINE, top: 0, opacity: p }}>
        <div
          style={{
            position: "absolute",
            left: -11,
            top: 18,
            width: 22,
            height: 22,
            borderRadius: 11,
            background: color,
            border: "3px solid #fff",
            scale: `${p}`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: above ? -26 : 50,
            translate: "-50% 0",
            whiteSpace: "nowrap",
            fontFamily: F.chivoMono,
            fontWeight: 700,
            fontSize: 20,
            color,
          }}
        >
          {label}
        </div>
      </div>
    );
  };
  return (
    <>
      <Wheel rot={rot} annotate={notes} />
      {/* handwritten range labels */}
      {[LOW, HIGH].map((rg, k) => {
        // place each note just outside its red arc (wheel is rotated so ANCHOR sits under the pointer)
        const mid = (rg[0] + rg[1]) / 2;
        const ang = (((mid - ANCHOR) / 100) * 360 * Math.PI) / 180;
        const R = WHEEL.r + 80;
        const x = WHEEL.cx + R * Math.sin(ang);
        const y = WHEEL.cy - R * Math.cos(ang);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: x,
              top: y,
              translate: "-50% -50%",
              fontFamily: F.caveat,
              fontWeight: 700,
              fontSize: 46,
              color: RG.red,
              whiteSpace: "nowrap",
              opacity: prog(frame, T.notes + 10 + k * 8, 10),
              rotate: "-6deg",
            }}
          >
            {rg[0]}–{rg[1]}
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 600, top: 130, width: 450 }}>
        <Mono>Debrief · experiment 01</Mono>
        <div style={{ fontFamily: F.chivo, fontWeight: 900, fontSize: 76, letterSpacing: "-0.03em", color: RG.ink, marginTop: 6 }}>
          The wheel
        </div>
        <div
          style={{
            fontFamily: F.caveat,
            fontWeight: 700,
            fontSize: 50,
            lineHeight: 1.05,
            color: RG.red,
            marginTop: 8,
            clipPath: `inset(0 ${100 - notes * 100}% 0 0)`,
          }}
        >
          It only ever lands on <span style={{ whiteSpace: "nowrap" }}>{LOW[0]}–{LOW[1]}</span> or{" "}
          <span style={{ whiteSpace: "nowrap" }}>
            {HIGH[0]}–{HIGH[1]}.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30, opacity: truthP }}>
          <Mono color={RG.ink}>The truth</Mono>
          <Chip kind="data" size={17} font={F.chivoMono} colors={{ data: RG.data }} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, opacity: truthP }}>
          <span style={{ fontFamily: F.chivo, fontWeight: 900, fontSize: 112, lineHeight: 1, color: RG.data, letterSpacing: "-0.04em" }}>
            {D.cso.last.pct}%
          </span>
          <span style={{ fontFamily: F.chivo, fontSize: 25, lineHeight: 1.25, color: RG.ink, paddingBottom: 12 }}>
            of metered electricity, {D.cso.last.year}. Source: CSO
          </span>
        </div>
        <div style={{ position: "relative", width: LINE, height: 80, marginTop: 34, opacity: lineP }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 28, height: 3, background: RG.ink }} />
          {mark(D.cso.last.pct, RG.data, `Truth ${D.cso.last.pct}%`, 0, true)}
          {mark(GUESS, RG.assume, `You ${GUESS}%`, 6, false)}
          {mark(ANCHOR, RG.red, `Anchor ${ANCHOR}`, 12, true)}
        </div>
      </div>
    </>
  );
};

const Recreation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sheetIn = pop(frame, fps, T.sheet, { damping: 16, stiffness: 110 });
  // spin: 3 full turns, then stop with ANCHOR under the pointer
  const spin = tween(frame, T.spin, [0, 1], [0.12, 0.8, 0.25, 1]);
  const rot = -(3 * 360 + (ANCHOR / 100) * 360) * spin;
  const flip = tween(frame, T.flip, [0, 180], EASE.inOut);
  const sh = shake(frame, T.stamp + 4, 7, 12);
  const stamp = prog(frame, T.stamp, 9, EASE.in);
  const backSide = flip > 90;
  return (
    <>
    <Sfx name="ratchet" at={T.spin[0]} volume={0.55} />
    <Sfx name="tick" at={T.less} volume={0.35} />
    <Sfx name="tick" at={T.lock} volume={0.35} />
    <Sfx name="flick" at={T.flip[0] + 4} volume={0.6} />
    <Sfx name="thump" at={T.stamp + 7} volume={0.8} />
    <div
      style={{
        position: "absolute",
        left: SHEET.x + sh.x,
        top: SHEET.y + sh.y,
        width: SHEET.w,
        height: SHEET.h,
        perspective: 2600,
        translate: `0 ${(1 - sheetIn) * 700}px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          rotate: `y ${backSide ? flip - 180 : flip}deg`,
          background: RG.sheet,
          border: `1.5px solid ${RG.grid}`,
          borderRadius: 8,
          boxShadow: "0 30px 60px -36px rgba(20,33,61,.5)",
          overflow: "hidden",
        }}
      >
        {/* margin line + punch holes */}
        <div style={{ position: "absolute", left: 60, top: 0, bottom: 0, width: 2, background: "#F2B8B8" }} />
        {[200, 620].map((y) => (
          <div key={y} style={{ position: "absolute", left: 20, top: y, width: 22, height: 22, borderRadius: 11, background: RG.paper }} />
        ))}
        <div
          style={{
            position: "absolute",
            left: 90,
            right: 40,
            top: 36,
            display: "flex",
            justifyContent: "space-between",
            borderBottom: `1.5px solid ${RG.grid}`,
            paddingBottom: 18,
          }}
        >
          <Mono color={RG.ink}>Experiment 01 · anchoring · participant #0427</Mono>
          <Mono color={backSide ? RG.red : RG.pencil}>{backSide ? "Researcher's copy" : "Protocol"}</Mono>
        </div>
        <div style={{ position: "absolute", left: 60, top: 0, right: 0, bottom: 0 }}>
          {backSide ? <Back rot={rot} /> : <Front rot={rot} />}
        </div>
      </div>
      {/* RIGGED stamp */}
      <div
        style={{
          position: "absolute",
          right: 54,
          top: 668,
          padding: "10px 28px 6px",
          border: `8px solid ${RG.red}`,
          borderRadius: 12,
          color: RG.red,
          fontFamily: F.chivo,
          fontWeight: 900,
          fontSize: 82,
          letterSpacing: "0.12em",
          rotate: `${mix(-16, -9, stamp)}deg`,
          scale: `${mix(1.5, 1, stamp)}`,
          opacity: stamp * 0.92,
          mixBlendMode: "multiply",
        }}
      >
        RIGGED
      </div>
    </div>
    </>
  );
};

const LEFT_STEPS = ["Spin the wheel.", "Answer a question about electricity.", "Read the researcher's copy."];

export const Rigged: React.FC<{ footage?: "auto" | "off"; footageStartAt?: number }> = ({
  footage = "auto",
  footageStartAt = 0,
}) => {
  const frame = useCurrentFrame();
  const useReal = footage === "auto" && hasFootage("rigged");
  const active = frame < T.q ? 0 : frame < T.flip[0] ? 1 : 2;
  const labSwap = prog(frame, T.lab, 18, EASE.inOut);
  return (
    <AbsoluteFill style={{ background: RG.paper }}>
      <GridPaper />
      <Chrome chapter="05 / Game 3 · Rigged" color={RG.pencil} rule={RG.grid} font={F.chivoMono} />
      <div style={{ position: "absolute", left: SAFE.x, top: 140, width: 520 }}>
        <div
          style={{
            fontFamily: F.chivo,
            fontWeight: 900,
            fontSize: 132,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            color: RG.ink,
            opacity: prog(frame, 0, 16),
          }}
        >
          Rigged
        </div>
        <div style={{ fontFamily: F.chivo, fontWeight: 700, fontSize: 38, lineHeight: 1.2, color: RG.ink, marginTop: 20, opacity: prog(frame, 6, 16) }}>
          Three experiments. All of them fixed.
        </div>
        <div style={{ position: "relative", marginTop: 60 }}>
          <div style={{ opacity: 1 - labSwap, position: "absolute", width: 520 }}>
            <Mono style={{ opacity: prog(frame, 12, 14) }}>What you do</Mono>
            {LEFT_STEPS.map((s, i) => {
              const on = useReal || i === active;
              return (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    gap: 16,
                    marginTop: 20,
                    opacity: prog(frame, 16 + i * 5, 16) * (on ? 1 : 0.4),
                  }}
                >
                  <span
                    style={{
                      flex: "none",
                      width: 44,
                      height: 44,
                      borderRadius: 6,
                      border: `2.5px solid ${RG.ink}`,
                      background: on ? RG.ink : "transparent",
                      color: on ? "#fff" : RG.ink,
                      fontFamily: F.chivoMono,
                      fontWeight: 700,
                      fontSize: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: F.chivo, fontWeight: on ? 700 : 400, fontSize: 31, lineHeight: 1.25, color: RG.ink, paddingTop: 3 }}>
                    {s}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ opacity: labSwap, position: "absolute", width: 520 }}>
            <Mono>Also in the lab</Mono>
            {[
              ["02 · The feed", "8 posts - 6 of them picked to alarm you. Then: guess the water numbers."],
              ["03 · The crowd", "A fake “live” bar puts 80% of “players” on one side. Does your answer move?"],
            ].map(([h, t], i) => (
              <div key={h} style={{ marginTop: 22, opacity: prog(frame, T.lab + 6 + i * 10, 14) }}>
                <div style={{ fontFamily: F.chivo, fontWeight: 900, fontSize: 32, color: RG.ink }}>{h}</div>
                <div style={{ fontFamily: F.chivo, fontSize: 28, lineHeight: 1.3, color: RG.ink, marginTop: 4 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {useReal ? (
        <div style={{ position: "absolute", left: SHEET.x, top: SHEET.y, opacity: prog(frame, 4, 16) }}>
          <BrowserFrame width={SHEET.w} height={SHEET.h - 20} url="rigged.html">
            <FootageVideo id="rigged" startAt={footageStartAt} />
          </BrowserFrame>
        </div>
      ) : (
        <Recreation />
      )}
      <SourceLine
        text={
          useReal
            ? "Gameplay recording"
            : "Recreated from the game · anchor 72 and estimate 38% are a sample run · truth: CSO 2025"
        }
        start={20}
        color={RG.pencil}
        font={F.chivoMono}
        bottom={40}
      />
    </AbsoluteFill>
  );
};

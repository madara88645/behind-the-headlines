import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { gulp, mix, pop, prog, tween } from "../anim";
import { BrowserFrame, FootageVideo, hasFootage } from "../components/Footage";
import { Chip, Chrome, SourceLine } from "../components/ui";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { BS, EASE, F, SAFE } from "../theme";

/**
 * 03 BUBBLE SORT - recreation of the game's core loop in its own design language:
 * read a claim -> bet -> drop it into a soap bubble (gulp!) -> reveal with the evidence and the survey split.
 */
export const BUBBLE_DURATION = 420;

const T = {
  bubbles: 4,
  card: 18,
  step2: 72,
  bet: [84, 124] as [number, number],
  step3: 132,
  lift: 134,
  fly: [146, 178] as [number, number],
  step4: 196,
  sheet: 198,
  verdict: 206,
  fact: 226,
  bar: 256,
};

const PLAY_CX = 1270;
const BUB_Y = 812;
const BUB_D = 272;
const BUBBLES = [
  { key: "DATA", color: BS.data, ink: BS.data, x: PLAY_CX - 330, hint: "Measured, with a source" },
  { key: "OPINION", color: BS.opinion, ink: BS.opinion, x: PLAY_CX, hint: "A judgement, can't be proven" },
  { key: "ASSUMPTION", color: BS.assume, ink: BS.assumeInk, x: PLAY_CX + 330, hint: "Checkable, no evidence given" },
];

/** Soap bubble with a slowly turning iridescent sheen, a rim in its colour and a specular highlight. */
const SoapBubble: React.FC<{
  x: number;
  y: number;
  d: number;
  color: string;
  ink: string;
  label: string;
  n: number;
  enter: number;
  squash: [number, number];
  glow: number;
}> = ({ x, y, d, color, ink, label, n, enter, squash, glow }) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 24 + n * 2.1) * 7;
  const turn = frame * 0.9 + n * 80;
  return (
    <div
      style={{
        position: "absolute",
        left: x - d / 2,
        top: y - d / 2 + bob + (1 - enter) * 320,
        width: d,
        height: d,
        scale: `${squash[0] * (1 + glow * 0.06)} ${squash[1] * (1 + glow * 0.06)}`,
        opacity: Math.min(1, enter * 1.4),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          background:
            "radial-gradient(circle at 50% 56%, rgba(255,255,255,.08), rgba(255,255,255,.55) 68%, rgba(255,255,255,.22))",
          boxShadow: `inset 0 0 ${d / 5}px ${color}55, 0 0 ${30 * glow}px ${color}66`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: "50%",
          opacity: 0.32,
          background: `conic-gradient(from ${turn}deg, rgba(255,90,200,0), rgba(90,200,255,.55), rgba(255,236,120,.45), rgba(255,90,200,.5), rgba(90,200,255,0))`,
          maskImage: "radial-gradient(circle, transparent 58%, black 72%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: d * 0.2,
          top: d * 0.14,
          width: d * 0.2,
          height: d * 0.12,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,255,255,.95), rgba(255,255,255,0) 70%)",
          rotate: "-30deg",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: d * 0.2,
          bottom: d * 0.14,
          width: d * 0.1,
          height: d * 0.05,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,255,255,.8), rgba(255,255,255,0) 70%)",
          rotate: "-30deg",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <div style={{ fontFamily: F.bricolage, fontWeight: 800, fontSize: 30, letterSpacing: "0.03em", color: ink }}>
          {label}
        </div>
        <div
          style={{
            fontFamily: F.jetbrains,
            fontSize: 20,
            color: ink,
            border: `2px solid ${color}88`,
            borderRadius: 7,
            padding: "1px 9px",
            background: "rgba(255,255,255,.7)",
          }}
        >
          {n + 1}
        </div>
      </div>
    </div>
  );
};

const STEPS = [
  "Read a claim.",
  "Bet how sure you are.",
  "Drop it in a bubble.",
  `See the evidence - and what ${D.meta.respondents} people said.`,
];

const Steps: React.FC<{ active: number; startAt: number }> = ({ active, startAt }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          fontFamily: F.jetbrains,
          fontSize: 22,
          letterSpacing: "0.1em",
          color: BS.muted,
          opacity: prog(frame, startAt, 16),
        }}
      >
        WHAT YOU DO
      </div>
      {STEPS.map((s, i) => {
        const p = prog(frame, startAt + 6 + i * 5, 18);
        // active < 0 (real footage playing): show every step at full strength
        const on = active < 0 || i === active;
        const done = i < active;
        return (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 18,
              opacity: p * (on ? 1 : done ? 0.55 : 0.4),
              translate: `${(1 - p) * -20}px 0`,
            }}
          >
            <div
              style={{
                flex: "none",
                width: 46,
                height: 46,
                borderRadius: 23,
                background: on ? BS.ink : "transparent",
                border: `2.5px solid ${BS.ink}`,
                color: on ? "#fff" : BS.ink,
                fontFamily: F.bricolage,
                fontWeight: 800,
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily: F.atkinson,
                fontWeight: on ? 700 : 400,
                fontSize: 32,
                lineHeight: 1.25,
                color: BS.ink,
                paddingTop: 4,
              }}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BET = [
  { label: "Hunch", pts: "1 pt", dots: 1 },
  { label: "Fairly sure", pts: "2 pts", dots: 2 },
  { label: "Certain", pts: "3 pts", dots: 3 },
];

const Recreation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardIn = pop(frame, fps, T.card, { damping: 15, stiffness: 120 });
  const fly = tween(frame, T.fly, [0, 1], EASE.inOut);
  const lift = prog(frame, T.lift, 10);
  const target = BUBBLES[2];
  const cardX = mix(PLAY_CX, target.x, fly);
  const cardY = mix(318, BUB_Y, tween(frame, T.fly, [0, 1], EASE.in)) - lift * 14 * (1 - fly);
  const cardScale = mix(1 + lift * 0.03, 0.1, fly);
  const cardOpacity = 1 - prog(frame, T.fly[1] - 6, 6);

  // bet selector slides Hunch -> Fairly sure -> Certain
  const betPos = tween(frame, [T.bet[0], T.bet[0] + 16], [0, 1], EASE.out) + tween(frame, [T.bet[0] + 22, T.bet[1]], [0, 1], EASE.out);
  const betIdx = Math.round(betPos);
  const SEG = 262;
  const pillW = SEG * 3 + 12;

  const sheet = pop(frame, fps, T.sheet, { damping: 18, stiffness: 110 });
  const barP = tween(frame, [T.bar, T.bar + 30], [0, 1], EASE.out);
  const glow = tween(frame, [T.fly[0] + 10, T.fly[1] - 4], [0, 1]) * (1 - prog(frame, T.fly[1] + 6, 10));
  const seg = [
    { label: "True", pct: D.fossil.true, raw: D.fossil.rawTrue, color: BS.assume, text: BS.ink },
    { label: "False", pct: D.fossil.false, raw: D.fossil.rawFalse, color: BS.ink, text: "#fff" },
    { label: "Don't know", pct: D.fossil.dontKnow, raw: D.fossil.rawDontKnow, color: "#C9CBE3", text: BS.ink },
  ];
  const BAR_W = 900;
  const sink = prog(frame, T.sheet - 4, 22, EASE.inOut);

  return (
    <>
      <Sfx name="tick" at={T.card + 4} volume={0.3} />
      <Sfx name="tick" at={T.bet[0] + 4} volume={0.28} />
      <Sfx name="tick" at={T.bet[0] + 26} volume={0.28} />
      <Sfx name="pop" at={T.fly[1] - 3} volume={0.75} />
      <Sfx name="whoosh" at={T.sheet - 6} volume={0.3} />
      {/* progress row */}
      <div
        style={{
          position: "absolute",
          left: 760,
          right: SAFE.x,
          top: 140,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: prog(frame, T.card, 16),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: F.jetbrains, fontSize: 22, letterSpacing: "0.08em", color: BS.muted }}>
            CARD 4 OF 12
          </span>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              style={{
                width: i === 3 ? 16 : 11,
                height: i === 3 ? 16 : 11,
                borderRadius: 8,
                background: i < 3 ? BS.ink : i === 3 ? BS.data : "#D5D8F2",
                display: "inline-block",
              }}
            />
          ))}
        </div>
        <Chip kind="sample" size={18} font={F.jetbrains} colors={{ sample: BS.muted }} />
      </div>

      {/* bubbles */}
      {BUBBLES.map((b, i) => {
        const enter = pop(frame, fps, T.bubbles + i * 5, { damping: 13, stiffness: 90 });
        const sq = i === 2 ? gulp(frame, T.fly[1] - 2, fps) : ([1, 1] as [number, number]);
        return (
          <div key={b.key} style={{ position: "absolute", inset: 0, translate: `0 ${sink * 360}px`, opacity: 1 - sink }}>
            <SoapBubble
              x={b.x}
              y={BUB_Y}
              d={BUB_D}
              color={b.color}
              ink={b.ink}
              label={b.key}
              n={i}
              enter={enter}
              squash={sq}
              glow={i === 2 ? glow : 0}
            />
            <div
              style={{
                position: "absolute",
                left: b.x - 170,
                width: 340,
                top: BUB_Y + BUB_D / 2 + 14,
                textAlign: "center",
                fontFamily: F.atkinson,
                fontSize: 24,
                color: BS.muted,
                opacity: prog(frame, T.bubbles + 10 + i * 5, 16),
              }}
            >
              {b.hint}
            </div>
          </div>
        );
      })}

      {/* bet selector */}
      <div
        style={{
          position: "absolute",
          left: PLAY_CX - pillW / 2,
          top: 520,
          width: pillW,
          opacity: prog(frame, T.bet[0] - 14, 14) * (1 - prog(frame, T.lift, 10)),
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontFamily: F.atkinson,
            fontWeight: 700,
            fontSize: 26,
            color: BS.muted,
            marginBottom: 12,
          }}
        >
          How sure are you?
        </div>
        <div
          style={{
            position: "relative",
            height: 72,
            borderRadius: 36,
            background: "#fff",
            border: "2px solid #D5D8F2",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 6 + betPos * SEG,
              width: SEG - 2,
              height: 58,
              borderRadius: 29,
              background: BS.ink,
            }}
          />
          {BET.map((b, i) => (
            <div
              key={b.label}
              style={{
                position: "absolute",
                top: 5,
                left: 6 + i * SEG,
                width: SEG,
                height: 58,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: i === betIdx ? "#fff" : BS.ink,
                fontFamily: F.atkinson,
                fontWeight: 700,
                fontSize: 25,
              }}
            >
              <span style={{ display: "inline-flex", gap: 3 }}>
                {Array.from({ length: b.dots }, (_, k) => (
                  <span
                    key={k}
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 5,
                      background: i === betIdx ? "#fff" : BS.ink,
                      display: "inline-block",
                    }}
                  />
                ))}
              </span>
              {b.label}
              <span style={{ fontFamily: F.jetbrains, fontWeight: 400, fontSize: 18, opacity: 0.8 }}>{b.pts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* the claim card */}
      <div
        style={{
          position: "absolute",
          left: cardX - 400,
          top: cardY - 130 - (1 - cardIn) * 420,
          width: 800,
          scale: `${cardScale}`,
          rotate: `${mix(-2, 18, fly)}deg`,
          opacity: cardOpacity * Math.min(1, cardIn * 1.5),
          background: BS.card,
          border: `3px solid ${BS.ink}`,
          borderRadius: 22,
          padding: "30px 40px 26px",
          boxShadow: "0 30px 60px -30px rgba(27,27,58,.45), 0 10px 0 -4px #fff, 0 12px 0 -2px #D5D8F2",
        }}
      >
        <div style={{ fontFamily: F.bricolage, fontWeight: 800, fontSize: 64, lineHeight: 0.6, color: "#D5D8F2" }}>
          &ldquo;
        </div>
        <div
          style={{
            fontFamily: F.bricolage,
            fontWeight: 800,
            fontSize: 50,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: BS.ink,
            marginTop: 8,
          }}
        >
          {D.fossil.statement}.
        </div>
        <div style={{ borderTop: "2px dashed #D5D8F2", marginTop: 22, paddingTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={BS.muted} strokeWidth={2}>
            <path d="M4 5h16v10H9l-5 4z" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: F.jetbrains, fontSize: 22, color: BS.muted }}>Heard in conversation</span>
        </div>
      </div>

      {/* reveal sheet */}
      <div
        style={{
          position: "absolute",
          left: 770,
          width: 1030,
          top: mix(1100, 250, sheet),
          height: 560,
          background: "#fff",
          borderRadius: 28,
          border: `3px solid ${BS.ink}`,
          boxShadow: "0 30px 70px -30px rgba(27,27,58,.5)",
          padding: "34px 44px",
          boxSizing: "border-box",
          opacity: frame >= T.sheet ? 1 : 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: prog(frame, T.verdict, 14) }}>
          <svg width={40} height={40} viewBox="0 0 40 40">
            <circle cx={20} cy={20} r={19} fill={BS.right} />
            <path d="M11 20.5l6 6 12-13" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: F.bricolage, fontWeight: 800, fontSize: 46, color: BS.right }}>
            Right: it&apos;s an assumption.
          </span>
          <span style={{ marginLeft: "auto" }}>
            <Chip kind="assumption" size={20} font={F.jetbrains} colors={{ assumption: BS.assumeInk }} />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginTop: 40, opacity: prog(frame, T.fact, 16) }}>
          <span
            style={{
              flex: "none",
              fontFamily: F.jetbrains,
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: "0.08em",
              color: "#fff",
              background: BS.wrong,
              padding: "8px 14px",
              borderRadius: 8,
              marginTop: 4,
            }}
          >
            {D.fossil.verdictTag.toUpperCase()}
          </span>
          <div>
            <div style={{ fontFamily: F.atkinson, fontSize: 36, lineHeight: 1.3, color: BS.ink }}>{D.fossil.short}</div>
            <div style={{ fontFamily: F.jetbrains, fontSize: 19, color: BS.muted, marginTop: 10 }}>
              Source: {D.fossil.sourceLabel}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 44, opacity: prog(frame, T.bar - 6, 14) }}>
          <div style={{ fontFamily: F.atkinson, fontSize: 32, color: BS.ink }}>
            In the survey, <b>{D.fossil.true}%</b> said this was true, {D.fossil.false}% false, {D.fossil.dontKnow}% didn&apos;t know.
          </div>
          <div style={{ display: "flex", marginTop: 14, width: BAR_W, height: 56, borderRadius: 12, overflow: "hidden" }}>
            {seg.map((s) => (
              <div
                key={s.label}
                style={{
                  width: (s.raw / 100) * BAR_W * barP,
                  background: s.color,
                  color: s.text,
                  fontFamily: F.jetbrains,
                  fontWeight: 500,
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {s.label} {s.pct}%
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
            <Chip kind="opinion" size={17} font={F.jetbrains} colors={{ opinion: BS.opinion }} />
            <span style={{ fontFamily: F.jetbrains, fontSize: 19, color: BS.muted }}>
              Survey q18 · {D.fossil.n} of {D.meta.respondents} answered · Maynooth University
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export const BubbleSort: React.FC<{ footage?: "auto" | "off"; footageStartAt?: number }> = ({
  footage = "auto",
  footageStartAt = 0,
}) => {
  const frame = useCurrentFrame();
  const useReal = footage === "auto" && hasFootage("bubble-sort");
  const active =
    frame < T.step2 ? 0 : frame < T.step3 ? 1 : frame < T.step4 ? 2 : 3;
  return (
    <AbsoluteFill style={{ background: BS.sky }}>
      <Chrome chapter="03 / Game 1 · Bubble Sort" color={BS.muted} rule="#D5D8F2" />
      {/* left column */}
      <div style={{ position: "absolute", left: SAFE.x, top: 140, width: 560 }}>
        <div
          style={{
            fontFamily: F.bricolage,
            fontWeight: 800,
            fontSize: 118,
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            color: BS.ink,
            opacity: prog(frame, 0, 16),
            translate: `0 ${(1 - prog(frame, 0, 20)) * 30}px`,
          }}
        >
          Bubble
          <br />
          Sort
        </div>
        <div
          style={{
            fontFamily: F.atkinson,
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.25,
            color: BS.ink,
            marginTop: 26,
            opacity: prog(frame, 8, 18),
          }}
        >
          Data, opinion or assumption? Bet on yourself.
        </div>
        <div style={{ marginTop: 56 }}>
          <Steps active={useReal ? -1 : active} startAt={14} />
        </div>
      </div>
      {useReal ? (
        <div style={{ position: "absolute", left: 760, top: 160, opacity: prog(frame, 6, 16) }}>
          <BrowserFrame width={1040} height={760} url="bubble-sort.html">
            <FootageVideo id="bubble-sort" startAt={footageStartAt} />
          </BrowserFrame>
        </div>
      ) : (
        <Recreation />
      )}
      <SourceLine
        text={
          useReal
            ? "Gameplay recording · games/bubble-sort"
            : "Recreated from the game · the card, the bet and the answer are a sample run"
        }
        start={20}
        color={BS.muted}
        font={F.jetbrains}
        bottom={40}
      />
    </AbsoluteFill>
  );
};

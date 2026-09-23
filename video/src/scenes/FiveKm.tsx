import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, pop, prog, shake, tween } from "../anim";
import { BrowserFrame, FootageVideo, hasFootage } from "../components/Footage";
import { Chip, Chrome, SourceLine } from "../components/ui";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { EASE, F, KM, SAFE } from "../theme";
import { hillRings, SceneCounty, SceneIreland, SceneStreet, SceneTown } from "./fivekm/MapScenes";

/**
 * 04 5 KM - the zoom with the falling meter (national support -> acceptance within 5 km),
 * then the 100-resident town hall. Yellow planning notice = the game's key surface.
 */
export const FIVEKM_DURATION = 560;

const MAP = { x: SAFE.x, y: 150, w: 860, h: 820 };
const NOTE = { x: 1040, y: 150, w: 760, h: 820 };

const T = {
  meterIn: 22,
  guess: 60,
  drop: [104, 228] as [number, number],
  land: 228,
  stamp: 236,
  act2: 290,
  pkg: [322, 350, 378] as number[],
  vote: 412,
  flips: [424, 500] as [number, number],
};

// Zoom windows per scene: [appear, zoomOut]
const SCENES = [
  { label: "Ireland", appear: -40, zoom: 96, origin: [470, 430] },
  { label: "Your county", appear: 112, zoom: 150, origin: [430, 405] },
  { label: "Your town", appear: 166, zoom: 196, origin: [430, 405] },
  { label: "Your street", appear: 212, zoom: 9999, origin: [430, 560] },
];

/** Game design constants of 5 KM (not survey data): planning-point costs and budget. */
const COST: Record<string, number> = { q79: 3, q81: 2, q82: 1 };
const BUDGET = 6;

const Contours: React.FC = () => {
  const rings = useMemo(
    () => [
      ...hillRings(1500, 120, 9, 38, 1.3, "bg1"),
      ...hillRings(200, 980, 8, 42, 1.5, "bg2"),
      ...hillRings(1000, 620, 6, 55, 1.2, "bg3"),
    ],
    [],
  );
  return (
    <svg width={1920} height={1080} style={{ position: "absolute" }} viewBox="0 0 1920 1080">
      <g fill="none" stroke="#C9D8B6" strokeWidth={2}>
        {rings.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
};

const ZoomLayer: React.FC<{ i: number; children: React.ReactNode }> = ({ i, children }) => {
  const frame = useCurrentFrame();
  const s = SCENES[i];
  const inP = tween(frame, [s.appear, s.appear + 26], [0, 1], EASE.out);
  const outP = tween(frame, [s.zoom, s.zoom + 30], [0, 1], EASE.in);
  const scale = mix(0.55, 1, inP) * mix(1, 3.4, outP);
  const opacity = Math.min(1, inP * 1.4) * (1 - tween(frame, [s.zoom + 14, s.zoom + 30], [0, 1]));
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${s.origin[0]}px ${s.origin[1]}px`,
        scale: `${scale}`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

const Meter: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = tween(frame, T.drop, [0, 1], EASE.inOut);
  const landed = frame >= T.land;
  const inP = prog(frame, T.meterIn, 18);
  const counted = Math.round(mix(0, D.support.pct, prog(frame, T.meterIn, 26)));
  const value = frame < T.drop[0] ? counted : landed ? D.accept5km.pct : Math.round(mix(D.support.pct, D.accept5km.pct, drop));
  const falling = frame >= T.drop[0] && !landed;
  const guessP = prog(frame, T.guess, 16);
  const BAR = 360;
  const exit = prog(frame, T.act2, 16, EASE.inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 30,
        top: 30,
        width: 430,
        padding: "24px 28px 26px",
        background: KM.ink,
        color: "#F4F7EE",
        borderRadius: 6,
        opacity: inP * (1 - exit),
        translate: `0 ${(1 - inP) * -20}px`,
        boxShadow: "0 20px 40px -20px rgba(0,0,0,.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Chip kind="opinion" size={17} colors={{ opinion: "#FF6FA8" }} dark />
        <span style={{ fontFamily: F.mono, fontSize: 19, color: "#C9CFC4" }}>
          {falling ? "zooming in…" : `Survey ${landed ? "q77" : "q96"}`}
        </span>
      </div>
      <div
        style={{
          fontFamily: F.archivoBlack,
          fontSize: 150,
          lineHeight: 1,
          marginTop: 14,
          color: landed ? KM.road : "#F4F7EE",
          opacity: falling ? 0.55 : 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        <span style={{ fontSize: 70, verticalAlign: "top", marginLeft: 4 }}>%</span>
      </div>
      <div style={{ position: "relative", width: BAR, height: 14, background: "#3A4237", marginTop: 12 }}>
        <div style={{ width: (value / 100) * BAR, height: 14, background: landed ? KM.road : "#F4F7EE" }} />
        <div
          style={{
            position: "absolute",
            left: 0.45 * BAR - 1.5,
            top: -8,
            width: 3,
            height: 30,
            background: KM.notice,
            opacity: guessP,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 18,
          color: KM.notice,
          marginTop: 12,
          marginLeft: 0.45 * BAR - 60,
          opacity: guessP,
        }}
      >
        Your guess: 45% (sample)
      </div>
      <div style={{ fontFamily: F.publicSans, fontWeight: 600, fontSize: 28, lineHeight: 1.25, marginTop: 14 }}>
        {landed
          ? "would accept one within 5 km of home"
          : falling
            ? "…from all of Ireland to 5 km from home"
            : "support sustainable data centres in Ireland"}
      </div>
    </div>
  );
};

type Person = { value: number; x: number; y: number; flipAt: number | null };

const Room: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = prog(frame, T.act2 + 6, 22);
  const people = useMemo(() => {
    const list: Person[] = [];
    D.room.forEach((g) => {
      for (let k = 0; k < g.count; k++) list.push({ value: g.value, x: 0, y: 0, flipAt: null });
    });
    list.forEach((p, i) => {
      p.x = (i % 10) * 58;
      p.y = Math.floor(i / 10) * 46;
    });
    // who is won over: the model's counts, applied to a deterministic subset of each group
    const pick = (value: number, n: number) =>
      list
        .map((p, i) => ({ p, i }))
        .filter((o) => o.p.value === value)
        .sort((a, b) => random(`w${a.i}`) - random(`w${b.i}`))
        .slice(0, n);
    const won = [...pick(3, D.sampleVote.convNeither), ...pick(2, D.sampleVote.convSomewhat)];
    won
      .sort((a, b) => random(`o${a.i}`) - random(`o${b.i}`))
      .forEach((o, k) => {
        o.p.flipAt = T.flips[0] + (k / Math.max(1, won.length - 1)) * (T.flips[1] - T.flips[0]);
      });
    return list;
  }, []);
  const baseAccept = D.room.filter((g) => g.value >= 4).reduce((s, g) => s + g.count, 0);
  const flipped = people.filter((p) => p.flipAt != null && frame >= p.flipAt).length;
  const accepting = baseAccept + flipped;
  const legend = [
    { v: 1, label: "Completely unacceptable" },
    { v: 2, label: "Somewhat unacceptable" },
    { v: 3, label: "Neither" },
    { v: 4, label: "Somewhat acceptable" },
    { v: 5, label: "Completely acceptable" },
  ];
  const shape = (v: number, won: number, s: number) => {
    const r = 10;
    if (won > 0) {
      return (
        <g>
          <rect x={-15} y={-8} width={30} height={30} rx={4} fill={KM.notice} opacity={won} />
          <circle cx={0} cy={8} r={r} fill={KM.accept} />
          <circle cx={0} cy={-12} r={6} fill={KM.accept} />
        </g>
      );
    }
    const col = v <= 2 ? KM.against : v === 3 ? KM.neutral : KM.accept;
    const head = <circle cx={0} cy={-12} r={6} fill={col} />;
    if (v === 1) return <g>{head}<rect x={-r} y={-2} width={2 * r} height={2 * r - 2} fill={col} /></g>;
    if (v === 2) return <g>{head}<rect x={-r + 1} y={-1} width={2 * r - 2} height={2 * r - 4} fill="#F4DAD6" stroke={col} strokeWidth={2.5} /></g>;
    if (v === 3) return <g>{head}<circle cx={0} cy={8} r={r - 1} fill="#F4F7EE" stroke={col} strokeWidth={2.5} /></g>;
    if (v === 4) return <g>{head}<circle cx={0} cy={8} r={r - 1} fill="#D5E7EE" stroke={col} strokeWidth={2.5} /></g>;
    return (
      <g opacity={s}>
        {head}
        <circle cx={0} cy={8} r={r} fill={col} />
      </g>
    );
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#F4F7EE", opacity: inP }}>
      <div style={{ position: "absolute", left: 40, top: 30, right: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: F.archivo, fontWeight: 900, fontSize: 52, color: KM.ink, lineHeight: 1 }}>The room</div>
          <div style={{ fontFamily: F.mono, fontSize: 20, color: "#4A5246", marginTop: 8 }}>
            100 residents · q77 scaled to 100
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, opacity: prog(frame, T.flips[0] - 8, 12) }}>
            <Chip kind="model" size={17} colors={{ model: KM.ink }} />
            <span style={{ fontFamily: F.mono, fontSize: 18, color: "#4A5246" }}>simplified - not a prediction</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <span style={{ fontFamily: F.archivoBlack, fontSize: 104, lineHeight: 0.85, color: accepting > baseAccept ? KM.accept : KM.ink }}>
            {accepting}
          </span>
          <span style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 20, color: KM.ink, lineHeight: 1.2 }}>
            /100
            <br />
            ACCEPT
          </span>
        </div>
      </div>
      <svg width={860} height={820} style={{ position: "absolute", left: 0, top: 0 }}>
        <g transform="translate(169 200)">
          {people.map((p, i) => {
            const won = p.flipAt != null ? prog(frame, p.flipAt, 6) : 0;
            const popS = p.flipAt != null ? 1 + 0.35 * Math.sin(Math.PI * prog(frame, p.flipAt, 8)) : 1;
            const appear = pop(frame, fps, T.act2 + 10 + (i % 10) * 1.2 + Math.floor(i / 10) * 1.5, { damping: 14, stiffness: 170 });
            return (
              <g key={i} transform={`translate(${p.x} ${p.y}) scale(${appear * popS})`}>
                {shape(p.value, won, 1)}
              </g>
            );
          })}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 676,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 6,
          columnGap: 16,
          fontFamily: F.publicSans,
          fontSize: 20,
          color: KM.ink,
        }}
      >
        {legend.map((l) => {
          const n = D.room.find((g) => g.value === l.v)?.count ?? 0;
          return (
            <div key={l.v} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width={26} height={34} viewBox="-13 -20 26 34">
                {shape(l.v, 0, 1)}
              </svg>
              <span>
                {l.label} <b>{n}</b>
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: prog(frame, T.flips[0], 10) }}>
          <svg width={26} height={34} viewBox="-15 -20 30 42">
            {shape(4, 1, 1)}
          </svg>
          <span>
            Won over <b>{flipped}</b>
          </span>
        </div>
      </div>
    </div>
  );
};

const NoticeShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, 2, { damping: 15, stiffness: 110 });
  return (
    <div
      style={{
        position: "absolute",
        left: NOTE.x,
        top: NOTE.y,
        width: NOTE.w,
        height: NOTE.h,
        background: KM.notice,
        color: KM.ink,
        borderRadius: 4,
        padding: "34px 44px",
        boxSizing: "border-box",
        boxShadow: "0 30px 60px -30px rgba(21,26,20,.6)",
        rotate: `${(1 - p) * 6}deg`,
        translate: `${(1 - p) * 300}px 0`,
        overflow: "hidden",
      }}
    >
      {[16, NOTE.w - 30].map((x) => (
        <span
          key={x}
          style={{
            position: "absolute",
            left: x,
            top: 16,
            width: 14,
            height: 14,
            borderRadius: 7,
            background: "radial-gradient(circle at 35% 35%, #d9d9d9, #8c8c8c)",
          }}
        />
      ))}
      <div style={{ fontFamily: F.archivoBlack, fontSize: 96, letterSpacing: "0.05em", lineHeight: 1 }}>NOTICE</div>
      <div style={{ fontFamily: F.mono, fontSize: 20, marginTop: 10 }}>
        Grid ref. N 603 287 · Game 2 of 3 · Planning file 5KM
      </div>
      <div style={{ borderTop: `5px solid ${KM.ink}`, borderBottom: `2px solid ${KM.ink}`, height: 4, marginTop: 18 }} />
      {children}
    </div>
  );
};

const StepList: React.FC<{ items: string[]; start: number }> = ({ items, start }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
      {items.map((t, i) => {
        const p = prog(frame, start + i * 8, 18);
        return (
          <div key={t} style={{ display: "flex", gap: 16, opacity: p, translate: `${(1 - p) * 16}px 0` }}>
            <span
              style={{
                flex: "none",
                width: 40,
                height: 40,
                background: KM.ink,
                color: KM.notice,
                fontFamily: F.archivo,
                fontWeight: 900,
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontFamily: F.publicSans, fontWeight: 600, fontSize: 31, lineHeight: 1.25 }}>{t}</span>
          </div>
        );
      })}
    </div>
  );
};

const NoticeAct1: React.FC = () => {
  const frame = useCurrentFrame();
  const out = prog(frame, T.act2, 14, EASE.inOut);
  return (
    <div style={{ opacity: 1 - out }}>
      <div style={{ fontFamily: F.archivo, fontWeight: 900, fontSize: 84, lineHeight: 1, marginTop: 30 }}>5 KM</div>
      <div style={{ fontFamily: F.publicSans, fontWeight: 700, fontSize: 42, lineHeight: 1.15, marginTop: 10 }}>
        Ireland says yes. Would your street?
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 21, letterSpacing: "0.1em", marginTop: 34 }}>WHAT YOU DO</div>
      <StepList
        start={18}
        items={[
          "Say where you stand on data centres.",
          "Guess how many would accept one near home.",
          "Zoom from Ireland to your street - and watch support fall.",
        ]}
      />
    </div>
  );
};

const NoticeAct2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = prog(frame, T.act2 + 8, 18);
  const conds = D.samplePackage.map((id) => D.conds.find((c) => c.id === id)!);
  const spent = conds.reduce((s, c, i) => s + (frame >= T.pkg[i] ? COST[c.id] : 0), 0);
  const vote = pop(frame, fps, T.vote, { damping: 10, stiffness: 220 });
  return (
    <div style={{ position: "absolute", left: 44, right: 44, top: 196, opacity: inP }}>
      <div style={{ fontFamily: F.mono, fontSize: 21, letterSpacing: "0.1em" }}>ACT 2 · THE TOWN HALL</div>
      <div style={{ fontFamily: F.archivo, fontWeight: 900, fontSize: 64, lineHeight: 1, marginTop: 10 }}>Win over the room</div>
      <div style={{ fontFamily: F.publicSans, fontWeight: 600, fontSize: 29, lineHeight: 1.3, marginTop: 14 }}>
        You pitch a data centre. Spend {BUDGET} planning points on promises and win over 100 residents.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}>
        {conds.map((c, i) => {
          const p = pop(frame, fps, T.pkg[i], { damping: 14, stiffness: 160 });
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: KM.ink,
                color: "#F4F7EE",
                padding: "14px 18px",
                scale: `${0.9 + 0.1 * p}`,
                opacity: Math.min(1, p * 1.5),
                translate: `${(1 - p) * 60}px 0`,
              }}
            >
              <span style={{ fontFamily: F.publicSans, fontWeight: 700, fontSize: 28, flex: 1 }}>{c.short}</span>
              <span style={{ fontFamily: F.mono, fontSize: 18, color: "#C9CFC4" }}>top-3 pick {c.pickPct}%</span>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {Array.from({ length: COST[c.id] }, (_, k) => (
                  <span key={k} style={{ width: 14, height: 14, background: KM.notice, display: "inline-block" }} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22 }}>
        <span style={{ fontFamily: F.mono, fontSize: 18, lineHeight: 1.2 }}>
          PLANNING
          <br />
          POINTS
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          {Array.from({ length: BUDGET }, (_, k) => (
            <span
              key={k}
              style={{
                width: 30,
                height: 30,
                border: `3px solid ${KM.ink}`,
                background: k < spent ? KM.ink : "transparent",
                display: "inline-block",
              }}
            />
          ))}
        </span>
        <span
          style={{
            marginLeft: "auto",
            background: KM.ink,
            color: KM.notice,
            fontFamily: F.publicSans,
            fontWeight: 700,
            fontSize: 28,
            padding: "14px 22px",
            scale: `${frame >= T.vote ? 1 - 0.06 * Math.sin(Math.PI * Math.min(1, vote)) : 1}`,
            opacity: prog(frame, T.pkg[2] + 6, 12),
          }}
        >
          Call the vote →
        </span>
      </div>
    </div>
  );
};

const Recreation: React.FC = () => {
  const frame = useCurrentFrame();
  const sh = shake(frame, T.land, 10, 16);
  const stamp = prog(frame, T.stamp, 10, EASE.in);
  const stampOut = prog(frame, T.act2, 14, EASE.inOut);
  const sceneIdx = SCENES.reduce((acc, s, i) => (frame >= s.appear + 10 ? i : acc), 0);
  const act2 = frame >= T.act2;
  return (
    <>
      {SCENES.slice(0, 3).map((s) => (
        <Sfx key={s.label} name="whoosh" at={s.zoom} volume={0.28} />
      ))}
      <Sfx name="thump" at={T.land} volume={0.45} />
      <Sfx name="thump" at={T.stamp + 8} volume={0.7} />
      {T.pkg.map((f) => (
        <Sfx key={f} name="tick" at={f} volume={0.35} />
      ))}
      <Sfx name="tick" at={T.vote} volume={0.4} />
      {Array.from({ length: 12 }, (_, i) => (
        <Sfx key={`v${i}`} name="tick" at={T.flips[0] + (i * (T.flips[1] - T.flips[0])) / 11} volume={0.16} />
      ))}
      {/* map frame */}
      <div
        style={{
          position: "absolute",
          left: MAP.x + sh.x,
          top: MAP.y + sh.y,
          width: MAP.w,
          height: MAP.h,
          background: "#FBFBF6",
          border: `3px solid ${KM.ink}`,
          boxShadow: "0 30px 60px -34px rgba(21,26,20,.6)",
          overflow: "hidden",
          opacity: prog(frame, 0, 16),
        }}
      >
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
          <ZoomLayer i={0}>
            <SceneIreland />
          </ZoomLayer>
          <ZoomLayer i={1}>
            <SceneCounty />
          </ZoomLayer>
          <ZoomLayer i={2}>
            <SceneTown />
          </ZoomLayer>
          <ZoomLayer i={3}>
            <SceneStreet frame={frame} />
          </ZoomLayer>
        </div>
        {!act2 && (
          <div
            style={{
              position: "absolute",
              right: 24,
              bottom: 24,
              background: "#FBFBF6",
              border: `2px solid ${KM.ink}`,
              padding: "8px 14px",
              fontFamily: F.mono,
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: "0.08em",
              color: KM.ink,
              textTransform: "uppercase",
            }}
          >
            {SCENES[sceneIdx].label}
          </div>
        )}
        <Meter />
        {/* the stamp */}
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 470,
            padding: "14px 26px 18px",
            border: `6px solid ${KM.road}`,
            borderRadius: 8,
            background: "rgba(251,251,246,.9)",
            color: KM.road,
            rotate: "-8deg",
            scale: `${mix(1.6, 1, stamp)}`,
            opacity: stamp * (1 - stampOut),
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: F.archivo, fontWeight: 900, fontSize: 34, letterSpacing: "0.14em" }}>THE 5 KM GAP</div>
          <div style={{ fontFamily: F.archivoBlack, fontSize: 92, lineHeight: 1 }}>
            {D.support.pct}% → {D.accept5km.pct}%
          </div>
        </div>
        {act2 && <Room />}
      </div>
      <NoticeShell>
        <NoticeAct1 />
        {act2 && <NoticeAct2 />}
      </NoticeShell>
    </>
  );
};

export const FiveKm: React.FC<{ footage?: "auto" | "off"; footageStartAt?: number }> = ({
  footage = "auto",
  footageStartAt = 0,
}) => {
  const frame = useCurrentFrame();
  const useReal = footage === "auto" && hasFootage("5km");
  return (
    <AbsoluteFill style={{ background: KM.field }}>
      <Contours />
      <Chrome chapter="04 / Game 2 · 5 KM" color="#4A5246" rule="#B9CBA6" />
      {useReal ? (
        <>
          <div style={{ position: "absolute", left: SAFE.x, top: 150, opacity: prog(frame, 4, 16) }}>
            <BrowserFrame width={1100} height={800} url="5km.html">
              <FootageVideo id="5km" startAt={footageStartAt} />
            </BrowserFrame>
          </div>
          <div style={{ position: "absolute", left: 1270, top: 170, width: 530, color: KM.ink }}>
            <div style={{ fontFamily: F.archivo, fontWeight: 900, fontSize: 90, lineHeight: 1 }}>5 KM</div>
            <div style={{ fontFamily: F.publicSans, fontWeight: 700, fontSize: 38, marginTop: 12 }}>
              Ireland says yes. Would your street?
            </div>
          </div>
        </>
      ) : (
        <Recreation />
      )}
      <SourceLine
        text={
          useReal
            ? `Gameplay recording · games/5km · Maynooth University survey of ${D.meta.respondents} people in Ireland`
            : frame < T.act2
            ? `Survey q96 (${D.support.n} answered) and q77 (${D.accept5km.n} answered) · Maynooth University survey of ${D.meta.respondents} people in Ireland`
            : `Town hall: q77 scaled to 100 · vote = the game's simplified model using q88 top-3 picks, not a prediction · sample package`
        }
        start={T.meterIn}
        color="#4A5246"
        bottom={40}
      />
    </AbsoluteFill>
  );
};

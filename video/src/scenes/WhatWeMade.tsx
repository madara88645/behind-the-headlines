import React, { useMemo } from "react";
import { AbsoluteFill, getStaticFiles, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { mix, pop, prog, tween } from "../anim";
import { Chrome, Kicker } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { BS, C, EASE, F, KM, RG, SAFE } from "../theme";

/**
 * 02 WHAT WE MADE (paper)
 * The launcher's three game tiles, then a push-in on Bubble Sort that hands over to its scene.
 */
export const MADE_DURATION = 230;

const TILE_W = 520;
const TILE_H = 648;
const GAP = (1920 - 2 * SAFE.x - 3 * TILE_W) / 2;
const TOP = 322;

/**
 * REAL SCREENSHOT SLOT: public/screens/<slug>.png (1440x900). Refresh them with
 * `bash scripts/capture-screens.sh`. A missing file falls back to a drawn tile.
 */
const screenFor = (slug: string): string | null => {
  try {
    const name = `screens/${slug}.png`;
    return getStaticFiles().some((f) => f.name === name) ? name : null;
  } catch {
    return null;
  }
};
const tileX = (i: number) => SAFE.x + i * (TILE_W + GAP);

const T = { head: 4, tiles: 24, push: 180 };

const TILES = [
  {
    slug: "bubble-sort",
    title: "Bubble Sort",
    tag: "Data, opinion or assumption? Bet on yourself.",
    what: "Sort twelve claims into three bubbles.",
    bg: BS.sky,
    art: BS.skyDeep,
    ink: BS.ink,
  },
  {
    slug: "5km",
    title: "5 KM",
    tag: "Ireland says yes. Would your street?",
    what: "Zoom to your street. Win over a town hall.",
    bg: KM.field,
    art: "#CFE0BD",
    ink: KM.ink,
  },
  {
    slug: "rigged",
    title: "Rigged",
    tag: "Three experiments. All of them fixed.",
    what: "Get nudged on purpose. Then see the receipts.",
    bg: RG.paper,
    art: RG.paper,
    ink: RG.ink,
  },
];

const Bubble: React.FC<{ x: number; y: number; d: number; color: string; phase: number }> = ({
  x,
  y,
  d,
  color,
  phase,
}) => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame / 20 + phase) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + bob,
        width: d,
        height: d,
        borderRadius: "50%",
        border: `3px solid ${color}`,
        background:
          "radial-gradient(circle at 32% 28%, rgba(255,255,255,.95) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(255,255,255,.15), rgba(255,255,255,.55) 70%, rgba(255,255,255,.2))",
        boxShadow: `inset 0 0 ${d / 4}px ${color}44`,
      }}
    />
  );
};

const Art: React.FC<{ i: number }> = ({ i }) => {
  if (i === 0) {
    return (
      <>
        <Bubble x={60} y={60} d={140} color={BS.data} phase={0} />
        <Bubble x={215} y={112} d={110} color={BS.opinion} phase={2} />
        <Bubble x={340} y={40} d={124} color={BS.assume} phase={4} />
      </>
    );
  }
  if (i === 1) {
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 34,
            width: 220,
            background: KM.notice,
            color: KM.ink,
            padding: "16px 18px 18px",
            borderRadius: 3,
            rotate: "-3deg",
            boxShadow: "0 10px 20px -10px rgba(0,0,0,.45)",
          }}
        >
          <div
            style={{
              fontFamily: F.archivoBlack,
              fontSize: 30,
              letterSpacing: "0.06em",
              borderBottom: `3px solid ${KM.ink}`,
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            NOTICE
          </div>
          <div style={{ fontFamily: F.mono, fontSize: 15, lineHeight: 1.35 }}>
            Proposed sustainable data centre within 5 km of this site
          </div>
        </div>
        <div style={{ position: "absolute", left: 255, top: 178, width: 12, height: 90, background: "#6B4F2A" }} />
        <div
          style={{
            position: "absolute",
            right: 22,
            bottom: 14,
            fontFamily: F.display,
            fontWeight: 900,
            fontSize: 46,
            color: C.neq,
            letterSpacing: "-0.02em",
          }}
        >
          <s style={{ color: KM.hedge, fontSize: 30, marginRight: 8, textDecorationThickness: 3 }}>
            {D.support.pct}%
          </s>
          {D.accept5km.pct}%
        </div>
      </>
    );
  }
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 28,
          right: 28,
          top: 32,
          bottom: 26,
          background: RG.sheet,
          border: `1.5px solid ${RG.grid}`,
          borderRadius: 6,
          padding: "16px 18px",
          fontFamily: F.mono,
          fontSize: 16,
          lineHeight: 2,
          color: RG.ink,
        }}
      >
        {["EXPERIMENT 01 · ANCHORING", "PARTICIPANT #0427", "ESTIMATE: ____ %"].map((t) => (
          <div key={t} style={{ borderBottom: `1.5px solid ${RG.grid}` }}>
            {t}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 40,
          bottom: 40,
          rotate: "-11deg",
          border: `5px solid ${RG.red}`,
          color: RG.red,
          fontFamily: F.chivo,
          fontWeight: 900,
          fontSize: 44,
          letterSpacing: "0.12em",
          padding: "6px 14px 4px",
          borderRadius: 8,
        }}
      >
        RIGGED
      </div>
    </>
  );
};

export const WhatWeMade: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // push-in on tile 1's art (hands over to the Bubble Sort scene, which shares its sky colour)
  const push = tween(frame, [T.push, MADE_DURATION], [0, 1], EASE.in);
  const screens = useMemo(() => TILES.map((t) => screenFor(t.slug)), []);
  const ox = tileX(0) + TILE_W / 2;
  const oy = TOP + (screens[0] ? 190 : 130);
  const scale = mix(1, 7, push);
  const fadeOut = prog(frame, T.push, 14, EASE.inOut);
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Chrome chapter="02 / What we made" color={C.muted} rule={C.rule} />
      {[0, 1, 2].map((i) => (
        <Sfx key={i} name="tick" at={T.tiles + i * 9 + 3} volume={0.3} />
      ))}
      <Sfx name="whoosh" at={T.push + 10} volume={0.5} />
      <AbsoluteFill style={{ transformOrigin: `${ox}px ${oy}px`, scale: `${scale}` }}>
        <div style={{ position: "absolute", left: SAFE.x, top: 150, width: 1680, opacity: 1 - fadeOut }}>
          <Kicker color={C.muted} start={T.head}>
            {screens.some(Boolean) ? "A launcher and three browser games · real screens" : "A launcher and three browser games"}
          </Kicker>
          <Words
            text="Three games. One survey. No install."
            start={T.head + 6}
            style={{
              fontFamily: F.display,
              fontWeight: 900,
              fontSize: 84,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: C.ink,
              marginTop: 18,
            }}
          />
        </div>
        {TILES.map((t, i) => {
          const p = pop(frame, fps, T.tiles + i * 9, { damping: 16, stiffness: 120 });
          const fadeOthers = i === 0 ? 1 : 1 - fadeOut;
          return (
            <div
              key={t.title}
              style={{
                position: "absolute",
                left: tileX(i),
                top: TOP,
                width: TILE_W,
                height: TILE_H,
                borderRadius: 26,
                overflow: "hidden",
                background: t.bg,
                color: t.ink,
                boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 24px 50px -30px rgba(17,19,24,.45)",
                translate: `0 ${(1 - p) * 160}px`,
                opacity: Math.min(1, p * 1.5) * Math.max(0, fadeOthers),
              }}
            >
              {screens[i] ? (
                <div style={{ position: "relative", height: 365, background: t.art, padding: "18px 18px 0" }}>
                  <div
                    style={{
                      height: 347,
                      borderRadius: "12px 12px 0 0",
                      overflow: "hidden",
                      background: "#fff",
                      boxShadow: "0 0 0 1.5px rgba(17,19,24,.12), 0 18px 30px -20px rgba(17,19,24,.5)",
                    }}
                  >
                    <div style={{ height: 30, display: "flex", alignItems: "center", gap: 6, padding: "0 12px", background: "#F4F5F8" }}>
                      {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                        <span key={c} style={{ width: 9, height: 9, borderRadius: 5, background: c, display: "inline-block" }} />
                      ))}
                      <span style={{ marginLeft: 10, fontFamily: F.mono, fontSize: 12, color: "#6B7180" }}>games/{t.slug}/index.html</span>
                    </div>
                    <Img src={staticFile(screens[i]!)} style={{ width: "100%", display: "block" }} />
                  </div>
                </div>
              ) : (
              <div
                style={{
                  position: "relative",
                  height: 260,
                  background: t.art,
                  overflow: "hidden",
                }}
              >
                {i === 2 && (
                  <svg width={TILE_W} height={260} style={{ position: "absolute" }}>
                    <defs>
                      <pattern id="gp-tile" width={24} height={24} patternUnits="userSpaceOnUse">
                        <path d="M24 0H0V24" fill="none" stroke={RG.grid} strokeWidth={1} />
                      </pattern>
                    </defs>
                    <rect width={TILE_W} height={260} fill="url(#gp-tile)" />
                  </svg>
                )}
                <Art i={i} />
              </div>
              )}
              <div style={{ padding: "26px 30px", opacity: 1 - fadeOut }}>
                <div style={{ fontFamily: F.display, fontWeight: 900, fontSize: 52, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {t.title}
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, lineHeight: 1.25, marginTop: 14 }}>
                  {t.tag}
                </div>
                <div style={{ fontFamily: F.display, fontSize: 27, lineHeight: 1.3, marginTop: 12, opacity: 0.8 }}>
                  {t.what}
                </div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      {/* the sky of Bubble Sort washes in at the end of the push */}
      <AbsoluteFill style={{ background: BS.sky, opacity: prog(frame, MADE_DURATION - 16, 16, EASE.inOut) }} />
    </AbsoluteFill>
  );
};

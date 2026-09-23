import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog, tween } from "../anim";
import { C, EASE, F, SAFE } from "../theme";

/* ------------------------------------------------------------------ Chrome */
/**
 * Persistent top bar: project name left, chapter right, hairline under both.
 * Same position in every scene so the cuts feel like one piece.
 */
export const Chrome: React.FC<{
  chapter: string;
  color: string;
  rule: string;
  font?: string;
  delay?: number;
}> = ({ chapter, color, rule, font = F.mono, delay = 0 }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, delay, 20);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          top: 52,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: font,
          fontWeight: 500,
          fontSize: 22,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color,
          opacity: p,
        }}
      >
        <span>Behind the headlines</span>
        <span>{chapter}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          top: 92,
          height: 1.5,
          background: rule,
          scale: `${p} 1`,
          transformOrigin: "left center",
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Source line */
export const SourceLine: React.FC<{
  text: string;
  start: number;
  end?: number;
  color: string;
  font?: string;
  align?: "left" | "right";
  bottom?: number;
}> = ({ text, start, end, color, font = F.mono, align = "left", bottom = 52 }) => {
  const frame = useCurrentFrame();
  const a = prog(frame, start, 18);
  const b = end == null ? 0 : prog(frame, end - 10, 10, EASE.inOut);
  return (
    <div
      style={{
        position: "absolute",
        [align]: SAFE.x,
        bottom,
        maxWidth: 1680,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: font,
        fontSize: 22,
        lineHeight: 1.3,
        color,
        opacity: a * (1 - b),
        translate: `0 ${(1 - a) * 14}px`,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          background: color,
          display: "inline-block",
          flex: "none",
        }}
      />
      <span>{text}</span>
    </div>
  );
};

/* ------------------------------------------------------------------ Kind chip */
export type Kind = "data" | "opinion" | "assumption" | "model" | "sample" | "caveat";

const KIND_LABEL: Record<Kind, string> = {
  data: "Data",
  opinion: "Opinion",
  assumption: "Assumption",
  model: "Model",
  sample: "Sample play",
  caveat: "Small group",
};

/** DATA / OPINION / ASSUMPTION label chip - the thesis, carried through every scene. */
export const Chip: React.FC<{
  kind: Kind;
  label?: string;
  dark?: boolean;
  size?: number;
  colors?: Partial<Record<Kind, string>>;
  font?: string;
  style?: React.CSSProperties;
}> = ({ kind, label, dark = false, size = 22, colors, font = F.mono, style }) => {
  const base: Record<Kind, string> = {
    data: dark ? C.dataDark : C.data,
    opinion: dark ? C.opinionDark : C.opinion,
    assumption: dark ? C.assumeDark : C.assume,
    model: dark ? "#C9CDD6" : "#3B4150",
    sample: dark ? "#C9CDD6" : "#3B4150",
    caveat: dark ? C.assumeDark : C.assume,
  };
  const col = colors?.[kind] ?? base[kind];
  const outlined = kind === "sample" || kind === "caveat" || kind === "model";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.28}px ${size * 0.6}px`,
        borderRadius: size * 0.3,
        border: `2px ${kind === "sample" ? "dashed" : "solid"} ${col}`,
        background: outlined ? "transparent" : col,
        color: outlined ? col : dark ? C.ink : "#fff",
        fontFamily: font,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {!outlined && (
        <span
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: "50%",
            background: dark ? C.ink : "#fff",
            display: "inline-block",
          }}
        />
      )}
      {label ?? KIND_LABEL[kind]}
    </span>
  );
};

/* ------------------------------------------------------------------ Count-up number */
export const Count: React.FC<{
  from: number;
  to: number;
  start: number;
  dur: number;
  suffix?: string;
  decimals?: number;
  style?: React.CSSProperties;
  curve?: readonly [number, number, number, number];
}> = ({ from, to, start, dur, suffix = "", decimals = 0, style, curve = EASE.out }) => {
  const frame = useCurrentFrame();
  const v = tween(frame, [start, start + dur], [from, to], curve);
  const k = 10 ** decimals;
  // Snap exactly to the target at the end so the held value is the real number.
  const shown = frame >= start + dur ? to : Math.round(v * k) / k;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/* ------------------------------------------------------------------ The ≠ sign */
/** Orange ≠ that slams in and settles with a small wobble (the launcher's signature glyph).
 *  Drawn as SVG so it is equally heavy in every font. */
export const Neq: React.FC<{ at: number; size: number; color?: string }> = ({ at, size, color = C.neq }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  const p = prog(frame, at, 14);
  const wob = t > 8 ? Math.sin((t - 8) / 3.2) * 10 * Math.exp(-(t - 8) / 14) : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        display: "inline-block",
        overflow: "visible",
        opacity: Math.min(1, p * 1.6),
        scale: `${1.8 - 0.8 * p}`,
        rotate: `${-18 * (1 - p) + wob}deg`,
      }}
    >
      <NeqGlyph color={color} />
    </svg>
  );
};

export const NeqGlyph: React.FC<{ color: string }> = ({ color }) => (
  <g stroke={color} strokeWidth={13} strokeLinecap="round" fill="none">
    <line x1={14} x2={86} y1={37} y2={37} />
    <line x1={14} x2={86} y1={63} y2={63} />
    <line x1={66} x2={34} y1={10} y2={90} />
  </g>
);

/* ------------------------------------------------------------------ Kicker */
export const Kicker: React.FC<{
  children: React.ReactNode;
  color: string;
  start: number;
  font?: string;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, color, start, font = F.mono, size = 24, style }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, start, 18);
  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        opacity: p,
        translate: `${(1 - p) * -16}px 0`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

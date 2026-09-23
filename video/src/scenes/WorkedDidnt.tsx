import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../anim";
import { Chrome, Kicker, NeqGlyph } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { C, F, SAFE } from "../theme";

/**
 * 07 WHAT WORKED / WHAT DIDN'T (paper). The lines are props - edit them in the Studio or in Root.tsx.
 */
export const WORKED_DURATION = 480;

const Item: React.FC<{ n: number; text: string; at: number; tone: "good" | "bad" }> = ({ n, text, at, tone }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, 20);
  const col = tone === "good" ? C.data : C.neq;
  return (
    <div
      style={{
        display: "flex",
        gap: 22,
        alignItems: "flex-start",
        paddingTop: 26,
        paddingBottom: 26,
        borderTop: `2px solid ${C.rule}`,
        opacity: p,
        translate: `0 ${(1 - p) * 24}px`,
      }}
    >
      <span style={{ flex: "none", fontFamily: F.mono, fontWeight: 600, fontSize: 24, color: col, paddingTop: 8, width: 40 }}>
        {String(n).padStart(2, "0")}
      </span>
      <span style={{ fontFamily: F.display, fontWeight: 500, fontSize: 38, lineHeight: 1.25, color: C.ink }}>{text}</span>
    </div>
  );
};

export const WorkedDidnt: React.FC<{ worked: readonly string[]; didnt: readonly string[] }> = ({ worked, didnt }) => {
  const frame = useCurrentFrame();
  const colW = 800;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Chrome chapter="07 / What worked, what didn't" color={C.muted} rule={C.rule} />
      <div style={{ position: "absolute", left: SAFE.x, top: 150, width: 1680 }}>
        <Kicker color={C.muted} start={2}>
          Honest notes from the build
        </Kicker>
        <Words
          text="What worked. What didn't."
          start={6}
          stagger={4}
          style={{ fontFamily: F.display, fontWeight: 900, fontSize: 96, letterSpacing: "-0.03em", lineHeight: 1, color: C.ink, marginTop: 16 }}
        />
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 370, display: "flex", justifyContent: "space-between" }}>
        {[
          { title: "Worked", items: worked, tone: "good" as const, start: 30 },
          { title: "Didn't (yet)", items: didnt, tone: "bad" as const, start: 30 + worked.length * 28 + 10 },
        ].map((col) => (
          <div key={col.title} style={{ width: colW }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, opacity: prog(frame, col.start - 8, 14) }}>
              {col.tone === "good" ? (
                <svg width={40} height={40} viewBox="0 0 40 40">
                  <circle cx={20} cy={20} r={19} fill={C.data} />
                  <path d="M11 20.5l6 6 12-13" stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width={40} height={40} viewBox="0 0 100 100">
                  <NeqGlyph color={C.neq} />
                </svg>
              )}
              <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 44, color: col.tone === "good" ? C.data : C.neq }}>
                {col.title}
              </span>
            </div>
            {col.items.map((t, i) => (
              <React.Fragment key={i}>
                <Sfx name="tick" at={col.start + i * 28} volume={0.25} />
                <Item n={i + 1} text={t} at={col.start + i * 28} tone={col.tone} />
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

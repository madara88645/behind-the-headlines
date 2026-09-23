import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { prog } from "../anim";
import { Chrome, Neq } from "../components/ui";
import { Words } from "../components/Words";
import { Sfx } from "../components/Sfx";
import { D } from "../data/generated";
import { C, F, SAFE } from "../theme";

/** 08 END CARD (dark). Team name / members / event line are props. */
export const END_DURATION = 270;

export const EndCard: React.FC<{
  teamName: string;
  teamMembers: readonly string[];
  eventLine: string;
  playLine: string;
}> = ({ teamName, teamMembers, eventLine, playLine }) => {
  const frame = useCurrentFrame();
  const words = [
    { w: "Data", c: C.dataDark, at: 26 },
    { w: "Opinion", c: C.opinionDark, at: 44 },
    { w: "Assumption", c: C.assumeDark, at: 62 },
  ];
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Chrome chapter="08 / Play it" color={C.mutedDark} rule={C.ruleDark} />
      <Sfx name="thump" at={words[0].at + 10} volume={0.35} />
      <Sfx name="thump" at={words[1].at + 10} volume={0.35} />
      <div style={{ position: "absolute", left: SAFE.x, top: 210, width: 1680 }}>
        <Words
          text="Behind the headlines"
          start={2}
          stagger={4}
          style={{ fontFamily: F.display, fontWeight: 900, fontSize: 156, letterSpacing: "-0.035em", lineHeight: 1, color: C.white }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: 44 }}>
          {words.map((x, i) => (
            <React.Fragment key={x.w}>
              <span
                style={{
                  fontFamily: F.display,
                  fontWeight: 900,
                  fontSize: 72,
                  letterSpacing: "-0.02em",
                  color: x.c,
                  opacity: prog(frame, x.at, 14),
                  translate: `0 ${(1 - prog(frame, x.at, 18)) * 20}px`,
                }}
              >
                {x.w}
              </span>
              {i < 2 && <Neq at={x.at + 10} size={64} />}
            </React.Fragment>
          ))}
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 38,
            lineHeight: 1.3,
            color: C.mutedDark,
            marginTop: 44,
            maxWidth: 1300,
            opacity: prog(frame, 80, 18),
          }}
        >
          Three browser games built on a Maynooth University survey of {D.meta.respondents} people in Ireland, checked against
          official sources. {playLine}
        </div>
      </div>
      <div style={{ position: "absolute", left: SAFE.x, right: SAFE.x, top: 800, borderTop: `2px solid ${C.ruleDark}`, paddingTop: 30, opacity: prog(frame, 100, 18) }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, flexWrap: "wrap" }}>
          <span style={{ fontFamily: F.display, fontWeight: 900, fontSize: 44, color: C.white }}>{teamName}</span>
          {teamMembers.length > 0 && (
            <span style={{ fontFamily: F.display, fontSize: 32, color: C.mutedDark }}>{teamMembers.join(" · ")}</span>
          )}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: "0.06em", color: C.neq, marginTop: 14, textTransform: "uppercase" }}>
          {eventLine}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          bottom: 44,
          fontFamily: F.mono,
          fontSize: 19,
          lineHeight: 1.4,
          color: "#7D8391",
          opacity: prog(frame, 120, 18),
        }}
      >
        Sources shown: {D.meta.title} (Maynooth University, {D.meta.respondents} respondents) · CSO · SEAI · EirGrid · CRU · IEA ·
        Uisce Éireann · Pronin, Lin &amp; Ross (2002). Facts checked {D.factsChecked}.
      </div>
    </AbsoluteFill>
  );
};

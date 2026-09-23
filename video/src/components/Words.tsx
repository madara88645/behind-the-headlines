import React from "react";
import { useCurrentFrame } from "remotion";
import { prog, tween } from "../anim";
import { EASE } from "../theme";

type Props = {
  /** Text to animate. Wrap words in **double asterisks** to paint them in `accent`. */
  text: string;
  /** Frame (relative to the enclosing Sequence) at which the first word starts. */
  start: number;
  /** Frames between words. */
  stagger?: number;
  /** Frames each word takes to rise. */
  dur?: number;
  /** Optional frame at which the whole line fades out. */
  exitAt?: number;
  accent?: string;
  accentWeight?: number;
  style?: React.CSSProperties;
};

/**
 * Kinetic type: each word rises out of its own mask. Driven only by useCurrentFrame(),
 * so every frame renders identically (no CSS animations).
 */
export const Words: React.FC<Props> = ({
  text,
  start,
  stagger = 3,
  dur = 22,
  exitAt,
  accent,
  accentWeight,
  style,
}) => {
  const frame = useCurrentFrame();
  const tokens: { w: string; hot: boolean }[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk) => {
    const hot = chunk.startsWith("**") && chunk.endsWith("**");
    const clean = hot ? chunk.slice(2, -2) : chunk;
    clean
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => tokens.push({ w, hot }));
  });
  const out = exitAt == null ? 1 : 1 - tween(frame, [exitAt, exitAt + 10], [0, 1], EASE.inOut);
  return (
    <div style={{ ...style, opacity: out }}>
      {tokens.map((t, i) => {
        const p = prog(frame, start + i * stagger, dur);
        return (
          <React.Fragment key={i}>
            <span
              style={{
                display: "inline-block",
                overflow: "hidden",
                verticalAlign: "top",
                paddingBottom: "0.12em",
                marginBottom: "-0.12em",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  translate: `0 ${(1 - p) * 110}%`,
                  opacity: Math.min(1, p * 2),
                  color: t.hot && accent ? accent : undefined,
                  fontWeight: t.hot && accentWeight ? accentWeight : undefined,
                }}
              >
                {t.w}
              </span>
            </span>
            {i < tokens.length - 1 ? " " : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

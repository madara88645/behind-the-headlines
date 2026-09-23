import React from "react";
import { AbsoluteFill } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type SweepProps = { color: string; bar?: number; width?: number };

/**
 * A coloured bar sweeps left -> right; the next scene is revealed behind it while the old one
 * drifts slightly left (parallax). Colour = the accent of the scene we are entering.
 */
const Sweep: React.FC<TransitionPresentationComponentProps<SweepProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const W = passedProps.width ?? 1920;
  const BAR = passedProps.bar ?? 220;
  const p = presentationProgress;
  if (presentationDirection === "exiting") {
    // the outgoing scene recedes very slightly (scale keeps it full-bleed - no gaps at the edges)
    return <AbsoluteFill style={{ scale: `${1 + p * 0.04}`, transformOrigin: "0% 50%" }}>{children}</AbsoluteFill>;
  }
  const edge = p * (W + BAR);
  const revealed = Math.max(0, edge - BAR);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${W - revealed}px 0 0)` }}>{children}</AbsoluteFill>
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: edge - BAR,
            width: BAR,
            background: passedProps.color,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const sweep = (props: SweepProps): TransitionPresentation<SweepProps> => ({
  component: Sweep,
  props,
});

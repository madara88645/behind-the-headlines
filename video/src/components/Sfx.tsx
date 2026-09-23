import React, { createContext, useContext } from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";

/**
 * Sound effects. Every file in public/sfx/ is synthesised by scripts/make-sfx.sh (ffmpeg maths,
 * no samples, no music) - so there is nothing to license. Turn all of them off with the
 * composition prop `sound: false`.
 */
export type SfxName = "thump" | "pop" | "tick" | "whoosh" | "flick" | "ratchet";

const LEN: Record<SfxName, number> = { thump: 17, pop: 10, tick: 2, whoosh: 27, flick: 9, ratchet: 69 };

export const SoundContext = createContext<boolean>(true);

export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume = 0.6 }) => {
  const on = useContext(SoundContext);
  if (!on) return null;
  return (
    <Sequence from={Math.round(at)} durationInFrames={LEN[name] + 2} layout="none" name={`sfx:${name}`}>
      <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
    </Sequence>
  );
};

import React, { useMemo } from "react";
import { Audio } from "@remotion/media";
import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Easing, getStaticFiles, staticFile } from "remotion";
import { BubbleSort, BUBBLE_DURATION } from "./scenes/BubbleSort";
import { EndCard, END_DURATION } from "./scenes/EndCard";
import { Findings, FINDINGS_DURATION } from "./scenes/Findings";
import { FiveKm, FIVEKM_DURATION } from "./scenes/FiveKm";
import { Open, OPEN_DURATION } from "./scenes/Open";
import { Rigged, RIGGED_DURATION } from "./scenes/Rigged";
import { TheData, DATA_DURATION } from "./scenes/TheData";
import { WhatWeMade, MADE_DURATION } from "./scenes/WhatWeMade";
import { WorkedDidnt, WORKED_DURATION } from "./scenes/WorkedDidnt";
import type { VideoProps } from "./schema";
import { Sfx, SoundContext } from "./components/Sfx";
import { BS, C, KM } from "./theme";
import { sweep } from "./transitions/sweep";

/* Transition timings (frames). The total length = sum(scenes) - sum(transitions). */
const easeSweep = Easing.bezier(0.65, 0, 0.35, 1);
const TR = {
  openToData: linearTiming({ durationInFrames: 26, easing: easeSweep }),
  dataToMade: linearTiming({ durationInFrames: 16 }),
  madeToBubble: linearTiming({ durationInFrames: 8 }),
  bubbleToKm: linearTiming({ durationInFrames: 26, easing: easeSweep }),
  kmToRigged: springTiming({ config: { damping: 200 }, durationInFrames: 28 }),
  riggedToFindings: linearTiming({ durationInFrames: 26, easing: easeSweep }),
  findingsToWorked: linearTiming({ durationInFrames: 26, easing: easeSweep }),
  workedToEnd: linearTiming({ durationInFrames: 20 }),
};

const SCENES = [
  OPEN_DURATION,
  DATA_DURATION,
  MADE_DURATION,
  BUBBLE_DURATION,
  FIVEKM_DURATION,
  RIGGED_DURATION,
  FINDINGS_DURATION,
  WORKED_DURATION,
  END_DURATION,
];

export const VIDEO_DURATION =
  SCENES.reduce((a, b) => a + b, 0) -
  Object.values(TR).reduce((s, t) => s + t.getDurationInFrames({ fps: 30 }), 0);

/** Optional soundtrack slot: public/audio/soundtrack.mp3 (or .wav / .m4a) plays under the video if present. */
const findSoundtrack = (): string | null => {
  try {
    const f = getStaticFiles().find((x) => /^audio\/soundtrack\.(mp3|wav|m4a)$/.test(x.name));
    return f ? f.name : null;
  } catch {
    return null;
  }
};

/** Absolute start frame of each transition (for the whoosh that accompanies it). */
const transitionStarts = (() => {
  const tr = Object.values(TR).map((t) => t.getDurationInFrames({ fps: 30 }));
  const out: number[] = [];
  let t = 0;
  // scene i+1 starts exactly where transition i starts
  SCENES.slice(0, -1).forEach((d, i) => {
    t += d - tr[i];
    out.push(t);
  });
  return out;
})();
// which transitions get a whoosh (0 = open->data ... 7 = worked->end)
const WHOOSH: Record<number, number> = { 0: 0.55, 3: 0.5, 4: 0.45, 5: 0.55, 6: 0.5, 7: 0.4 };

export const BehindTheHeadlines: React.FC<VideoProps> = (props) => {
  const soundtrack = useMemo(findSoundtrack, []);
  return (
    <SoundContext.Provider value={props.sound}>
    <AbsoluteFill style={{ background: C.ink }}>
      {transitionStarts.map((at, i) =>
        WHOOSH[i] ? <Sfx key={i} name="whoosh" at={at - 4} volume={WHOOSH[i]} /> : null,
      )}
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={OPEN_DURATION} name="00 Cold open + thesis">
          <Open />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={sweep({ color: C.neq })} timing={TR.openToData} />
        <TransitionSeries.Sequence durationInFrames={DATA_DURATION} name="01 The data">
          <TheData />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={TR.dataToMade} />
        <TransitionSeries.Sequence durationInFrames={MADE_DURATION} name="02 What we made">
          <WhatWeMade />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={TR.madeToBubble} />
        <TransitionSeries.Sequence durationInFrames={BUBBLE_DURATION} name="03 Bubble Sort">
          <BubbleSort footage={props.footage} footageStartAt={props.footageStartAt.bubbleSort} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={sweep({ color: KM.notice })} timing={TR.bubbleToKm} />
        <TransitionSeries.Sequence durationInFrames={FIVEKM_DURATION} name="04 5 KM">
          <FiveKm footage={props.footage} footageStartAt={props.footageStartAt.fiveKm} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={TR.kmToRigged} />
        <TransitionSeries.Sequence durationInFrames={RIGGED_DURATION} name="05 Rigged">
          <Rigged footage={props.footage} footageStartAt={props.footageStartAt.rigged} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={sweep({ color: C.neq })} timing={TR.riggedToFindings} />
        <TransitionSeries.Sequence durationInFrames={FINDINGS_DURATION} name="06 What we discovered">
          <Findings />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={sweep({ color: BS.data })} timing={TR.findingsToWorked} />
        <TransitionSeries.Sequence durationInFrames={WORKED_DURATION} name="07 Worked / didn't">
          <WorkedDidnt worked={props.worked} didnt={props.didnt} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={sweep({ color: C.ink, bar: 0 })} timing={TR.workedToEnd} />
        <TransitionSeries.Sequence durationInFrames={END_DURATION} name="08 End card">
          <EndCard
            teamName={props.teamName}
            teamMembers={props.teamMembers}
            eventLine={props.eventLine}
            playLine={props.playLine}
          />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {soundtrack && <Audio src={staticFile(soundtrack)} />}
    </AbsoluteFill>
    </SoundContext.Provider>
  );
};

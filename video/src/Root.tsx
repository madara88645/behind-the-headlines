import { Composition, Folder } from "remotion";
import { BehindTheHeadlines, VIDEO_DURATION } from "./Video";
import { videoSchema } from "./schema";
import { Open, OPEN_DURATION } from "./scenes/Open";
import { TheData, DATA_DURATION } from "./scenes/TheData";
import { WhatWeMade, MADE_DURATION } from "./scenes/WhatWeMade";
import { BubbleSort, BUBBLE_DURATION } from "./scenes/BubbleSort";
import { FiveKm, FIVEKM_DURATION } from "./scenes/FiveKm";
import { Rigged, RIGGED_DURATION } from "./scenes/Rigged";
import { Findings, FINDINGS_DURATION } from "./scenes/Findings";
import { WorkedDidnt, WORKED_DURATION } from "./scenes/WorkedDidnt";
import { EndCard, END_DURATION } from "./scenes/EndCard";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* THE SUBMISSION VIDEO. Edit the texts below (or in Studio's Props panel). */}
      <Composition
        id="BehindTheHeadlines"
        component={BehindTheHeadlines}
        durationInFrames={VIDEO_DURATION}
        fps={30}
        width={1920}
        height={1080}
        schema={videoSchema}
        defaultProps={{
          teamName: "Made at the BU Induction Hack 2026",
          teamMembers: [],
          eventLine: "Data centres: behind the headlines · Make data playable",
          playLine: "Open index.html in any browser - no install.",
          worked: [
            "One data file feeds every survey number in all three games.",
            "Data, opinion and assumption always wear different labels.",
            "Plain HTML: runs offline in any browser, no install.",
          ],
          didnt: [
            "200 people are not Ireland - small groups can only hint.",
            "The town hall vote is a simple model, not a forecast.",
            "We left out the trust questions: their scale direction was unclear.",
          ],
          sound: true,
          footage: "auto",
          footageStartAt: { bubbleSort: 0, fiveKm: 0, rigged: 0 },
        }}
      />

      {/* Each scene on its own, for quick previewing and editing. */}
      <Folder name="Scenes">
        <Composition id="S0-Open" component={Open} durationInFrames={OPEN_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S1-TheData" component={TheData} durationInFrames={DATA_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S2-WhatWeMade" component={WhatWeMade} durationInFrames={MADE_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S3-BubbleSort" component={BubbleSort} durationInFrames={BUBBLE_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S4-FiveKm" component={FiveKm} durationInFrames={FIVEKM_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S5-Rigged" component={Rigged} durationInFrames={RIGGED_DURATION} fps={30} width={1920} height={1080} />
        <Composition id="S6-Findings" component={Findings} durationInFrames={FINDINGS_DURATION} fps={30} width={1920} height={1080} />
        <Composition
          id="S7-WorkedDidnt"
          component={WorkedDidnt}
          durationInFrames={WORKED_DURATION}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            worked: [
              "One data file feeds every survey number in all three games.",
              "Data, opinion and assumption always wear different labels.",
              "Plain HTML: runs offline in any browser, no install.",
            ],
            didnt: [
              "200 people are not Ireland - small groups can only hint.",
              "The town hall vote is a simple model, not a forecast.",
              "We left out the trust questions: their scale direction was unclear.",
            ],
          }}
        />
        <Composition
          id="S8-EndCard"
          component={EndCard}
          durationInFrames={END_DURATION}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            teamName: "Made at the BU Induction Hack 2026",
            teamMembers: [],
            eventLine: "Data centres: behind the headlines · Make data playable",
            playLine: "Open index.html in any browser - no install.",
          }}
        />
      </Folder>
    </>
  );
};

import { z } from "zod";

/**
 * Editable props of the main composition. Change them in Remotion Studio (right-hand "Props" panel,
 * then "Save") or directly in the defaultProps object in src/Root.tsx.
 */
export const videoSchema = z.object({
  /** End card: team name. */
  teamName: z.string(),
  /** End card: member names (leave empty to hide the line). */
  teamMembers: z.array(z.string()),
  /** End card: event line. */
  eventLine: z.string(),
  /** End card: how to play. */
  playLine: z.string(),
  /** "What worked" - up to 4 short lines. */
  worked: z.array(z.string()).max(4),
  /** "What didn't (yet)" - up to 4 short lines. */
  didnt: z.array(z.string()).max(4),
  /** Synthesised sound effects (public/sfx, made by scripts/make-sfx.sh). false = silent video. */
  sound: z.boolean(),
  /** "auto" = use public/footage/<game>.mp4 when the file exists; "off" = always use the recreations. */
  footage: z.enum(["auto", "off"]),
  /** Seconds to skip at the start of each footage file. */
  footageStartAt: z.object({
    bubbleSort: z.number().min(0),
    fiveKm: z.number().min(0),
    rigged: z.number().min(0),
  }),
});

export type VideoProps = z.infer<typeof videoSchema>;

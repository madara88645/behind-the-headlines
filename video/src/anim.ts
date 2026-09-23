import { Easing, interpolate, spring } from "remotion";
import { EASE } from "./theme";

type Curve = readonly [number, number, number, number];

/** Clamped interpolation with a bezier curve (default: expo-out). Frame-driven, deterministic. */
export const tween = (
  frame: number,
  range: [number, number],
  output: [number, number],
  curve: Curve = EASE.out,
): number =>
  interpolate(frame, range, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...curve),
  });

/** 0 -> 1 progress starting at `start` for `dur` frames. */
export const prog = (frame: number, start: number, dur: number, curve: Curve = EASE.out): number =>
  tween(frame, [start, start + dur], [0, 1], curve);

/** Fade in at `start`, optionally fade out ending at `end`. */
export const inOut = (frame: number, start: number, end?: number, fade = 12): number => {
  const a = prog(frame, start, fade);
  if (end == null) return a;
  return Math.min(a, 1 - prog(frame, end - fade, fade, EASE.inOut));
};

/** Physically-based spring from 0 to 1 starting at `delay`. */
export const pop = (
  frame: number,
  fps: number,
  delay: number,
  config: Partial<{ damping: number; stiffness: number; mass: number }> = { damping: 14, stiffness: 160 },
): number => spring({ frame: frame - delay, fps, config });

/** Linear mix. */
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Damped "gulp" squash & stretch, returns [scaleX, scaleY] for a contact at `at` (~450 ms). */
export const gulp = (frame: number, at: number, fps: number): [number, number] => {
  const t = frame - at;
  if (t < 0) return [1, 1];
  const s = t / fps; // seconds
  const env = Math.exp(-s * 7);
  const w = Math.sin(s * Math.PI * 2 * 2.6);
  return [1 + 0.12 * env * w, 1 - 0.1 * env * w];
};

/** Small deterministic shake that decays after `at`. */
export const shake = (frame: number, at: number, amp = 8, dur = 14): { x: number; y: number } => {
  const t = frame - at;
  if (t < 0 || t > dur) return { x: 0, y: 0 };
  const k = 1 - t / dur;
  return { x: Math.sin(t * 2.7) * amp * k, y: Math.cos(t * 3.3) * amp * 0.6 * k };
};

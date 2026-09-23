/**
 * Design tokens. Every colour and font here is taken from the project's own design language:
 *  - launcher (index.html): Schibsted Grotesk + IBM Plex Mono, ink/paper neutrals, orange ≠ signs
 *  - docs/specs/bubble-sort.md, 5km.md, rigged.md: each game's palette and type
 */
import { loadFont as loadSchibsted } from "@remotion/google-fonts/SchibstedGrotesk";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";
import { loadFont as loadAtkinson } from "@remotion/google-fonts/AtkinsonHyperlegible";
import { loadFont as loadJetBrains } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";
import { loadFont as loadPublicSans } from "@remotion/google-fonts/PublicSans";
import { loadFont as loadChivo } from "@remotion/google-fonts/Chivo";
import { loadFont as loadChivoMono } from "@remotion/google-fonts/ChivoMono";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";

const latin = { subsets: ["latin"] as "latin"[] };

export const F = {
  display: loadSchibsted("normal", { weights: ["400", "500", "700", "900"], ...latin }).fontFamily,
  mono: loadPlexMono("normal", { weights: ["400", "500", "600"], ...latin }).fontFamily,
  // Bubble Sort
  bricolage: loadBricolage("normal", { weights: ["700", "800"], ...latin }).fontFamily,
  atkinson: loadAtkinson("normal", { weights: ["400", "700"], ...latin }).fontFamily,
  jetbrains: loadJetBrains("normal", { weights: ["400", "500"], ...latin }).fontFamily,
  // 5 KM
  archivo: loadArchivo("normal", { weights: ["700", "800", "900"], ...latin }).fontFamily,
  archivoBlack: loadArchivoBlack("normal", { weights: ["400"], ...latin }).fontFamily,
  publicSans: loadPublicSans("normal", { weights: ["400", "600", "700"], ...latin }).fontFamily,
  // Rigged
  chivo: loadChivo("normal", { weights: ["400", "700", "900"], ...latin }).fontFamily,
  chivoMono: loadChivoMono("normal", { weights: ["400", "500", "700"], ...latin }).fontFamily,
  caveat: loadCaveat("normal", { weights: ["600", "700"], ...latin }).fontFamily,
};

/** Launcher tokens (index.html). Dark variants come from its prefers-color-scheme: dark block. */
export const C = {
  ink: "#111318",
  inkRaised: "#171A21",
  paper: "#F3F4F6",
  card: "#FFFFFF",
  rule: "#D9DCE2",
  ruleDark: "#2A2E37",
  muted: "#555B66",
  mutedDark: "#A6ACB8",
  white: "#F2F3F5",
  neq: "#E4572E",
  data: "#1F5BFF",
  opinion: "#D6246E",
  assume: "#C27100",
  dataDark: "#7FA2FF",
  opinionDark: "#FF6FA8",
  assumeDark: "#FFB547",
};

/** Bubble Sort (docs/specs/bubble-sort.md) */
export const BS = {
  sky: "#EEF0FF",
  skyDeep: "#E3E6FF",
  ink: "#1B1B3A",
  data: "#1F5BFF",
  opinion: "#D6246E",
  assume: "#F2A007",
  assumeInk: "#9A6300",
  card: "#FFFFFF",
  muted: "#5D5F86",
  right: "#0B8A4A",
  wrong: "#C8102E",
};

/** 5 KM (docs/specs/5km.md) */
export const KM = {
  field: "#DDE8CF",
  fieldDeep: "#9DBF86",
  hedge: "#3E6B3A",
  notice: "#FFD400",
  ink: "#151A14",
  road: "#E4572E",
  against: "#B8322A",
  neutral: "#8C8F86",
  accept: "#1F6E8C",
  sea: "#CFE0D1",
  seaLine: "#B3CDB9",
  town: "#34402F",
};

/** RIGGED (docs/specs/rigged.md) */
export const RG = {
  paper: "#E6F0EA",
  grid: "#C9DDD1",
  sheet: "#FBFDFC",
  ink: "#14213D",
  pencil: "#5B6B7F",
  red: "#D62828",
  marker: "#FFE45C",
  data: "#1D6FA5",
  opinion: "#7A3DB8",
  assume: "#C27100",
};

/** Motion curves used everywhere (expo-out for entrances, a softer in-out for moves). */
export const EASE = {
  out: [0.16, 1, 0.3, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  in: [0.7, 0, 0.84, 0] as const,
};

/** Safe area for 1920x1080: key content stays inside these margins. */
export const SAFE = { x: 120, top: 120, bottom: 110 };

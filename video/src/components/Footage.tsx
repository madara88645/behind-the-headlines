import React from "react";
import { Video } from "@remotion/media";
import { getStaticFiles, staticFile, useVideoConfig } from "remotion";
import { F } from "../theme";

/**
 * GAMEPLAY FOOTAGE SLOT
 * ---------------------
 * Drop real screen recordings into  video/public/footage/  with these exact names:
 *
 *   footage/bubble-sort.mp4   footage/5km.mp4   footage/rigged.mp4
 *
 * If a file exists (and the `footage` prop is "auto"), the game scene shows the recording in a
 * browser frame instead of the motion-graphics recreation. If it does not exist, the recreation
 * plays. getStaticFiles() works in the Studio and during CLI renders.
 */
export type FootageId = "bubble-sort" | "5km" | "rigged";

export const footagePath = (id: FootageId) => `footage/${id}.mp4`;

export const hasFootage = (id: FootageId): boolean => {
  try {
    return getStaticFiles().some((f) => f.name === footagePath(id));
  } catch {
    return false;
  }
};

/** Browser-window frame, so the recording reads as "the real thing running in a browser". */
export const BrowserFrame: React.FC<{
  width: number;
  height: number;
  url: string;
  children: React.ReactNode;
  tone?: "light" | "dark";
  style?: React.CSSProperties;
}> = ({ width, height, url, children, tone = "light", style }) => {
  const bar = 54;
  const bg = tone === "light" ? "#FFFFFF" : "#1B1E25";
  const fg = tone === "light" ? "#5B6170" : "#A6ACB8";
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: "hidden",
        background: bg,
        boxShadow: "0 40px 80px -40px rgba(10,12,20,.45), 0 0 0 1.5px rgba(10,12,20,.12)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", flex: "none" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, display: "inline-block" }} />
        ))}
        <div
          style={{
            marginLeft: 18,
            flex: 1,
            height: 32,
            borderRadius: 8,
            background: tone === "light" ? "#F1F2F5" : "#262A33",
            color: fg,
            fontFamily: F.mono,
            fontSize: 17,
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** The recording itself (muted, cover-fit). `startAt` = seconds to skip at the start of the file. */
export const FootageVideo: React.FC<{ id: FootageId; startAt?: number }> = ({ id, startAt = 0 }) => {
  const { fps } = useVideoConfig();
  return (
    <Video
      src={staticFile(footagePath(id))}
      muted
      loop
      objectFit="cover"
      trimBefore={Math.round(startAt * fps)}
      style={{ width: "100%", height: "100%" }}
    />
  );
};

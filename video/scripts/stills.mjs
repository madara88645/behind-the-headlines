/**
 * stills.mjs - bundle once, then render several stills (much faster than one CLI call per frame).
 *
 *   node scripts/stills.mjs <compositionId> <outDir> <frame> [frame...] [--scale=0.5]
 *   node scripts/stills.mjs BehindTheHeadlines out/stills 380 1500 2700 4100
 */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const args = process.argv.slice(2);
const scaleArg = args.find((a) => a.startsWith("--scale="));
const scale = scaleArg ? Number(scaleArg.split("=")[1]) : 1;
const [id, outDir, ...frames] = args.filter((a) => !a.startsWith("--"));
if (!id || !outDir || frames.length === 0) {
  console.error("usage: node scripts/stills.mjs <compositionId> <outDir> <frame...> [--scale=0.5]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
  enableCaching: true,
});
const composition = await selectComposition({ serveUrl, id });
for (const f of frames) {
  const frame = Number(f);
  const output = path.join(outDir, `${id}-${String(frame).padStart(5, "0")}.png`);
  await renderStill({ composition, serveUrl, output, frame, scale, imageFormat: "png" });
  console.log("wrote", output);
}

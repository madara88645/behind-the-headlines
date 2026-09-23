/**
 * Remotion CLI config. Applies to `npx remotion studio|render|still`.
 * All options: https://remotion.dev/docs/config
 */
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
// H.264 + yuv420p plays everywhere (QuickTime, browsers, YouTube, Teams).
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Tag + convert as BT.709 so browser colours survive encoding (this becomes the default in Remotion 5).
Config.setColorSpace("bt709");
// CRF 16 = visually lossless-ish for flat motion graphics; "slow" preset squeezes the file a little.
Config.setCrf(16);
Config.setX264Preset("slow");

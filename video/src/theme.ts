import { loadFont as loadLocalFont } from "@remotion/fonts";
import { loadFont as loadBowlby } from "@remotion/google-fonts/BowlbyOne";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Easing, staticFile } from "remotion";

// Tokens from design/DESIGN.md, named the way app/globals.css names them.
export const C = {
  carbon: "#000000",
  paper: "#ffffff",
  sky: "#dceeff",
  concrete: "#cccccc",
  mist: "#e9e9e9",
  blue: "#4da2ff",
  mint: "#55db9c",
  lavender: "#e9ccff",
  ember: "#fb4903",
  sun: "#ffd731",
  violet: "#5c4ade",
  inkSoft: "#3d3d3d",
} as const;

export type StickerColor = "blue" | "mint" | "lavender" | "ember" | "sun" | "violet";

const bowlby = loadBowlby("normal", { weights: ["400"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] });
void loadLocalFont({ family: "General Sans", url: staticFile("fonts/GeneralSans-Medium.woff2"), weight: "500" });
void loadLocalFont({ family: "General Sans", url: staticFile("fonts/GeneralSans-Bold.woff2"), weight: "700" });

export const FONT = {
  display: `${bowlby.fontFamily}, sans-serif`,
  ui: `"General Sans", ui-sans-serif, system-ui, sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
// The stage sits between the top bar and the caption band.
export const STAGE = { top: 112, bottom: 912 } as const;

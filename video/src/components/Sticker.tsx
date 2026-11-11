import type { CSSProperties, ReactNode } from "react";
import { Img, staticFile } from "remotion";
import { C, FONT, type StickerColor } from "../theme";

export type IconName =
  | "box" | "check" | "circle-alert" | "clapperboard" | "clock" | "film" | "info" | "pencil"
  | "refresh-cw" | "rotate-ccw" | "sparkles" | "triangle-alert" | "x" | "github" | "linkedin" | "globe" | "log-in";

// The app's sticker: a flat colored tile, black outline, black line icon.
export function Sticker({ icon, color, size = 96, rotate = 0, style }: { icon: IconName; color: StickerColor; size?: number; rotate?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        background: C[color],
        border: `${Math.max(2, size / 40)}px solid ${C.carbon}`,
        display: "grid",
        placeItems: "center",
        rotate: `${rotate}deg`,
        ...style,
      }}
    >
      <Img src={staticFile(`icons/${icon}.svg`)} style={{ width: size * 0.5, height: size * 0.5 }} />
    </div>
  );
}

// A rotated label sticker for callouts that sit on top of a panel edge.
export function Label({ children, color = "sun", rotate = -3, size = 30, style }: { children: ReactNode; color?: StickerColor | "paper" | "carbon"; rotate?: number; size?: number; style?: CSSProperties }) {
  const dark = color === "carbon" || color === "violet";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: `${size * 0.42}px ${size * 0.8}px`,
        borderRadius: 1600,
        border: `2.5px solid ${C.carbon}`,
        background: C[color],
        color: dark ? C.paper : C.carbon,
        fontFamily: FONT.ui,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.02em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        rotate: `${rotate}deg`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

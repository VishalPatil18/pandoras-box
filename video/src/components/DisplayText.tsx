import { interpolate, useCurrentFrame } from "remotion";
import { C, CLAMP, EASE, FONT } from "../theme";

// The app's hero motion: letters climb out of each word's line one by one, alternating tilt.
export function DisplayText({ lines, size, at = 0, color = C.carbon, stagger = 1.6 }: { lines: string[]; size: number; at?: number; color?: string; stagger?: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ fontFamily: FONT.display, fontSize: size, lineHeight: 0.8, color, textTransform: "uppercase", textAlign: "center" }}>
      {lines.map((line, row) => (
        <div key={line} style={{ overflow: "hidden", paddingTop: "0.08em", paddingBottom: "0.02em" }}>
          {[...line].map((char, i) => {
            const start = at + row * 9 + i * stagger;
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  whiteSpace: "pre",
                  translate: interpolate(frame, [start, start + 14], ["0px 105%", "0px 0%"], { ...CLAMP, easing: EASE.overshoot }),
                  rotate: interpolate(frame, [start, start + 14], [`${i % 2 ? 9 : -9}deg`, "0deg"], { ...CLAMP, easing: EASE.out }),
                  opacity: interpolate(frame, [start, start + 4], [0, 1], CLAMP),
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

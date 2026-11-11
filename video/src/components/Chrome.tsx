import { Audio } from "@remotion/media";
import { AbsoluteFill, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TIMELINE } from "../timeline";
import { C, CLAMP, EASE, FONT, type StickerColor } from "../theme";
import { Sticker, type IconName } from "./Sticker";

const MARQUEE = "PANDORAS BOX  ✦  VARIANT A: CACHING AND CORRECTNESS  ✦  VARIANT B: CLIENT ORCHESTRATION  ✦  NEXT.JS  ✦  PRISMA  ✦  POSTGRES  ✦  OPENAI  ✦  ";
const LOOP_FRAMES = 900;
const SECTION_COLORS: StickerColor[] = ["sun", "lavender", "mint", "ember", "blue", "violet", "sun"];

// The design system's one moving element: a black marquee band across the top.
export function Marquee() {
  const frame = useCurrentFrame();
  // Four copies; shifting by half the row (two copies) loops seamlessly without measuring text.
  const progress = (frame % LOOP_FRAMES) / LOOP_FRAMES;
  return (
    <AbsoluteFill style={{ height: 40, background: C.carbon, overflow: "hidden", justifyContent: "center" }}>
      <div style={{ display: "flex", width: "max-content", translate: `${-progress * 50}% 0px`, whiteSpace: "nowrap" }}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 17, letterSpacing: "0.06em", color: C.paper, flexShrink: 0, paddingRight: 24 }}>
            {MARQUEE}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
}

// Chapter pill on the left, wordmark on the right; hidden on full-bleed title moments.
export function TopBar() {
  const frame = useCurrentFrame();
  const index = TIMELINE.sections.findLastIndex((s) => frame >= s.from);
  const current = TIMELINE.sections[Math.max(0, index)];
  const intro = TIMELINE.sections[0].lines["app-2"].from;
  const outro = TIMELINE.sections[TIMELINE.sections.length - 1];
  const visible =
    interpolate(frame, [intro - 6, intro + 8], [0, 1], CLAMP) *
    interpolate(frame, [outro.from, outro.from + 8], [1, 0], CLAMP);
  const localFrame = frame - current.from;
  return (
    <AbsoluteFill style={{ top: 52, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 84px", opacity: visible }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          height: 50,
          padding: "0 22px 0 6px",
          borderRadius: 1600,
          border: `2.5px solid ${C.carbon}`,
          background: C.paper,
          translate: interpolate(localFrame, [10, 26], ["0px -70px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
        }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 99, border: `2px solid ${C.carbon}`, background: C[SECTION_COLORS[index] ?? "sun"], display: "grid", placeItems: "center", fontFamily: FONT.ui, fontWeight: 700, fontSize: 17 }}>
          {current.section.chapter}
        </div>
        <span style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 21, letterSpacing: "0.032em", textTransform: "uppercase" }}>{current.section.title}</span>
      </div>
      <span style={{ fontFamily: FONT.display, fontSize: 28, lineHeight: 1, textTransform: "uppercase" }}>Pandoras Box</span>
    </AbsoluteFill>
  );
}

// Between chapters a color panel wipes up with the chapter number, then wipes away.
export function ChapterCards() {
  const frame = useCurrentFrame();
  return (
    <>
      {TIMELINE.sections.slice(1).map((entry, i) => {
        const firstLine = Object.values(entry.lines)[0];
        const end = entry.from + firstLine.from + 4;
        const start = end - 52;
        if (frame < start - 1 || frame > end + 1) return null;
        const local = frame - start;
        const color = SECTION_COLORS[i + 1];
        const enter = interpolate(local, [0, 13], [100, 0], { ...CLAMP, easing: EASE.inOut });
        const exit = interpolate(local, [40, 52], [0, -100], { ...CLAMP, easing: EASE.inOut });
        return (
          <AbsoluteFill key={entry.section.id} style={{ translate: `0px ${enter + exit}%`, background: C[color], alignItems: "center", justifyContent: "center", gap: 10 }}>
            <Sequence from={start} durationInFrames={30} layout="none">
              <Audio src={staticFile("sfx/whoosh.wav")} volume={0.3} />
            </Sequence>
            <div style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 34, letterSpacing: "0.06em", color: color === "violet" ? C.paper : C.carbon }}>CHAPTER {entry.section.chapter}</div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 170,
                lineHeight: 0.8,
                textTransform: "uppercase",
                color: color === "violet" ? C.paper : C.carbon,
                translate: interpolate(local, [6, 22], ["0px 40px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
              }}
            >
              {entry.section.title}
            </div>
          </AbsoluteFill>
        );
      })}
    </>
  );
}

const DECOR: { icon: IconName; color: StickerColor; x: number; y: number; r: number; size: number }[] = [
  { icon: "film", color: "ember", x: 70, y: 180, r: -14, size: 92 },
  { icon: "sparkles", color: "sun", x: 1770, y: 160, r: 12, size: 84 },
  { icon: "check", color: "mint", x: 60, y: 760, r: 10, size: 80 },
  { icon: "clapperboard", color: "lavender", x: 1760, y: 740, r: -9, size: 100 },
];

// Sky wash ground with a few stickers parked in the margins, drifting slightly.
export function Background() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.sky }}>
      {DECOR.map((d, i) => (
        <div key={d.icon} style={{ position: "absolute", left: d.x, top: d.y + Math.sin(frame / 40 + i * 1.7) * 7 }}>
          <Sticker icon={d.icon} color={d.color} size={d.size} rotate={d.r + Math.sin(frame / 55 + i) * 2} />
        </div>
      ))}
    </AbsoluteFill>
  );
}

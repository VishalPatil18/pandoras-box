import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TIMELINE } from "../timeline";
import { C, CLAMP, FONT } from "../theme";

const MAX_CHARS = 62;
const HOLD_GAP = 14;

type Page = { text: string; from: number; to: number };

// Splits a sentence into short caption pages, breaking after punctuation where possible.
function paginate(text: string): string[] {
  const words = text.split(" ");
  const pages: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const breakHere = current.length > MAX_CHARS * 0.55 && /[,.:?]$/.test(current);
    if (next.length > MAX_CHARS || breakHere) {
      pages.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);
  return pages;
}

// Each page gets a slice of its sentence's audio in proportion to its length.
const PAGES: Page[] = TIMELINE.lines.flatMap((line, index) => {
  const parts = paginate(line.text);
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const next = TIMELINE.lines[index + 1];
  const tail = next && next.from - line.to <= HOLD_GAP ? next.from : line.to + 6;
  let cursor = line.from;
  return parts.map((text, i) => {
    const length = ((line.to - line.from) * text.length) / total;
    const page = { text, from: Math.round(cursor), to: i === parts.length - 1 ? tail : Math.round(cursor + length) };
    cursor += length;
    return page;
  });
});

export function Captions() {
  const frame = useCurrentFrame();
  const page = PAGES.find((p) => frame >= p.from && frame < p.to);
  if (!page) return null;
  return (
    <AbsoluteFill style={{ top: 934, height: 100, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          maxWidth: 1600,
          padding: "14px 30px",
          borderRadius: 18,
          background: C.carbon,
          color: C.paper,
          fontFamily: FONT.ui,
          fontWeight: 500,
          fontSize: 38,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
          textAlign: "center",
          opacity: interpolate(frame, [page.from, page.from + 3], [0.4, 1], CLAMP),
          translate: interpolate(frame, [page.from, page.from + 5], ["0px 6px", "0px 0px"], CLAMP),
        }}
      >
        {page.text}
      </div>
    </AbsoluteFill>
  );
}

import { interpolate, useCurrentFrame } from "remotion";
import code from "../code.json";
import { C, CLAMP, EASE, FONT, type StickerColor } from "../theme";
import { Label } from "./Sticker";

export type ExcerptId = keyof typeof code;
type Row = { n: number | null; tokens: { t: string; c: string }[] };

// A focus step: from frame `at`, these source line numbers are lit and everything else dims.
export type Focus = { at: number; lines: [number, number] };
export type Note = { at: number; line: number; text: string; color?: StickerColor };

const FONT_SIZE = 24;
const LINE_HEIGHT = 38;
const MOVE_FRAMES = 14;
const HEADER = 64;
const PAD = 26;

function blend(steps: { at: number; value: number }[], frame: number, initial: number): number {
  let value = initial;
  for (const step of steps) {
    if (frame < step.at) break;
    value = interpolate(frame, [step.at, step.at + MOVE_FRAMES], [value, step.value], { ...CLAMP, easing: EASE.inOut });
  }
  return value;
}

export function CodePanel({
  id,
  focus = [],
  notes = [],
  width = 1700,
  maxRows = 17,
  enterAt = 0,
}: {
  id: ExcerptId;
  focus?: Focus[];
  notes?: Note[];
  width?: number;
  maxRows?: number;
  enterAt?: number;
}) {
  const frame = useCurrentFrame();
  const excerpt = code[id] as { file: string; rows: Row[] };
  const rows = excerpt.rows;
  const visibleRows = Math.min(rows.length, maxRows);
  const viewport = visibleRows * LINE_HEIGHT;
  const indexOf = (line: number) => Math.max(0, rows.findIndex((row) => row.n === line));

  // Band position, size and scroll all glide between focus steps.
  const steps = focus.map((f) => ({ at: f.at, a: indexOf(f.lines[0]), b: indexOf(f.lines[1]) }));
  const bandTop = blend(steps.map((s) => ({ at: s.at, value: s.a * LINE_HEIGHT })), frame, steps[0] ? steps[0].a * LINE_HEIGHT : 0);
  const bandHeight = blend(steps.map((s) => ({ at: s.at, value: (s.b - s.a + 1) * LINE_HEIGHT })), frame, steps[0] ? (steps[0].b - steps[0].a + 1) * LINE_HEIGHT : 0);
  const maxScroll = Math.max(0, rows.length * LINE_HEIGHT - viewport);
  const scrollFor = (s: { a: number; b: number }) => Math.min(maxScroll, Math.max(0, ((s.a + s.b + 1) / 2) * LINE_HEIGHT - viewport / 2));
  const scroll = blend(steps.map((s) => ({ at: s.at, value: scrollFor(s) })), frame, steps[0] ? scrollFor(steps[0]) : 0);
  const bandOn = steps.length > 0 ? interpolate(frame, [steps[0].at, steps[0].at + 10], [0, 1], CLAMP) : 0;
  const activeIndex = steps.findLastIndex((s) => frame >= s.at);
  const active = steps[activeIndex];
  const previous = steps[activeIndex - 1];
  const inStep = (step: (typeof steps)[number] | undefined, index: number) => !step || (index >= step.a && index <= step.b);
  const lit = (index: number) => inStep(active, index);
  // Rows fade between dim and lit as the focus moves, instead of snapping.
  const brightness = (index: number) =>
    active
      ? interpolate(frame, [active.at, active.at + 10], [inStep(previous, index) ? 1 : 0.3, lit(index) ? 1 : 0.3], CLAMP)
      : 1;

  return (
    <div style={{ position: "relative", width }}>
      <div
        style={{
          width,
          borderRadius: 28,
          border: `2.5px solid ${C.carbon}`,
          background: C.carbon,
          overflow: "hidden",
          opacity: interpolate(frame, [enterAt, enterAt + 10], [0, 1], CLAMP),
        }}
      >
        <div style={{ height: HEADER, display: "flex", alignItems: "center", gap: 14, padding: `0 ${PAD}px`, borderBottom: "1.5px solid #262626" }}>
          <div style={{ width: 14, height: 14, borderRadius: 99, background: C.sun }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 22, color: C.paper, fontWeight: 700 }}>{excerpt.file}</span>
        </div>
        <div style={{ position: "relative", height: viewport, margin: `${PAD - 6}px 0 ${PAD}px`, overflow: "hidden" }}>
          <div style={{ translate: `0px ${-scroll}px` }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: bandTop,
                height: bandHeight,
                background: "rgba(77, 162, 255, 0.16)",
                borderLeft: `5px solid ${C.blue}`,
                opacity: bandOn,
              }}
            />
            {rows.map((row, index) => {
              const enter = enterAt + 4 + Math.min(index, 18);
              return (
                <div
                  key={index}
                  style={{
                    position: "relative",
                    height: LINE_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    fontFamily: FONT.mono,
                    fontSize: FONT_SIZE,
                    whiteSpace: "pre",
                    opacity: interpolate(frame, [enter, enter + 8], [0, 1], CLAMP) * brightness(index),
                    translate: interpolate(frame, [enter, enter + 10], ["-14px 0px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
                  }}
                >
                  <span style={{ width: 72, paddingRight: 22, textAlign: "right", color: lit(index) && active ? C.paper : "#5c5c5c", flexShrink: 0 }}>
                    {row.n ?? ""}
                  </span>
                  {row.n === null ? (
                    <span style={{ color: "#5c5c5c" }}>⋯</span>
                  ) : (
                    row.tokens.map((token, i) => (
                      <span key={i} style={{ color: token.c }}>
                        {token.t}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {notes.map((note) => {
        const y = HEADER + PAD - 6 + indexOf(note.line) * LINE_HEIGHT + LINE_HEIGHT / 2 - scroll;
        return (
          <div
            key={`${note.at}-${note.line}`}
            style={{
              position: "absolute",
              right: -26,
              top: y,
              translate: "0px -50%",
              opacity: interpolate(frame, [note.at, note.at + 6], [0, 1], CLAMP),
              scale: interpolate(frame, [note.at, note.at + 14], [0.5, 1], { ...CLAMP, easing: EASE.overshoot }),
            }}
          >
            <Label color={note.color ?? "sun"} rotate={-3}>
              {note.text}
            </Label>
          </div>
        );
      })}
    </div>
  );
}

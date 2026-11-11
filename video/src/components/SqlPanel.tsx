import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import sql from "../../public/captures/sql.json";
import { C, CLAMP, EASE, FONT, type StickerColor } from "../theme";
import { Label } from "./Sticker";

// Matches the rows shown: the capture ran the same query with a larger limit.
const ROWS = 3;
const QUERY = `select "movieTitle", left("text", 40), "createdAt" from fact order by "createdAt" desc limit ${ROWS};`;
const ROW_HEIGHT = 74;
const COLUMNS = ["movieTitle", "left", "createdAt"];
const WIDTHS = [250, 640, 400];
// Tags start past the last column so they never cover data.
const TAG_LEFT = 1250;
const QUERY_HEIGHT = 124;
const HEAD_HEIGHT = 62;
// Top of the first result row inside the panel, border included.
const BODY_TOP = 2.5 + QUERY_HEIGHT + HEAD_HEIGHT;

export type RowTag = { at: number; rows: number[]; text: string; color: StickerColor };

const keyword = /\b(select|from|order by|desc|limit|left)\b/g;

function Query() {
  const parts = QUERY.split(keyword);
  return (
    <div style={{ fontFamily: FONT.mono, fontSize: 23, color: C.paper, lineHeight: 1.5 }}>
      {parts.map((part, i) => (
        <span key={i} style={{ color: i % 2 ? C.lavender : part.includes('"') ? C.mint : C.paper }}>
          {part}
        </span>
      ))}
    </div>
  );
}

// The SQL editor from the walkthrough, filled with the rows the capture run actually wrote.
export function SqlPanel({ insertAt, tags = [] }: { insertAt?: number; tags?: RowTag[] }) {
  const frame = useCurrentFrame();
  const inserting = insertAt !== undefined;
  const rows = (inserting ? sql.before : sql.after).slice(0, ROWS);
  const newRow = sql.after[0];
  const slide = inserting ? interpolate(frame, [insertAt, insertAt + 16], [0, 1], { ...CLAMP, easing: EASE.out }) : 0;
  const shown = inserting ? [newRow, ...rows] : rows;

  return (
    <div style={{ position: "relative", width: 1500 }}>
      <div style={{ borderRadius: 28, border: `2.5px solid ${C.carbon}`, overflow: "hidden", background: C.paper }}>
        <div style={{ background: C.carbon, padding: "0 30px", height: QUERY_HEIGHT, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 18, letterSpacing: "0.04em", color: "#9a9a9a", marginBottom: 8 }}>SQL EDITOR</div>
          <Query />
        </div>
        <div style={{ display: "flex", alignItems: "center", height: HEAD_HEIGHT, boxSizing: "border-box", background: C.sky, borderBottom: `2px solid ${C.carbon}` }}>
          {COLUMNS.map((col, i) => (
            <div key={col} style={{ width: WIDTHS[i], padding: "0 24px", fontFamily: FONT.ui, fontWeight: 700, fontSize: 22 }}>
              {col}
            </div>
          ))}
        </div>
        <div style={{ position: "relative", height: ROWS * ROW_HEIGHT, overflow: "hidden" }}>
          <div style={{ translate: `0px ${inserting ? (slide - 1) * ROW_HEIGHT : 0}px` }}>
            {shown.map((row, index) => {
              const isNew = inserting && index === 0;
              return (
                <div
                  key={`${row[2]}-${index}`}
                  style={{
                    display: "flex",
                    height: ROW_HEIGHT,
                    alignItems: "center",
                    borderTop: index === 0 ? "none" : "1.5px solid rgba(0,0,0,0.12)",
                    background: isNew ? `rgba(85, 219, 156, ${0.45 * slide})` : "transparent",
                    fontFamily: FONT.mono,
                    fontSize: 22,
                  }}
                >
                  {row.map((cell, i) => (
                    <div key={i} style={{ width: WIDTHS[i], padding: "0 24px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {cell}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {inserting && (
        <>
          <Sequence from={insertAt} durationInFrames={45} layout="none">
            <Audio src={staticFile("sfx/ding.wav")} volume={0.22} />
          </Sequence>
          <div
            style={{
              position: "absolute",
              left: TAG_LEFT,
              top: BODY_TOP + ROW_HEIGHT / 2,
              translate: "0px -50%",
              opacity: interpolate(frame, [insertAt + 8, insertAt + 14], [0, 1], CLAMP),
              scale: interpolate(frame, [insertAt + 8, insertAt + 22], [0.5, 1], { ...CLAMP, easing: EASE.overshoot }),
            }}
          >
            <Label color="mint" rotate={4} size={34}>
              +1 row
            </Label>
          </div>
        </>
      )}
      {tags.map((tag) => {
        const top = BODY_TOP + ((tag.rows[0] + tag.rows[tag.rows.length - 1] + 1) / 2) * ROW_HEIGHT;
        return (
          <div
            key={tag.text}
            style={{
              position: "absolute",
              left: TAG_LEFT,
              top,
              translate: "0px -50%",
              opacity: interpolate(frame, [tag.at, tag.at + 6], [0, 1], CLAMP) * (tags.some((t) => t.at > tag.at && frame >= t.at) ? 0 : 1),
              scale: interpolate(frame, [tag.at, tag.at + 14], [0.5, 1], { ...CLAMP, easing: EASE.overshoot }),
            }}
          >
            <Label color={tag.color} rotate={-3} size={30}>
              {tag.text}
            </Label>
          </div>
        );
      })}
      {tags.map((tag) => {
        const on = interpolate(frame, [tag.at, tag.at + 8], [0, 1], CLAMP);
        const off = tags.some((t) => t.at > tag.at && frame >= t.at) ? 0 : 1;
        return (
          <div
            key={`band-${tag.text}`}
            style={{
              position: "absolute",
              left: 2.5,
              right: 2.5,
              top: BODY_TOP + tag.rows[0] * ROW_HEIGHT,
              height: tag.rows.length * ROW_HEIGHT,
              background: C[tag.color],
              mixBlendMode: "multiply",
              opacity: on * off * 0.55,
            }}
          />
        );
      })}
    </div>
  );
}

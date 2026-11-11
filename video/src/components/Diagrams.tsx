import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, CLAMP, EASE, FONT, type StickerColor } from "../theme";
import { Cursor, type CursorPoint } from "./Cursor";
import { DisplayText } from "./DisplayText";
import { Label, Sticker } from "./Sticker";

const ease = (frame: number, range: [number, number], out: [number, number], easing = EASE.out) =>
  interpolate(frame, range, out, { ...CLAMP, easing });

function Box({ x, y, w, h, bg, children, rotate = 0, opacity = 1 }: { x: number; y: number; w: number; h: number; bg: string; children: React.ReactNode; rotate?: number; opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 22,
        border: `2.5px solid ${C.carbon}`,
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        fontFamily: FONT.ui,
        fontWeight: 700,
        fontSize: 30,
        rotate: `${rotate}deg`,
        opacity,
      }}
    >
      {children}
    </div>
  );
}

const REQUESTS = ["Tab 1", "Tab 2", "Refresh"];
const ROW_Y = [130, 330, 530];
const PILL = { w: 230, h: 84 };
const DB = { x: 720, y: 270, w: 340, h: 220 };
const AI = { x: 1330, y: 315, w: 260, h: 130 };

// Three requests race for one conditional UPDATE; one wins, the rest poll and share its fact.
export function RaceDiagram({ phase }: { phase: "claim" | "poll" }) {
  const frame = useCurrentFrame();
  const claim = phase === "claim";
  const f = claim ? frame : 80;
  const p = claim ? -999 : frame;
  const hit = 26;
  const approach = ease(f, [8, hit], [0, 1], EASE.inOut);
  const settle = ease(f, [hit, hit + 14], [0, 1], EASE.overshoot);
  const toAi = ease(f, [44, 66], [0, 1], EASE.inOut);
  const factArrives = ease(p, [42, 58], [0, 1], EASE.inOut);

  return (
    <div style={{ position: "relative", width: 1700, height: 740 }}>
      <svg width={1700} height={740} style={{ position: "absolute", inset: 0 }}>
        {ROW_Y.map((y, i) => (
          <line key={i} x1={80 + PILL.w} y1={y + PILL.h / 2} x2={DB.x} y2={DB.y + DB.h / 2} stroke={C.carbon} strokeWidth={2.5} strokeDasharray="8 10" opacity={0.35} />
        ))}
        <line x1={DB.x + DB.w} y1={DB.y + DB.h / 2} x2={AI.x} y2={AI.y + AI.h / 2} stroke={C.carbon} strokeWidth={2.5} strokeDasharray="8 10" opacity={0.35} />
      </svg>

      <Box x={DB.x} y={DB.y} w={DB.w} h={DB.h} bg={C.paper}>
        <span>Postgres</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 22, fontWeight: 400, color: C.inkSoft }}>user.factLeaseUntil</span>
        <span style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 20, fontWeight: 700, background: C.lavender, border: `2px solid ${C.carbon}`, borderRadius: 1600, padding: "6px 14px" }}>UPDATE … RETURNING</span>
      </Box>
      <Box x={AI.x} y={AI.y} w={AI.w} h={AI.h} bg={C.sun} rotate={2}>
        <span>OpenAI</span>
        <span style={{ fontSize: 20, fontWeight: 500, opacity: toAi * (1 - factArrives) }}>generating…</span>
      </Box>

      {/* The winner's call travels to OpenAI. */}
      <div
        style={{
          position: "absolute",
          left: DB.x + DB.w + (AI.x - DB.x - DB.w) * toAi - 14,
          top: DB.y + DB.h / 2 - 14,
          width: 28,
          height: 28,
          borderRadius: 99,
          background: C.mint,
          border: `2.5px solid ${C.carbon}`,
          opacity: toAi > 0 && toAi < 1 ? 1 : 0,
        }}
      />

      {REQUESTS.map((name, i) => {
        const winner = i === 0;
        const travel = 400 * approach * (winner ? 1 : 1 - settle);
        const bg = f < hit ? C.paper : winner ? C.mint : C.mist;
        const pollRing = !winner && !claim ? (p % 15) / 15 : 0;
        const polls = !winner && !claim ? Math.min(3, Math.floor(p / 15)) : 0;
        return (
          <div key={name}>
            <Box x={80 + travel} y={ROW_Y[i]} w={PILL.w} h={PILL.h} bg={bg} opacity={ease(f, [0, 8], [0, 1])}>
              <span>{name}</span>
            </Box>
            {!winner && !claim && factArrives < 1 && (
              <div
                style={{
                  position: "absolute",
                  left: 80 + PILL.w / 2 - 60 - 40 * pollRing,
                  top: ROW_Y[i] + PILL.h / 2 - 60 - 40 * pollRing,
                  width: 120 + 80 * pollRing,
                  height: 120 + 80 * pollRing,
                  borderRadius: 999,
                  border: `3px solid ${C.blue}`,
                  opacity: 1 - pollRing,
                }}
              />
            )}
            <div style={{ position: "absolute", left: 80 + travel + PILL.w + 24, top: ROW_Y[i] + 18, opacity: f < hit ? 0 : winner ? 1 - factArrives : 1, scale: String(0.6 + 0.4 * settle) }}>
              {winner ? (
                <Label color="mint" rotate={-3}>won the lease</Label>
              ) : claim || factArrives === 0 ? (
                <Label color={claim ? "paper" : "lavender"} rotate={2}>{claim ? "0 rows" : `poll ${["0.5", "1.0", "1.5", "2.0"][polls]}s`}</Label>
              ) : null}
            </div>
            {!claim && (
              <div style={{ position: "absolute", left: 80 + (winner ? 400 : 0) + PILL.w + 24, top: ROW_Y[i] + 14, opacity: factArrives, scale: String(0.7 + 0.3 * factArrives) }}>
                <Label color="sun" rotate={-2}>same fact ✓</Label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const OPTIONS: { title: string; verdict: string; ok: boolean; color: StickerColor }[] = [
  { title: "In-memory lock", verdict: "Breaks with two servers", ok: false, color: "ember" },
  { title: "Unique constraint", verdict: "Stops the row, not the OpenAI call", ok: false, color: "ember" },
  { title: "Advisory lock", verdict: "Holds a connection for the whole call", ok: false, color: "ember" },
  { title: "The lease", verdict: "Holds nothing during the slow part", ok: true, color: "mint" },
];

// The alternatives board: each option lands on its sentence.
export function Alternatives({ reveal }: { reveal: number[] }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
      <DisplayText lines={["Why not simpler?"]} size={104} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 760px)", gap: 30 }}>
        {OPTIONS.map((option, i) => {
          const at = reveal[i] ?? 9999;
          return (
            <div
              key={option.title}
              style={{
                height: 196,
                borderRadius: 26,
                border: `2.5px solid ${C.carbon}`,
                background: option.ok ? C.lavender : C.paper,
                display: "flex",
                alignItems: "center",
                gap: 30,
                padding: "0 36px",
                opacity: ease(frame, [at, at + 8], [0, 1]),
                translate: ease(frame, [at, at + 16], [40, 0]) + "px 0px",
                rotate: `${ease(frame, [at, at + 16], [i % 2 ? 3 : -3, 0])}deg`,
              }}
            >
              <Sticker icon={option.ok ? "check" : "x"} color={option.color} size={92} rotate={option.ok ? 6 : -6} />
              <div>
                <div style={{ fontFamily: FONT.ui, fontWeight: 700, fontSize: 44, lineHeight: 1.05 }}>{option.title}</div>
                <div style={{ fontFamily: FONT.ui, fontWeight: 500, fontSize: 30, lineHeight: 1.25, color: C.inkSoft, marginTop: 8 }}>{option.verdict}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Lines from a real run of `pnpm vitest run --project backend tests/backend/facts-lease.test.ts`.
const TEST_LINES = [
  ["makes exactly one OpenAI call for five simultaneous requests", "605ms"],
  ["releases the lease after generating", "19ms"],
  ["refuses a second claim while a lease is live", "5ms"],
  ["lets the next request reclaim an expired lease", "5ms"],
  ["keeps a newer lease when a late holder releases with its old token", "6ms"],
  ["generates for a new movie once an in-flight generation for the old one finishes", "985ms"],
];

export function TestOutput({ at }: { at: number }) {
  const frame = useCurrentFrame();
  const summaryAt = at + 8 + TEST_LINES.length * 6;
  return (
    <div style={{ position: "relative", width: 1640 }}>
      <div style={{ borderRadius: 28, border: `2.5px solid ${C.carbon}`, background: C.carbon, padding: "34px 40px", fontFamily: FONT.mono, fontSize: 25, lineHeight: 1.75, color: C.paper }}>
        <div style={{ color: "#9a9a9a" }}>
          <span style={{ color: C.mint }}>$</span> pnpm vitest run --project backend tests/backend/facts-lease.test.ts
        </div>
        <div style={{ color: "#9a9a9a", marginTop: 8 }}>getFact: one generation at a time</div>
        {TEST_LINES.map(([name, time], i) => (
          <div key={name} style={{ opacity: ease(frame, [at + 8 + i * 6, at + 12 + i * 6], [0, 1]), fontWeight: i === 0 ? 700 : 400 }}>
            <span style={{ color: C.mint }}>  ✓ </span>
            {name} <span style={{ color: "#8c8c8c" }}>{time}</span>
          </div>
        ))}
        <div style={{ marginTop: 14, opacity: ease(frame, [summaryAt, summaryAt + 6], [0, 1]) }}>
          <span style={{ color: "#9a9a9a" }}>Tests </span>
          <span style={{ color: C.mint, fontWeight: 700 }}>6 passed</span>
          <span style={{ color: "#9a9a9a" }}> (6)</span>
        </div>
      </div>
      <div style={{ position: "absolute", right: -24, top: -34, opacity: ease(frame, [summaryAt + 4, summaryAt + 10], [0, 1]), scale: String(ease(frame, [summaryAt + 4, summaryAt + 18], [0.5, 1], EASE.overshoot)) }}>
        <Label color="mint" rotate={5} size={36}>1 OpenAI call, not 5</Label>
      </div>
    </div>
  );
}

// The app's New fact button, clicked: the user's click is the retry.
export function RetryButton({ clickAt }: { clickAt: number }) {
  const frame = useCurrentFrame();
  const fetching = frame >= clickAt + 4;
  const points: CursorPoint[] = [
    { t: (clickAt - 20) / 30, type: "move", x: 300, y: 64 },
    { t: clickAt / 30, type: "click", x: 300, y: 64 },
  ];
  const press = 1 - 0.06 * Math.max(0, 1 - Math.abs(frame - clickAt) / 4);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 70 }}>
      <DisplayText lines={["Your click", "is the retry"]} size={120} />
      <div style={{ position: "relative", width: 600, height: 128 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            margin: "auto",
            width: fetching ? 520 : 400,
            height: 112,
            borderRadius: 1600,
            border: `3px solid ${C.carbon}`,
            background: fetching ? C.paper : C.carbon,
            color: fetching ? C.carbon : C.paper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            fontFamily: FONT.ui,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: "0.03em",
            scale: String(press),
          }}
        >
          <div style={{ width: 58, height: 58, borderRadius: 99, background: fetching ? C.mist : C.sun, display: "grid", placeItems: "center", rotate: fetching ? `${(frame - clickAt) * 12}deg` : "0deg" }}>
            <Sticker icon={fetching ? "refresh-cw" : "sparkles"} color={fetching ? "blue" : "sun"} size={44} style={{ border: "none", background: "transparent" }} />
          </div>
          {fetching ? "Getting a fact" : "New fact"}
        </div>
        <Cursor points={points} t={frame / 30} size={44} />
        <Sequence from={clickAt} durationInFrames={20} layout="none">
          <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.45} />
        </Sequence>
      </div>
    </div>
  );
}

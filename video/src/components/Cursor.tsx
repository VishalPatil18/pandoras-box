import { C } from "../theme";

export type CursorPoint = { t: number; type: "move" | "click"; x: number; y: number };

const TRAVEL_SEC = 0.42;
const PRESS_SEC = 0.1;
const RIPPLE_SEC = 0.5;
const ENTER_OFFSET = { x: 180, y: 140 };

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

// Where the pointer is at clip time t: it glides to each logged point along a slight arc.
export function cursorAt(points: CursorPoint[], t: number) {
  const first = points[0];
  if (!first) return null;
  let prev = { x: first.x + ENTER_OFFSET.x, y: first.y + ENTER_OFFSET.y };
  let pos = prev;
  for (const point of points) {
    if (point.t > t) break;
    const p = easeInOut(clamp01((t - point.t) / TRAVEL_SEC));
    const dx = point.x - prev.x;
    const dy = point.y - prev.y;
    const bend = Math.sin(Math.PI * p) * 0.12;
    pos = { x: prev.x + dx * p - dy * bend, y: prev.y + dy * p + dx * bend };
    prev = { x: point.x, y: point.y };
  }
  const opacity = clamp01((t - (first.t - 0.5)) / 0.3);
  return { ...pos, opacity };
}

export function Cursor({ points, t, size = 30 }: { points: CursorPoint[]; t: number; size?: number }) {
  const pos = cursorAt(points, t);
  if (!pos || pos.opacity === 0) return null;
  const clicks = points.filter((p) => p.type === "click" && t >= p.t - PRESS_SEC && t <= p.t + RIPPLE_SEC);
  const press = clicks.reduce((scale, c) => Math.min(scale, 1 - 0.18 * Math.max(0, 1 - Math.abs(t - c.t) / PRESS_SEC)), 1);

  return (
    <>
      {clicks.map((c) => {
        const p = clamp01((t - c.t) / RIPPLE_SEC);
        if (t < c.t) return null;
        const r = 10 + 46 * (1 - Math.pow(1 - p, 3));
        return (
          <div
            key={c.t}
            style={{
              position: "absolute",
              left: c.x - r,
              top: c.y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: 999,
              border: `4px solid ${C.sun}`,
              boxSizing: "border-box",
              outline: `2px solid ${C.carbon}`,
              opacity: 1 - p,
            }}
          />
        );
      })}
      <svg
        width={size}
        height={size * 1.3}
        viewBox="0 0 20 26"
        style={{ position: "absolute", left: pos.x - 2, top: pos.y - 2, opacity: pos.opacity, scale: String(press), transformOrigin: "2px 2px" }}
      >
        <path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill={C.carbon} stroke={C.paper} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </>
  );
}

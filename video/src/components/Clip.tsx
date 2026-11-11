import { Audio, Video } from "@remotion/media";
import {
  Freeze,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import captures from "../../public/captures/captures.json";
import { CLAMP, EASE, FPS, type StickerColor } from "../theme";
import { BrowserFrame } from "./BrowserFrame";
import { Cursor, type CursorPoint } from "./Cursor";
import { useShot } from "./Shot";
import { Label } from "./Sticker";

export type CaptureName = keyof typeof captures;
// A clip time: seconds, a capture mark, or a mark plus an offset in seconds.
export type ClipTime = number | string | [string, number];
// Zooms and labels are timed in shot frames, so they follow the narration rather than the recording.
export type Zoom = {
  from: number;
  to: number;
  scale: number;
  x: number;
  y: number;
};
export type ClipLabel = {
  from: number;
  to?: number;
  text: string;
  color?: StickerColor;
  top?: boolean;
};

const MAX_RATE = 2.2;
const ZOOM_EASE_FRAMES = 22;

type Capture = {
  durationSec: number;
  width: number;
  height: number;
  marks: Record<string, number>;
  events: CursorPoint[];
};

export function captureOf(name: CaptureName): Capture {
  return captures[name] as Capture;
}

export function resolveTime(capture: Capture, time: ClipTime): number {
  if (typeof time === "number") return time;
  const [mark, offset] = typeof time === "string" ? [time, 0] : time;
  const at = capture.marks[mark];
  if (at === undefined) throw new Error(`Unknown mark ${mark}`);
  return at + offset;
}

const smooth = (p: number) => {
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
};

// Plays a span of a recording inside a browser frame, fitted to the shot, with the logged cursor on top.
export function Clip({
  name,
  from = 0,
  to,
  width,
  url,
  zooms = [],
  labels = [],
  extraClicks = [],
  delay = 0,
  length,
}: {
  name: CaptureName;
  from?: ClipTime;
  to?: ClipTime;
  width: number;
  url: string | [ClipTime, string][];
  zooms?: Zoom[];
  labels?: ClipLabel[];
  extraClicks?: { at: ClipTime; x: number; y: number }[];
  delay?: number;
  length?: number;
}) {
  const shotFrame = useCurrentFrame();
  const frame = shotFrame - delay;
  const shot = useShot();
  const capture = captureOf(name);
  const start = resolveTime(capture, from);
  const end = Math.min(
    capture.durationSec,
    to === undefined ? capture.durationSec : resolveTime(capture, to),
  );
  const available = ((length ?? shot.length) - delay) / FPS;
  const rate = Math.min(MAX_RATE, Math.max(1, (end - start) / available));
  const playFrames = Math.floor(((end - start) / rate) * FPS);
  const t = start + (Math.min(Math.max(frame, 0), playFrames) / FPS) * rate;

  const k = width / capture.width;
  const height = capture.height * k;
  const points: CursorPoint[] = [
    ...capture.events,
    ...extraClicks.map((c) => ({
      t: resolveTime(capture, c.at),
      type: "click" as const,
      x: c.x,
      y: c.y,
    })),
  ].sort((a, b) => a.t - b.t);

  // Camera: blend toward each zoom's focus point, clamped so the frame never shows an edge.
  let scale = 1;
  let fx = capture.width / 2;
  let fy = capture.height / 2;
  for (const z of zooms) {
    const w =
      smooth((shotFrame - z.from) / ZOOM_EASE_FRAMES) *
      (1 - smooth((shotFrame - z.to) / ZOOM_EASE_FRAMES));
    scale += (z.scale - 1) * w;
    fx += (z.x - fx) * w;
    fy += (z.y - fy) * w;
  }
  const tx = Math.min(
    0,
    Math.max(
      capture.width - capture.width * scale,
      capture.width / 2 - fx * scale,
    ),
  );
  const ty = Math.min(
    0,
    Math.max(
      capture.height - capture.height * scale,
      capture.height / 2 - fy * scale,
    ),
  );

  const label =
    typeof url === "string"
      ? url
      : ([...url]
          .reverse()
          .find(([at]) => t >= resolveTime(capture, at))?.[1] ?? url[0][1]);
  const clicks = points.filter(
    (p) => p.type === "click" && p.t >= start && p.t <= end,
  );
  const video = (
    <Video
      src={staticFile(`captures/${name}.mp4`)}
      trimBefore={Math.round(start * FPS)}
      playbackRate={rate}
      muted
      style={{ width: capture.width, height: capture.height, display: "block" }}
    />
  );

  const activeLabel = [...labels]
    .reverse()
    .find((l) => shotFrame >= l.from && shotFrame < (l.to ?? Infinity));

  return (
    <div style={{ position: "relative" }}>
      <BrowserFrame width={width} height={height} url={label}>
        <div
          style={{
            width: capture.width,
            height: capture.height,
            scale: String(k),
            transformOrigin: "0 0",
          }}
        >
          <div
            style={{
              width: capture.width,
              height: capture.height,
              transformOrigin: "0 0",
              translate: `${tx}px ${ty}px`,
              scale: String(scale),
            }}
          >
            {frame < 0 ? (
              // Hold the first frame until playback starts.
              <Freeze frame={0} active>
                {video}
              </Freeze>
            ) : (
              <Sequence from={delay} layout="none">
                <Freeze frame={playFrames - 1} active={frame >= playFrames}>
                  {video}
                </Freeze>
              </Sequence>
            )}
            <Cursor points={points} t={t} />
          </div>
        </div>
        {clicks.map((c) => (
          <Sequence
            key={c.t}
            from={delay + Math.round(((c.t - start) / rate) * FPS)}
            durationInFrames={20}
            layout="none"
          >
            <Audio src={staticFile("sfx/mouse-click.wav")} volume={0.45} />
          </Sequence>
        ))}
      </BrowserFrame>
      {activeLabel && (
        <div
          style={{
            position: "absolute",
            right: -34,
            // Bottom edge by default: the top of a page holds the nav and profile.
            ...(activeLabel.top ? { top: 18 } : { bottom: 24 }),
            opacity: interpolate(
              shotFrame,
              [activeLabel.from, activeLabel.from + 6],
              [0, 1],
              CLAMP,
            ),
            scale: interpolate(
              shotFrame,
              [activeLabel.from, activeLabel.from + 14],
              [0.5, 1],
              { ...CLAMP, easing: EASE.overshoot },
            ),
          }}
        >
          <Label color={activeLabel.color ?? "sun"} rotate={4} size={32}>
            {activeLabel.text}
          </Label>
        </div>
      )}
    </div>
  );
}

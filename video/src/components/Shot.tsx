import { createContext, useContext, type ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import type { Span } from "../timeline";
import { CLAMP, EASE, STAGE } from "../theme";

const CROSSFADE = 12;

// Line spans relative to the current section; scenes read them to time their beats.
export const BeatsContext = createContext<Record<string, Span>>({});
const ShotContext = createContext<{ start: number; length: number }>({ start: 0, length: 0 });

export function useShot() {
  return useContext(ShotContext);
}

// A line's span relative to the enclosing shot, so beats inside a shot can key off narration.
export function useBeat(id: string): Span {
  const beats = useContext(BeatsContext);
  const { start } = useContext(ShotContext);
  const span = beats[id];
  if (!span) throw new Error(`Unknown line ${id}`);
  return { from: span.from - start, to: span.to - start };
}

// One visual covering a run of narration lines, cross-fading with its neighbours.
export function Shot({
  name,
  from,
  to,
  children,
  lead = CROSSFADE / 2,
  tail = 0,
  fadeOut = true,
}: {
  name: string;
  from: string;
  to: string;
  children: ReactNode;
  lead?: number;
  tail?: number;
  fadeOut?: boolean;
}) {
  const beats = useContext(BeatsContext);
  const first = beats[from];
  const last = beats[to];
  if (!first || !last) throw new Error(`Shot ${name}: unknown line`);
  const start = Math.max(0, first.from - lead);
  const length = last.to + 8 + CROSSFADE + tail - start;
  return (
    <Sequence name={name} from={start} durationInFrames={length}>
      <ShotContext.Provider value={{ start, length }}>
        <ShotBody length={length} fadeOut={fadeOut}>
          {children}
        </ShotBody>
      </ShotContext.Provider>
    </Sequence>
  );
}

function ShotBody({ length, fadeOut, children }: { length: number; fadeOut: boolean; children: ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        top: STAGE.top,
        height: STAGE.bottom - STAGE.top,
        alignItems: "center",
        justifyContent: "center",
        opacity: interpolate(frame, [0, CROSSFADE, length - CROSSFADE, length], [0, 1, 1, fadeOut ? 0 : 1], CLAMP),
        translate: interpolate(frame, [0, 16], ["0px 28px", "0px 0px"], { ...CLAMP, easing: EASE.out }),
        scale: interpolate(frame, [length - CROSSFADE, length], [1, fadeOut ? 1.015 : 1], CLAMP),
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

// Pops a child in at a frame with a small overshoot.
export function PopIn({ at, children, rotate = 0, style }: { at: number; children: ReactNode; rotate?: number; style?: React.CSSProperties }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [at, at + 6], [0, 1], CLAMP),
        scale: interpolate(frame, [at, at + 14], [0.6, 1], { ...CLAMP, easing: EASE.overshoot }),
        rotate: interpolate(frame, [at, at + 14], [`${rotate - 10}deg`, `${rotate}deg`], { ...CLAMP, easing: EASE.out }),
      }}
    >
      {children}
    </div>
  );
}

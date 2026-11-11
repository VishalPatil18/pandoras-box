import { SECTIONS, type Section } from "./script";
import { FPS } from "./theme";
import voice from "./voice.json";

const LEAD_IN = 24;
const LINE_GAP = 8;
const SECTION_GAP = 42;
const SECTION_PAD = 14;
export const OUTRO_HOLD = 6 * FPS;

export type Span = { from: number; to: number };
export type TimedLine = Span & { id: string; text: string; sectionId: string };
export type TimedSection = Span & { section: Section; lines: Record<string, Span> };

const durations = voice as Record<string, { durationSec: number; hash: string | null }>;
// Estimated timings carry no hash, which means no audio files exist yet.
export const HAS_VOICE = Object.values(durations).every((entry) => entry.hash !== null);

function build() {
  const lines: TimedLine[] = [];
  const sections: TimedSection[] = [];
  let t = LEAD_IN;
  SECTIONS.forEach((section, index) => {
    if (index > 0) t += SECTION_GAP;
    const start = index === 0 ? 0 : t - SECTION_PAD;
    const local: Record<string, Span> = {};
    for (const line of section.lines) {
      const length = Math.ceil((durations[line.id]?.durationSec ?? 2) * FPS);
      lines.push({ id: line.id, text: line.text, sectionId: section.id, from: t, to: t + length });
      local[line.id] = { from: t - start, to: t + length - start };
      t += length + LINE_GAP;
    }
    sections.push({ section, from: start, to: t, lines: local });
  });
  // Each section runs until the next one starts, so cuts land under the chapter card.
  sections.forEach((entry, i) => {
    entry.to = sections[i + 1]?.from ?? t + OUTRO_HOLD;
  });
  return { lines, sections, total: t + OUTRO_HOLD };
}

export const TIMELINE = build();

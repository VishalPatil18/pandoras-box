import { Audio } from "@remotion/media";
import type { ComponentType } from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { BackgroundMusic } from "./components/BackgroundMusic";
import { Captions } from "./components/Captions";
import { Background, ChapterCards, Marquee, TopBar } from "./components/Chrome";
import { BeatsContext } from "./components/Shot";
import { AppScene } from "./scenes/AppScene";
import { BrowserScene } from "./scenes/BrowserScene";
import { FailureScene } from "./scenes/FailureScene";
import { LeaseScene } from "./scenes/LeaseScene";
import { OutroScene, TradeoffsScene } from "./scenes/OutroScenes";
import { SchemaScene } from "./scenes/SchemaScene";
import { HAS_VOICE, TIMELINE } from "./timeline";

const SCENES: Record<string, ComponentType> = {
  app: AppScene,
  schema: SchemaScene,
  lease: LeaseScene,
  failure: FailureScene,
  browser: BrowserScene,
  tradeoffs: TradeoffsScene,
  outro: OutroScene,
};

export function Walkthrough() {
  return (
    <AbsoluteFill>
      <Background />
      {TIMELINE.sections.map(({ section, from, to, lines }) => {
        const Scene = SCENES[section.id];
        return (
          <Sequence key={section.id} name={section.title} from={from} durationInFrames={to - from}>
            <BeatsContext.Provider value={lines}>
              <Scene />
            </BeatsContext.Provider>
          </Sequence>
        );
      })}
      <Marquee />
      <TopBar />
      <Captions />
      <ChapterCards />
      <BackgroundMusic />      {HAS_VOICE &&
        TIMELINE.lines.map((line) => (
          <Sequence key={line.id} name={`Voice ${line.id}`} from={line.from} durationInFrames={line.to - line.from + 15} layout="none">
            <Audio src={staticFile(`voice/${line.id}.mp3`)} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
}

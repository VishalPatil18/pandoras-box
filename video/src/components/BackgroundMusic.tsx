import { Audio } from "@remotion/media";
import { interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { CLAMP, FPS } from "../theme";

const VOLUME = 0.25;
// The file runs 114.5s and ends in 1.5s of silence; loop only the music.
const TRACK_SEC = 113;
const CROSSFADE_SEC = 3;
const FADE_IN_SEC = 1.5;
const FADE_OUT_SEC = 4;

// Loops the piano under the whole video, crossfading each pass into the next so there's no hard restart.
export function BackgroundMusic() {
  const { durationInFrames } = useVideoConfig();
  const track = TRACK_SEC * FPS;
  const fade = CROSSFADE_SEC * FPS;
  const step = track - fade;
  const passes = Math.ceil((durationInFrames - fade) / step);

  return (
    <>
      {Array.from({ length: passes }, (_, i) => {
        const from = i * step;
        const length = Math.min(track, durationInFrames - from);
        return (
          <Sequence key={i} name={`Music pass ${i + 1}`} from={from} durationInFrames={length} layout="none">
            <Audio
              src={staticFile("music/bg-music.mp3")}
              volume={(f) => {
                const passIn = i === 0 ? interpolate(f, [0, FADE_IN_SEC * FPS], [0, 1], CLAMP) : interpolate(f, [0, fade], [0, 1], CLAMP);
                const passOut = interpolate(f, [track - fade, track], [1, 0], CLAMP);
                const videoOut = interpolate(from + f, [durationInFrames - FADE_OUT_SEC * FPS, durationInFrames], [1, 0], CLAMP);
                return VOLUME * passIn * passOut * videoOut;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
}

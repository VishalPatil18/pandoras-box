# Walkthrough video

The walkthrough for Pandoras Box, built with Remotion. The narration follows `dev-docs/video-script.md`, the colors and type come from `design/DESIGN.md`, and every app shot is a real recording of the app.

## Make the video

```console
npm install
cp .env.example .env     # add FISH_API_KEY and FISH_MODEL_ID
npm run voice            # one Fish Audio clip per sentence
npm run dev              # preview in Remotion Studio
npm run render           # writes out/walkthrough.mp4
```

The timeline sizes itself from the narration. Each sentence's clip length sets when its shot starts and ends, and the captions are timed from the same numbers. Until `npm run voice` has run, the timings in `src/voice.json` are estimates from word counts and the video has no sound.

## Background music

The piano bed is gitignored, because music licenses usually don't allow redistributing the raw file. Put it at `public/music/bg-music.mp3` before rendering. `src/components/BackgroundMusic.tsx` plays it at 25% volume and loops it with a 3 second crossfade. If you swap the track, set `TRACK_SEC` to where its music ends.

## What each script does

| Script | Output | When to rerun |
|---|---|---|
| `npm run voice` | `public/voice/*.mp3`, `src/voice.json` | After editing a sentence in `src/script.ts`. Only changed sentences call the API. |
| `npm run code` | `src/code.json` | After editing any file shown on screen. It reads the real files by line range. |
| `npm run capture` | `public/captures/*` | After changing the app's UI. |

`npm run capture` drives the production build against the local database. Before running it:

1. Start Postgres with `pnpm db:up` and build the app with `pnpm build` in the repo root.
2. Sign in once locally with Google, so your user row exists.

The script mints a session for that user, records each flow, then puts your favorite movie back and deletes the session. It makes four real OpenAI calls and waits out the 60 second window twice, so a run takes about five minutes. The failure shots restart the app with a deliberately invalid OpenAI key.

## Where things live

- `src/script.ts` holds the narration, one entry per sentence. `say` overrides what the voice reads when it differs from the caption.
- `src/scenes/` has one file per chapter. Each shot names the sentences it covers.
- `src/components/Clip.tsx` plays a recording inside a browser frame, fits it to its shot, and draws the cursor from the clicks logged during capture.

// Generates one narration clip per sentence with Fish Audio, then records each clip's real length.
// Usage: npm run voice            (needs FISH_API_KEY and FISH_MODEL_ID in video/.env)
//        node scripts/voice.ts --estimate   (placeholder timings from word counts, no API calls)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SECTIONS } from "../src/script.ts";

const VOICE_DIR = resolve(import.meta.dirname, "../public/voice");
const MANIFEST = resolve(import.meta.dirname, "../src/voice.json");
const FISH_URL = "https://api.fish.audio/v1/tts";
const WORDS_PER_SECOND = 2.6;

type Entry = { durationSec: number; hash: string | null };
type Manifest = Record<string, Entry>;

const lines = SECTIONS.flatMap((section) => section.lines);
const spoken = (line: (typeof lines)[number]) => line.say ?? line.text;
const hashOf = (text: string, voice: string) => createHash("sha1").update(`${voice}\n${text}`).digest("hex");

function readManifest(): Manifest {
  return existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest) : {};
}

function writeManifest(manifest: Manifest): void {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

function estimate(): void {
  const manifest = Object.fromEntries(
    lines.map((line) => [line.id, { durationSec: spoken(line).split(/\s+/).length / WORDS_PER_SECOND + 0.3, hash: null }]),
  );
  writeManifest(manifest);
  console.log(`Wrote estimated timings for ${lines.length} lines.`);
}

function probeSeconds(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return Number(out.trim());
}

async function synthesize(text: string, apiKey: string, voiceId: string, model: string): Promise<Buffer> {
  const response = await fetch(FISH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", model },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: "mp3",
      mp3_bitrate: 192,
      latency: "normal",
      normalize: true,
      prosody: { speed: 1, normalize_loudness: true },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    const hint = response.status === 402 ? " Your plan may need FISH_TTS_MODEL=s2.1-pro-free." : "";
    throw new Error(`Fish Audio returned ${response.status}: ${detail}${hint}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function generate(): Promise<void> {
  const apiKey = process.env.FISH_API_KEY;
  const voiceId = process.env.FISH_MODEL_ID;
  const model = process.env.FISH_TTS_MODEL || "s2.1-pro";
  if (!apiKey || !voiceId) throw new Error("Set FISH_API_KEY and FISH_MODEL_ID in video/.env (see .env.example).");

  mkdirSync(VOICE_DIR, { recursive: true });
  const manifest = readManifest();
  for (const line of lines) {
    const file = join(VOICE_DIR, `${line.id}.mp3`);
    const hash = hashOf(spoken(line), `${voiceId}:${model}`);
    // Unchanged sentences keep their clip, so editing one line costs one API call.
    if (manifest[line.id]?.hash === hash && existsSync(file)) continue;
    process.stdout.write(`  ${line.id} `);
    writeFileSync(file, await synthesize(spoken(line), apiKey, voiceId, model));
    manifest[line.id] = { durationSec: probeSeconds(file), hash };
    writeManifest(manifest);
    console.log(`${manifest[line.id].durationSec.toFixed(2)}s`);
  }
  const total = lines.reduce((sum, line) => sum + manifest[line.id].durationSec, 0);
  console.log(`Narration ready: ${lines.length} clips, ${total.toFixed(1)}s of speech.`);
}

if (process.argv.includes("--estimate")) estimate();
else await generate();

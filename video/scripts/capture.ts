// Records the real app with Chrome's screencast and logs every click, so Remotion can draw the cursor.
// Needs: local Postgres up, `pnpm build` done in the repo root, your user row in the local database.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(import.meta.dirname, "../public/captures");
const TMP = resolve(import.meta.dirname, "../.capture-tmp");
const BASE = "http://localhost:3000";
const FPS = 30;
const SCALE = 1.8;
const MAIN_VIEWPORT = { width: 1600, height: 900 };
const TAB_VIEWPORT = { width: 1000, height: 860 };
const CACHE_WINDOW_MS = 62_000;
const ONBOARDING_MOVIE = "Amélie";
const EDITED_MOVIE = "Interstellar";
const NO_FACT_MOVIE = "Paprika";
const LONG_TITLE =
  "The Lord of the Rings: The Fellowship of the Ring, Special Extended Edition, Remastered in Ultra HD 4K";

process.loadEnvFile(join(ROOT, ".env"));
const DATABASE_URL = requiredEnv("DATABASE_URL");
const AUTH_SECRET = requiredEnv("BETTER_AUTH_SECRET");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in the repo .env`);
  return value;
}

function sql(query: string): string {
  return execFileSync("psql", [DATABASE_URL, "-At", "-F", "\t", "-c", query], { encoding: "utf8" }).trim();
}

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

// ---------- app server ----------

let server: ChildProcess | null = null;

async function startServer(env: Record<string, string> = {}): Promise<void> {
  server = spawn("pnpm", ["start"], { cwd: ROOT, env: { ...process.env, ...env }, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(500);
  }
  throw new Error("The app did not start on port 3000");
}

async function stopServer(): Promise<void> {
  if (!server) return;
  server.kill("SIGTERM");
  server = null;
  // next start forks a child; free the port before the next start.
  try {
    execFileSync("sh", ["-c", "lsof -ti tcp:3000 | xargs kill -9"], { stdio: "ignore" });
  } catch {
    // Nothing left on the port.
  }
  await sleep(1000);
}

// ---------- session ----------

type Session = { id: string; cookie: string };

// Mirrors Better Auth's signed cookie: token, a dot, then base64 HMAC-SHA256 of the token.
function mintSession(userId: string): Session {
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  sql(`insert into session (id, "expiresAt", token, "updatedAt", "userId")
       values (${quote(id)}, now() + interval '1 day', ${quote(token)}, now(), ${quote(userId)})`);
  const signature = createHmac("sha256", AUTH_SECRET).update(token).digest("base64");
  return { id, cookie: encodeURIComponent(`${token}.${signature}`) };
}

async function signedInContext(browser: Browser, session: Session, viewport = MAIN_VIEWPORT) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: SCALE });
  await context.addCookies([
    { name: "better-auth.session_token", value: session.cookie, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  return context;
}

// ---------- recorder ----------

type CursorEvent = { t: number; type: "move" | "click"; x: number; y: number };
type Recording = { name: string; durationSec: number; width: number; height: number; marks: Record<string, number>; events: CursorEvent[] };

type Recorder = {
  mark: (name: string) => void;
  move: (target: Locator) => Promise<void>;
  click: (target: Locator) => Promise<void>;
};

const now = () => Date.now() / 1000;

async function record(page: Page, name: string, script: (rec: Recorder) => Promise<void>): Promise<Recording> {
  const viewport = page.viewportSize() ?? MAIN_VIEWPORT;
  const cdp = await page.context().newCDPSession(page);
  const frames: { data: string; t: number }[] = [];
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp ?? now() });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: Math.round(viewport.width * SCALE),
    maxHeight: Math.round(viewport.height * SCALE),
  });
  const t0 = now();
  const marks: Record<string, number> = {};
  const events: CursorEvent[] = [];

  async function centerOf(target: Locator) {
    const box = await target.boundingBox();
    if (!box) throw new Error(`${name}: target has no box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  const rec: Recorder = {
    mark: (label) => {
      marks[label] = now() - t0;
    },
    move: async (target) => {
      const { x, y } = await centerOf(target);
      events.push({ t: now() - t0, type: "move", x, y });
      await page.mouse.move(x, y, { steps: 12 });
    },
    click: async (target) => {
      const { x, y } = await centerOf(target);
      events.push({ t: now() - t0, type: "move", x, y });
      await page.mouse.move(x, y, { steps: 12 });
      await sleep(350);
      events.push({ t: now() - t0, type: "click", x, y });
      await target.click();
    },
  };

  await script(rec);
  await sleep(300);
  await cdp.send("Page.stopScreencast");
  const end = now();
  await cdp.detach();
  if (frames.length === 0) throw new Error(`${name}: no frames captured`);

  // Variable frame timing from Chrome becomes a constant 30fps mp4 through ffmpeg's concat demuxer.
  const dir = join(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines: string[] = [];
  frames.forEach((frame, i) => {
    const file = join(dir, `${String(i).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(frame.data, "base64"));
    const start = i === 0 ? t0 : frame.t;
    const next = frames[i + 1]?.t ?? end;
    lines.push(`file '${file}'`, `duration ${Math.max(0.001, next - start).toFixed(4)}`);
  });
  lines.push(`file '${join(dir, `${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
  writeFileSync(join(dir, "list.txt"), lines.join("\n"));
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"),
    "-vf", `fps=${FPS},scale=trunc(iw/2)*2:trunc(ih/2)*2`, "-c:v", "libx264", "-crf", "14",
    "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, `${name}.mp4`),
  ]);

  const recording = { name, durationSec: end - t0, width: viewport.width, height: viewport.height, marks, events };
  console.log(`  ${name}: ${frames.length} frames over ${recording.durationSec.toFixed(1)}s`);
  return recording;
}

// ---------- flows ----------

const ticketDone = (page: Page) =>
  page.getByText("AI-generated, may be inaccurate").waitFor({ state: "visible", timeout: 20_000 });

async function factText(page: Page): Promise<string> {
  return (await page.locator('section[aria-label="Your movie fact"] article').innerText()).trim();
}

function latestFacts(): string[][] {
  return sql(`select "movieTitle", left("text", 40), to_char("createdAt" at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS')
              from fact order by "createdAt" desc limit 5`)
    .split("\n")
    .filter(Boolean)
    .map((row) => row.split("\t"));
}

async function landing(browser: Browser): Promise<Recording> {
  const context = await browser.newContext({ viewport: MAIN_VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  await page.goto("about:blank");
  const recording = await record(page, "landing", async (rec) => {
    await page.goto(BASE);
    rec.mark("loaded");
    await sleep(3200);
    // Google's own consent page can't be filmed headless; the video cuts to onboarding here.
    await rec.move(page.getByRole("button", { name: "Sign in" }).first());
    rec.mark("hover");
    await sleep(1200);
  });
  await context.close();
  return recording;
}

async function onboarding(page: Page): Promise<Recording> {
  await page.goto("about:blank");
  return record(page, "onboarding", async (rec) => {
    await page.goto(`${BASE}/onboarding`);
    await page.getByRole("heading", { name: "What's your favorite movie?" }).waitFor();
    rec.mark("loaded");
    await sleep(900);
    const field = page.getByLabel("Favorite movie");
    const save = page.getByRole("button", { name: "Save and continue" });
    await rec.click(save);
    await page.getByText("Enter a movie title.").waitFor();
    rec.mark("empty-error");
    await sleep(1600);
    await rec.click(field);
    rec.mark("long-typing");
    await field.pressSequentially(LONG_TITLE, { delay: 14 });
    await sleep(300);
    await rec.click(save);
    await page.getByText("Keep the title under 100 characters.").waitFor();
    rec.mark("long-error");
    await sleep(1800);
    await field.fill("");
    rec.mark("real-typing");
    await field.pressSequentially(ONBOARDING_MOVIE, { delay: 90 });
    await sleep(400);
    await rec.click(save);
    rec.mark("saved");
    await page.waitForURL("**/dashboard**");
    rec.mark("dashboard");
    await ticketDone(page);
    rec.mark("printed");
    await sleep(2600);
    rec.mark("settled");
  });
}

async function countdownAndEdit(page: Page): Promise<Recording> {
  return record(page, "edit", async (rec) => {
    rec.mark("start");
    await sleep(800);
    await rec.move(page.getByRole("button", { name: /New fact in/ }));
    rec.mark("countdown");
    await sleep(3500);
    await rec.click(page.getByRole("button", { name: "Edit" }));
    rec.mark("editing");
    await sleep(500);
    await page.getByLabel("Favorite movie").pressSequentially(EDITED_MOVIE, { delay: 85 });
    await sleep(350);
    await rec.click(page.getByRole("button", { name: "Save" }));
    rec.mark("saved");
    await page.getByRole("heading", { level: 1, name: EDITED_MOVIE }).waitFor();
    await page.locator('section[aria-label="Your movie fact"] article', { hasText: EDITED_MOVIE }).waitFor({ timeout: 20_000 });
    await ticketDone(page);
    rec.mark("printed");
    await sleep(2400);
  });
}

async function twoTabs(browser: Browser, session: Session, factAt: number) {
  const context = await signedInContext(browser, session, TAB_VIEWPORT);
  const [left, right] = [await context.newPage(), await context.newPage()];
  // Opened while the fact is still fresh, so this load is a cache hit and creates nothing.
  await Promise.all([left.goto(`${BASE}/dashboard`), right.goto(`${BASE}/dashboard`)]);
  await Promise.all([ticketDone(left), ticketDone(right)]);
  const wait = factAt + CACHE_WINDOW_MS - Date.now();
  console.log(`  waiting ${Math.ceil(wait / 1000)}s for the 60 second window to pass`);
  if (wait > 0) await sleep(wait);
  const before = latestFacts();

  const reloadBoth = async () => {
    await sleep(900);
    await Promise.all([left.reload(), right.reload()]);
  };
  // Both screencasts run at once; each recorder marks its own reload.
  const [leftRec, rightRec] = await Promise.all([
    record(left, "tab-left", async (rec) => {
      await reloadBoth();
      rec.mark("reload");
      await ticketDone(left);
      rec.mark("printed");
      await sleep(2400);
    }),
    record(right, "tab-right", async (rec) => {
      await sleep(900);
      rec.mark("reload");
      await ticketDone(right);
      rec.mark("printed");
      await sleep(2400);
    }),
  ]);
  const [leftText, rightText] = [await factText(left), await factText(right)];
  const after = latestFacts();
  console.log(`  same fact in both tabs: ${leftText === rightText}`);
  await context.close();
  return { recordings: [leftRec, rightRec], sql: { before, after, sameFact: leftText === rightText } };
}

async function failures(browser: Browser, session: Session, factAt: number): Promise<Recording[]> {
  await stopServer();
  // A bad key makes the real OpenAI call fail, which is what the fallback path handles.
  await startServer({ OPENAI_API_KEY: "sk-invalid-for-demo" });
  const wait = factAt + CACHE_WINDOW_MS - Date.now();
  console.log(`  waiting ${Math.ceil(Math.max(0, wait) / 1000)}s so the next load tries OpenAI`);
  if (wait > 0) await sleep(wait);

  const context = await signedInContext(browser, session);
  const page = await context.newPage();
  await page.goto("about:blank");
  const fallback = await record(page, "fallback", async (rec) => {
    await page.goto(`${BASE}/dashboard`);
    rec.mark("loaded");
    await page.locator("article").getByText("Couldn't get a fresh fact").waitFor({ timeout: 25_000 });
    rec.mark("notice");
    await sleep(3500);
  });
  const noFact = await record(page, "no-fact", async (rec) => {
    await rec.click(page.getByRole("button", { name: "Edit" }));
    await sleep(400);
    await page.getByLabel("Favorite movie").pressSequentially(NO_FACT_MOVIE, { delay: 85 });
    await rec.click(page.getByRole("button", { name: "Save" }));
    rec.mark("saved");
    const retry = page.getByRole("button", { name: "Try again" });
    await retry.waitFor({ timeout: 25_000 });
    rec.mark("error");
    await sleep(800);
    await rec.move(retry);
    await sleep(2200);
  });
  await context.close();
  return [fallback, noFact];
}

async function readme(browser: Browser): Promise<Recording> {
  // GitHub renders the real README with its own markdown engine; GitHub's stylesheet styles it.
  const html = execFileSync("gh", ["api", "markdown", "-f", `text=${readFileSync(join(ROOT, "README.md"), "utf8")}`, "-f", "mode=gfm"], { encoding: "utf8", maxBuffer: 20e6 });
  const file = join(TMP, "readme.html");
  writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8"><base href="file://${ROOT}/">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css">
<style>body{margin:0;background:#fff}.markdown-body{box-sizing:border-box;max-width:980px;margin:0 auto;padding:48px 45px}</style>
</head><body><article class="markdown-body">${html}</article></body></html>`);

  const context = await browser.newContext({ viewport: MAIN_VIEWPORT, deviceScaleFactor: SCALE });
  const page = await context.newPage();
  await page.goto(`file://${file}`);
  await page.waitForLoadState("networkidle");
  const scrollTo = (text: string) =>
    page.evaluate(async (heading) => {
      const target = [...document.querySelectorAll("h2")].find((h) => h.textContent?.trim() === heading);
      if (!target) throw new Error(`No heading ${heading}`);
      const from = window.scrollY;
      const to = target.getBoundingClientRect().top + from - 40;
      const start = performance.now();
      await new Promise<void>((done) => {
        const step = (time: number) => {
          const p = Math.min(1, (time - start) / 1400);
          const eased = 1 - Math.pow(1 - p, 4);
          window.scrollTo(0, from + (to - from) * eased);
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    }, text);

  const recording = await record(page, "readme", async (rec) => {
    await sleep(600);
    await scrollTo("Tradeoffs");
    rec.mark("tradeoffs");
    await sleep(800);
    await page.evaluate(() => window.scrollBy({ top: 360, behavior: "smooth" }));
    await sleep(5200);
    await scrollTo("With 2 more hours");
    rec.mark("more-hours");
    await sleep(6000);
  });
  await context.close();
  return recording;
}

// ---------- main ----------

async function main() {
  mkdirSync(OUT, { recursive: true });
  const [userId, originalMovie] = sql(`select id, coalesce("favoriteMovie", '') from "user" order by "createdAt" limit 1`).split("\t");
  if (!userId) throw new Error("No user in the local database. Sign in once with Google locally first.");

  await stopServer();
  await startServer();
  const browser = await chromium.launch({ channel: "chrome" });
  const session = mintSession(userId);
  const recordings: Recording[] = [];
  try {
    console.log("Landing");
    recordings.push(await landing(browser));

    console.log("Onboarding and first fact");
    sql(`update "user" set "favoriteMovie" = null, "factLeaseUntil" = null, "factLeaseToken" = null where id = ${quote(userId)}`);
    const context = await signedInContext(browser, session);
    const page = await context.newPage();
    recordings.push(await onboarding(page));

    console.log("Countdown and inline edit");
    recordings.push(await countdownAndEdit(page));
    const editedAt = Date.now();
    await context.close();

    console.log("Two tabs");
    const tabs = await twoTabs(browser, session, editedAt);
    recordings.push(...tabs.recordings);
    writeFileSync(join(OUT, "sql.json"), JSON.stringify(tabs.sql, null, 2));

    console.log("Failure paths");
    recordings.push(...(await failures(browser, session, Date.now())));

    console.log("README");
    recordings.push(await readme(browser));

    writeFileSync(join(OUT, "captures.json"), JSON.stringify(Object.fromEntries(recordings.map((r) => [r.name, r])), null, 2));
    console.log(`Done. Wrote ${recordings.length} recordings to public/captures.`);
  } finally {
    await browser.close();
    sql(`update "user" set "favoriteMovie" = ${originalMovie ? quote(originalMovie) : "null"} where id = ${quote(userId)}`);
    sql(`delete from session where id = ${quote(session.id)}`);
    await stopServer();
    rmSync(TMP, { recursive: true, force: true });
  }
}

await main();

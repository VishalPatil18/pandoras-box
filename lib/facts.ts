import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import type { FactResponse, FactSource } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { movieKey } from "@/lib/movie";
import { FactGenerationError, generateFact } from "@/lib/openai";

export const CACHE_WINDOW_SECONDS = 60;
// Longer than the 8 second OpenAI timeout, so a live holder never loses its lease.
export const LEASE_SECONDS = 15;
export const POLL_INTERVAL_MS = 500;
// Covers the holder's OpenAI call plus the insert before a waiter gives up.
export const POLL_TIMEOUT_MS = 9_000;
// Twice what one movie refreshed every minute needs, so only movie switching loops hit it.
export const GENERATION_LIMIT = 20;
export const GENERATION_WINDOW_SECONDS = 600;

type StoredFact = { movieTitle: string; text: string; createdAt: Date };
type FreshFact = StoredFact & { secondsUntilRefresh: number };

function toResponse(
  fact: StoredFact,
  source: FactSource,
  secondsUntilRefresh: number,
): FactResponse {
  return {
    fact: {
      text: fact.text,
      movieTitle: fact.movieTitle,
      generatedAt: fact.createdAt.toISOString(),
    },
    source,
    secondsUntilRefresh,
  };
}

// Age is measured with the database clock so every app server agrees on the window.
async function findFreshFact(userId: string, key: string): Promise<FreshFact | null> {
  const rows = await prisma.$queryRaw<FreshFact[]>`
    SELECT "movieTitle", "text", "createdAt",
           GREATEST(0, CEIL(${CACHE_WINDOW_SECONDS} - EXTRACT(EPOCH FROM now() - "createdAt")))::int
             AS "secondsUntilRefresh"
    FROM "fact"
    WHERE "userId" = ${userId}
      AND "movieKey" = ${key}
      AND "createdAt" > now() - make_interval(secs => ${CACHE_WINDOW_SECONDS})
    ORDER BY "createdAt" DESC
    LIMIT 1`;
  return rows[0] ?? null;
}

function findLatestFact(userId: string, key: string): Promise<StoredFact | null> {
  return prisma.fact.findFirst({
    where: { userId, movieKey: key },
    orderBy: { createdAt: "desc" },
    select: { movieTitle: true, text: true, createdAt: true },
  });
}

// One conditional UPDATE: Postgres row locking lets exactly one concurrent caller win.
export async function claimLease(userId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "user"
    SET "factLeaseUntil" = now() + make_interval(secs => ${LEASE_SECONDS}),
        "factLeaseToken" = ${token}
    WHERE "id" = ${userId}
      AND ("factLeaseUntil" IS NULL OR "factLeaseUntil" < now())
    RETURNING "id"`;
  return claimed.length > 0 ? token : null;
}

// The token check stops a holder that overran its expiry from clearing a newer claim.
export async function releaseLease(userId: string, token: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "user"
    SET "factLeaseUntil" = NULL, "factLeaseToken" = NULL
    WHERE "id" = ${userId} AND "factLeaseToken" = ${token}`;
}

// Counts every movie, because switching titles is how the 60 second window gets skipped.
async function isOverGenerationLimit(userId: string): Promise<boolean> {
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS "count"
    FROM "fact"
    WHERE "userId" = ${userId}
      AND "createdAt" > now() - make_interval(secs => ${GENERATION_WINDOW_SECONDS})`;
  return count >= GENERATION_LIMIT;
}

async function fallbackTo(userId: string, key: string): Promise<FactResponse> {
  const latest = await findLatestFact(userId, key);
  if (!latest) throw new AppError("FACT_UNAVAILABLE");
  return toResponse(latest, "fallback", 0);
}

async function generateAndStore(
  userId: string,
  movieTitle: string,
  key: string,
): Promise<FactResponse> {
  const previous = await findLatestFact(userId, key);
  if (await isOverGenerationLimit(userId)) {
    if (!previous) throw new AppError("RATE_LIMITED");
    return toResponse(previous, "fallback", 0);
  }
  let text: string;
  try {
    text = await generateFact({ movieTitle, previousFact: previous?.text });
  } catch (error) {
    if (!(error instanceof FactGenerationError)) throw error;
    // Log the real cause for us; the user only ever sees the fallback or a friendly error.
    console.error("Fact generation failed", { userId, cause: error.cause ?? error.message });
    if (!previous) throw new AppError("FACT_UNAVAILABLE");
    return toResponse(previous, "fallback", 0);
  }
  const created = await prisma.fact.create({
    data: { userId, movieTitle, movieKey: key, text },
    select: { movieTitle: true, text: true, createdAt: true },
  });
  return toResponse(created, "generated", CACHE_WINDOW_SECONDS);
}

export async function getFact(userId: string): Promise<FactResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { favoriteMovie: true },
  });
  if (!user?.favoriteMovie) throw new AppError("ONBOARDING_REQUIRED");

  const movieTitle = user.favoriteMovie;
  const key = movieKey(movieTitle);

  const fresh = await findFreshFact(userId, key);
  if (fresh) return toResponse(fresh, "cache", fresh.secondsUntilRefresh);

  // Someone else is generating: wait for their fact, or take over once they release.
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let token = await claimLease(userId);
  while (!token) {
    if (Date.now() >= deadline) return fallbackTo(userId, key);
    await sleep(POLL_INTERVAL_MS);
    const shared = await findFreshFact(userId, key);
    if (shared) return toResponse(shared, "shared", shared.secondsUntilRefresh);
    token = await claimLease(userId);
  }

  try {
    // A parallel holder may have finished between our fresh check and our claim.
    const justStored = await findFreshFact(userId, key);
    if (justStored) return toResponse(justStored, "cache", justStored.secondsUntilRefresh);
    return await generateAndStore(userId, movieTitle, key);
  } finally {
    await releaseLease(userId, token);
  }
}

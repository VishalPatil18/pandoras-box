import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { claimLease, getFact, releaseLease } from "@/lib/facts";
import { generateFact } from "@/lib/openai";
import { setFavoriteMovie } from "@/lib/users";
import { createUser, resetDb } from "../setup/db";

vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateFact: vi.fn(),
}));

function slowGenerator(delayMs: number) {
  let calls = 0;
  vi.mocked(generateFact).mockImplementation(async ({ movieTitle }) => {
    calls += 1;
    const label = `${movieTitle} fact ${calls}`;
    await sleep(delayMs);
    return label;
  });
}

async function leaseOf(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { factLeaseUntil: true, factLeaseToken: true },
  });
}

async function expireLease(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "user" SET "factLeaseUntil" = now() - interval '1 second' WHERE "id" = ${userId}`;
}

describe("getFact: one generation at a time", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generateFact).mockReset();
  });
  afterAll(() => prisma.$disconnect());

  it("makes exactly one OpenAI call for five simultaneous requests", async () => {
    slowGenerator(300);
    const user = await createUser({ favoriteMovie: "Inception" });

    const results = await Promise.all(Array.from({ length: 5 }, () => getFact(user.id)));

    expect(generateFact).toHaveBeenCalledTimes(1);
    expect(new Set(results.map((r) => r.fact.text))).toEqual(new Set(["Inception fact 1"]));
    expect(results.filter((r) => r.source === "generated")).toHaveLength(1);
    expect(results.every((r) => ["generated", "shared", "cache"].includes(r.source))).toBe(true);
    expect(await prisma.fact.count()).toBe(1);
  });

  it("releases the lease after generating", async () => {
    slowGenerator(0);
    const user = await createUser({ favoriteMovie: "Up" });

    await getFact(user.id);

    expect(await leaseOf(user.id)).toEqual({ factLeaseUntil: null, factLeaseToken: null });
  });

  it("refuses a second claim while a lease is live", async () => {
    const user = await createUser({ favoriteMovie: "Up" });

    expect(await claimLease(user.id)).toEqual(expect.any(String));
    expect(await claimLease(user.id)).toBeNull();
  });

  it("lets the next request reclaim an expired lease", async () => {
    const user = await createUser({ favoriteMovie: "Up" });
    await claimLease(user.id);
    await expireLease(user.id);

    expect(await claimLease(user.id)).toEqual(expect.any(String));
  });

  it("keeps a newer lease when a late holder releases with its old token", async () => {
    const user = await createUser({ favoriteMovie: "Up" });
    const oldToken = await claimLease(user.id);
    await expireLease(user.id);
    const newToken = await claimLease(user.id);

    await releaseLease(user.id, oldToken!);

    expect((await leaseOf(user.id)).factLeaseToken).toBe(newToken);
  });

  it("generates for a new movie once an in-flight generation for the old one finishes", async () => {
    slowGenerator(400);
    const user = await createUser({ favoriteMovie: "Up" });

    const first = getFact(user.id);
    await sleep(50);
    await setFavoriteMovie(user.id, "Heat");
    const startedAt = Date.now();
    const second = await getFact(user.id);

    expect(second).toMatchObject({ source: "generated", fact: { movieTitle: "Heat" } });
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect((await first).fact.movieTitle).toBe("Up");
    expect(generateFact).toHaveBeenCalledTimes(2);
  });
});

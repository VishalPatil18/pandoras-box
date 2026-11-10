import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getFact } from "@/lib/facts";
import { FactGenerationError, generateFact } from "@/lib/openai";
import { createUser, insertFact, resetDb } from "../setup/db";

vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateFact: vi.fn(),
}));

async function leaseOf(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { factLeaseUntil: true, factLeaseToken: true },
  });
}

describe("getFact: when OpenAI fails", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generateFact).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => prisma.$disconnect());

  it("returns the last fact for this movie, marked as fallback, and logs the error", async () => {
    vi.mocked(generateFact).mockRejectedValue(new FactGenerationError("timed out"));
    const user = await createUser({ favoriteMovie: "Inception" });
    await insertFact(user.id, { movieTitle: "Inception", text: "Old fact.", ageSeconds: 240 });

    const result = await getFact(user.id);

    expect(result).toMatchObject({ source: "fallback", secondsUntilRefresh: 0 });
    expect(result.fact.text).toBe("Old fact.");
    expect(console.error).toHaveBeenCalled();
    expect(await leaseOf(user.id)).toEqual({ factLeaseUntil: null, factLeaseToken: null });
  });

  it("throws FACT_UNAVAILABLE when there is no earlier fact, and still releases the lease", async () => {
    vi.mocked(generateFact).mockRejectedValue(new FactGenerationError("timed out"));
    const user = await createUser({ favoriteMovie: "Inception" });

    await expect(getFact(user.id)).rejects.toMatchObject(new AppError("FACT_UNAVAILABLE"));
    expect(await leaseOf(user.id)).toEqual({ factLeaseUntil: null, factLeaseToken: null });
  });

  it("never stores a fact when the model returns nothing usable", async () => {
    vi.mocked(generateFact).mockRejectedValue(new FactGenerationError("blank output"));
    const user = await createUser({ favoriteMovie: "Up" });

    await getFact(user.id).catch(() => undefined);

    expect(await prisma.fact.count()).toBe(0);
  });
});

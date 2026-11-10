import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { GENERATION_LIMIT, getFact } from "@/lib/facts";
import { generateFact } from "@/lib/openai";
import { createUser, insertFact, resetDb } from "../setup/db";

vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateFact: vi.fn(),
}));

// Older than the 60 second cache window, inside the 10 minute cap window.
const RECENT_SECONDS = 120;
const EXPIRED_SECONDS = 11 * 60;

async function insertFacts(userId: string, count: number, ageSeconds: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await insertFact(userId, { movieTitle: `Movie ${i}`, text: `Fact ${i}.`, ageSeconds });
  }
}

describe("getFact: the per user generation cap", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generateFact).mockReset();
    vi.mocked(generateFact).mockResolvedValue("A new fact.");
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => prisma.$disconnect());

  it("throws RATE_LIMITED without calling OpenAI when the cap is hit and this movie has no fact", async () => {
    const user = await createUser({ favoriteMovie: "Up" });
    await insertFacts(user.id, GENERATION_LIMIT, RECENT_SECONDS);

    await expect(getFact(user.id)).rejects.toMatchObject(new AppError("RATE_LIMITED"));
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("serves this movie's last fact as fallback when the cap is hit", async () => {
    const user = await createUser({ favoriteMovie: "Up" });
    await insertFacts(user.id, GENERATION_LIMIT - 1, RECENT_SECONDS);
    await insertFact(user.id, { movieTitle: "Up", text: "Old fact.", ageSeconds: RECENT_SECONDS });

    const result = await getFact(user.id);

    expect(result).toMatchObject({ source: "fallback", secondsUntilRefresh: 0 });
    expect(result.fact.text).toBe("Old fact.");
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("still generates below the cap, and ignores facts older than the window", async () => {
    const user = await createUser({ favoriteMovie: "Up" });
    await insertFacts(user.id, GENERATION_LIMIT - 1, RECENT_SECONDS);
    await insertFacts(user.id, 5, EXPIRED_SECONDS);

    const result = await getFact(user.id);

    expect(result.source).toBe("generated");
    expect(generateFact).toHaveBeenCalledOnce();
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getFact } from "@/lib/facts";
import { generateFact } from "@/lib/openai";
import { createUser, insertFact, resetDb } from "../setup/db";

vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateFact: vi.fn(),
}));

describe("getFact: 60 second cache window", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generateFact).mockReset().mockResolvedValue("Inception (2010): a new fact.");
  });
  afterAll(() => prisma.$disconnect());

  it("returns a fact under 60 seconds old as cache without calling OpenAI", async () => {
    const user = await createUser({ favoriteMovie: "Inception" });
    await insertFact(user.id, { movieTitle: "Inception", text: "Cached fact.", ageSeconds: 10 });

    const result = await getFact(user.id);

    expect(result.source).toBe("cache");
    expect(result.fact.text).toBe("Cached fact.");
    expect(result.secondsUntilRefresh).toBeGreaterThanOrEqual(49);
    expect(result.secondsUntilRefresh).toBeLessThanOrEqual(50);
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("generates and stores a new fact when the newest one is 61 seconds old", async () => {
    const user = await createUser({ favoriteMovie: "Inception" });
    await insertFact(user.id, { movieTitle: "Inception", text: "Old fact.", ageSeconds: 61 });

    const result = await getFact(user.id);

    expect(result.source).toBe("generated");
    expect(result.fact).toMatchObject({
      text: "Inception (2010): a new fact.",
      movieTitle: "Inception",
    });
    expect(result.secondsUntilRefresh).toBe(60);
    expect(generateFact).toHaveBeenCalledTimes(1);
    expect(generateFact).toHaveBeenCalledWith({
      movieTitle: "Inception",
      previousFact: "Old fact.",
    });
    expect(await prisma.fact.count({ where: { userId: user.id } })).toBe(2);
  });

  it("does not count a fresh fact for a different movie", async () => {
    const user = await createUser({ favoriteMovie: "Inception" });
    await insertFact(user.id, { movieTitle: "Up", text: "Up fact.", ageSeconds: 5 });

    const result = await getFact(user.id);

    expect(result.source).toBe("generated");
  });

  it("still hits the cache after a capitalization-only change", async () => {
    const user = await createUser({ favoriteMovie: "INCEPTION" });
    await insertFact(user.id, { movieTitle: "Inception", text: "Cached fact.", ageSeconds: 5 });

    const result = await getFact(user.id);

    expect(result.source).toBe("cache");
    expect(generateFact).not.toHaveBeenCalled();
  });

  it("refuses with ONBOARDING_REQUIRED when the user has no movie", async () => {
    const user = await createUser({ favoriteMovie: null });

    await expect(getFact(user.id)).rejects.toMatchObject(new AppError("ONBOARDING_REQUIRED"));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, OpenAIConstructor } = vi.hoisted(() => {
  const create = vi.fn();
  const OpenAIConstructor = vi.fn(function () {
    return { responses: { create } };
  });
  return { create, OpenAIConstructor };
});

vi.mock("openai", () => ({ default: OpenAIConstructor }));

import { FactGenerationError, generateFact } from "@/lib/openai";

function completed(text: string) {
  return { status: "completed", output_text: text };
}

describe("generateFact", () => {
  beforeEach(() => {
    create.mockReset();
    vi.stubEnv("OPENAI_MODEL", "gpt-5.4-mini");
  });

  it("sends the title as quoted data, never inside the instructions", async () => {
    create.mockResolvedValue(completed("Inception (2010): a fact."));

    await generateFact({ movieTitle: "Inception" });

    const [params] = create.mock.calls[0];
    expect(params.input).toContain('"""Inception"""');
    expect(params.instructions).not.toContain("Inception");
  });

  it("asks for a different fact when it has the previous one", async () => {
    create.mockResolvedValue(completed("Inception (2010): another fact."));

    await generateFact({ movieTitle: "Inception", previousFact: "The hallway rotated." });

    expect(create.mock.calls[0][0].input).toContain("The hallway rotated.");
  });

  it("uses the configured model, a 150-token cap and no reasoning", async () => {
    create.mockResolvedValue(completed("Up (2009): a fact."));

    await generateFact({ movieTitle: "Up" });

    expect(create.mock.calls[0][0]).toMatchObject({
      model: "gpt-5.4-mini",
      max_output_tokens: 150,
      reasoning: { effort: "none" },
    });
  });

  it("returns the trimmed text", async () => {
    create.mockResolvedValue(completed("  Up (2009): a fact.  \n"));

    expect(await generateFact({ movieTitle: "Up" })).toBe("Up (2009): a fact.");
  });

  it("treats incomplete, blank or failed responses as FactGenerationError", async () => {
    create.mockResolvedValueOnce({ status: "incomplete", output_text: "Up (2009): a fa" });
    await expect(generateFact({ movieTitle: "Up" })).rejects.toBeInstanceOf(FactGenerationError);

    create.mockResolvedValueOnce(completed("   "));
    await expect(generateFact({ movieTitle: "Up" })).rejects.toBeInstanceOf(FactGenerationError);

    create.mockRejectedValueOnce(new Error("Request timed out."));
    await expect(generateFact({ movieTitle: "Up" })).rejects.toBeInstanceOf(FactGenerationError);
  });

  it("builds one client with an 8 second timeout and no retries", async () => {
    create.mockResolvedValue(completed("Up (2009): a fact."));
    OpenAIConstructor.mockClear();
    vi.resetModules();
    const fresh = await import("@/lib/openai");

    await fresh.generateFact({ movieTitle: "Up" });
    await fresh.generateFact({ movieTitle: "Up" });

    expect(OpenAIConstructor).toHaveBeenCalledTimes(1);
    expect(OpenAIConstructor).toHaveBeenCalledWith({ timeout: 8_000, maxRetries: 0 });
  });
});

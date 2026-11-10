import { describe, expect, it } from "vitest";
import { MOVIE_MAX, normalizeMovie } from "@/lib/movie";

describe("normalizeMovie", () => {
  it("trims the ends and collapses inner whitespace", () => {
    expect(normalizeMovie("  The   Matrix ")).toEqual({
      ok: true,
      value: "The Matrix",
      key: "the matrix",
    });
  });

  it("accepts a one-letter title", () => {
    expect(normalizeMovie("M")).toMatchObject({ ok: true, value: "M" });
  });

  it("rejects an empty title after trimming", () => {
    expect(normalizeMovie("   ")).toEqual({ ok: false, message: "Enter a movie title." });
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(normalizeMovie("a".repeat(MOVIE_MAX))).toMatchObject({ ok: true });
    expect(normalizeMovie("a".repeat(MOVIE_MAX + 1))).toEqual({
      ok: false,
      message: "Keep the title under 100 characters.",
    });
  });

  it("rejects control characters", () => {
    expect(normalizeMovie("Up\u0007")).toEqual({
      ok: false,
      message: "Remove the hidden characters from the title.",
    });
  });

  it("turns pasted tabs and newlines into single spaces", () => {
    expect(normalizeMovie("Heat\tReturns\n")).toMatchObject({ ok: true, value: "Heat Returns" });
  });

  it("treats anything that isn't a string as empty", () => {
    expect(normalizeMovie(42)).toEqual({ ok: false, message: "Enter a movie title." });
    expect(normalizeMovie(undefined)).toEqual({ ok: false, message: "Enter a movie title." });
  });

  it("keeps accented and non-Latin titles exactly", () => {
    expect(normalizeMovie("Amélie")).toMatchObject({ ok: true, value: "Amélie", key: "amélie" });
    expect(normalizeMovie("千と千尋の神隠し")).toMatchObject({
      ok: true,
      value: "千と千尋の神隠し",
    });
  });
});

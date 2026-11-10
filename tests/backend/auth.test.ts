import { describe, expect, it } from "vitest";
import { profileToUser } from "@/lib/auth";
import { AppError, ERROR_STATUS } from "@/lib/errors";

describe("profileToUser", () => {
  it("keeps the Google name and photo", () => {
    expect(
      profileToUser({ name: "Ada Okafor", email: "ada@example.com", picture: "https://p/a.jpg" }),
    ).toEqual({ name: "Ada Okafor", image: "https://p/a.jpg" });
  });

  it("stores an empty name when Google sends none, so sign-in still succeeds", () => {
    expect(profileToUser({ email: "ada@example.com" })).toEqual({ name: "", image: undefined });
    expect(profileToUser({ name: "   ", email: "ada@example.com", picture: null })).toEqual({
      name: "",
      image: undefined,
    });
  });
});

describe("AppError", () => {
  it("maps every error code to its HTTP status", () => {
    expect(ERROR_STATUS).toEqual({
      UNAUTHENTICATED: 401,
      VALIDATION_ERROR: 400,
      ONBOARDING_REQUIRED: 409,
      RATE_LIMITED: 429,
      FACT_UNAVAILABLE: 503,
      INTERNAL: 500,
    });
    expect(new AppError("FACT_UNAVAILABLE").status).toBe(503);
  });

  it("carries a default message the user can act on, and optional field issues", () => {
    const error = new AppError("VALIDATION_ERROR", undefined, [
      { path: ["movie"], message: "Enter a movie title." },
    ]);
    expect(error.message).not.toBe("");
    expect(error.issues).toEqual([{ path: ["movie"], message: "Enter a movie title." }]);
  });
});

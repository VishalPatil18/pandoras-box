import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { api, ApiError, isUnauthenticated } from "@/lib/api";
import { server } from "../setup/frontend";

const errorBody = (code: string, message: string, issues?: unknown) => ({
  error: { code, message, ...(issues ? { issues } : {}) },
});

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("api client", () => {
  it("turns a 401 into ApiError UNAUTHENTICATED", async () => {
    server.use(
      http.get("*/api/me", () =>
        HttpResponse.json(errorBody("UNAUTHENTICATED", "Sign in to continue."), { status: 401 }),
      ),
    );

    const error = await caught(api.getMe());

    expect(error).toMatchObject({ status: 401, code: "UNAUTHENTICATED" });
    expect(isUnauthenticated(error)).toBe(true);
  });

  it("turns a 500 into ApiError INTERNAL with the server's message", async () => {
    server.use(
      http.get("*/api/fact", () =>
        HttpResponse.json(errorBody("INTERNAL", "Something went wrong. Try again in a moment."), {
          status: 500,
        }),
      ),
    );

    const error = await caught(api.getFact());

    expect(error).toMatchObject({
      status: 500,
      code: "INTERNAL",
      message: "Something went wrong. Try again in a moment.",
    });
    expect(isUnauthenticated(error)).toBe(false);
  });

  it("turns a network failure into status 0 INTERNAL", async () => {
    server.use(http.get("*/api/fact", () => HttpResponse.error()));

    const error = await caught(api.getFact());

    expect(error).toMatchObject({ status: 0, code: "INTERNAL" });
  });

  it("rejects a 200 body that doesn't match the contract", async () => {
    server.use(http.get("*/api/me", () => HttpResponse.json({ surprise: true })));

    const error = await caught(api.getMe());

    expect(error).toMatchObject({ status: 200, code: "INTERNAL" });
  });

  it("keeps field issues on VALIDATION_ERROR", async () => {
    const issues = [{ path: ["movie"], message: "Enter a movie title." }];
    server.use(
      http.put("*/api/me/movie", () =>
        HttpResponse.json(errorBody("VALIDATION_ERROR", "Enter a movie title.", issues), {
          status: 400,
        }),
      ),
    );

    const error = await caught(api.setMovie(" "));

    expect(error).toMatchObject({ status: 400, code: "VALIDATION_ERROR", issues });
  });

  it("sends the movie as a JSON PUT and returns the saved title", async () => {
    let received: unknown;
    server.use(
      http.put("*/api/me/movie", async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ favoriteMovie: "Heat" });
      }),
    );

    expect(await api.setMovie("Heat")).toEqual({ favoriteMovie: "Heat" });
    expect(received).toEqual({ movie: "Heat" });
  });
});

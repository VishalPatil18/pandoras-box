import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getFactRoute } from "@/app/api/fact/route";
import { GET as getMe } from "@/app/api/me/route";
import { PUT as putMovie } from "@/app/api/me/movie/route";
import { ErrorBodySchema } from "@/lib/contracts";
import { prisma } from "@/lib/db";
import { getFact } from "@/lib/facts";
import { generateFact } from "@/lib/openai";
import { createUser, insertFact, resetDb } from "../setup/db";

// Outside Next there is no request scope, so hand Better Auth a request with no cookie.
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("@/lib/openai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openai")>()),
  generateFact: vi.fn(),
}));

describe("authorization", () => {
  beforeEach(async () => {
    await resetDb();
    vi.mocked(generateFact).mockReset();
  });
  afterAll(() => prisma.$disconnect());

  it("never returns another user's fact, even for the same movie", async () => {
    const ada = await createUser({ favoriteMovie: "Inception" });
    const ben = await createUser({ favoriteMovie: "Inception" });
    await insertFact(ada.id, { movieTitle: "Inception", text: "Ada's fact.", ageSeconds: 5 });
    vi.mocked(generateFact).mockResolvedValue("Ben's own fact.");

    const result = await getFact(ben.id);

    expect(result).toMatchObject({ source: "generated", fact: { text: "Ben's own fact." } });
  });

  it("answers 401 on every endpoint when there is no session", async () => {
    const calls = [
      getMe(new Request("http://localhost/api/me")),
      getFactRoute(new Request("http://localhost/api/fact")),
      putMovie(
        new Request("http://localhost/api/me/movie", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ movie: "Up" }),
        }),
      ),
    ];

    for (const response of await Promise.all(calls)) {
      expect(response.status).toBe(401);
      expect(ErrorBodySchema.parse(await response.json()).error.code).toBe("UNAUTHENTICATED");
    }
    expect(generateFact).not.toHaveBeenCalled();
  });
});

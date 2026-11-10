import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { PUT as putMovie } from "@/app/api/me/movie/route";
import { ErrorBodySchema } from "@/lib/contracts";
import { requireUser, type CurrentUser } from "@/lib/dal";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createUser, resetDb } from "../setup/db";

vi.mock("@/lib/dal", () => ({ requireUser: vi.fn() }));

function signInAs(user: { id: string }): CurrentUser {
  const current: CurrentUser = {
    id: user.id,
    name: "Ada Okafor",
    email: "ada@example.com",
    image: null,
    favoriteMovie: "Inception",
  };
  vi.mocked(requireUser).mockResolvedValue(current);
  return current;
}

function putRequest(body: string): Request {
  return new Request("http://localhost/api/me/movie", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("GET /api/me", () => {
  it("returns the signed-in user's profile", async () => {
    const current = signInAs({ id: "user-ada" });

    const response = await getMe(new Request("http://localhost/api/me"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(current);
  });

  it("returns 401 without a session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AppError("UNAUTHENTICATED"));

    const response = await getMe(new Request("http://localhost/api/me"));

    expect(response.status).toBe(401);
  });
});

describe("PUT /api/me/movie", () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it("saves the normalized title for the signed-in user", async () => {
    const user = await createUser();
    signInAs(user);

    const response = await putMovie(putRequest(JSON.stringify({ movie: "  inception " })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ favoriteMovie: "inception" });
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    expect(saved?.favoriteMovie).toBe("inception");
  });

  it("rejects an empty title with VALIDATION_ERROR pointing at the movie field", async () => {
    signInAs(await createUser());

    const response = await putMovie(putRequest(JSON.stringify({ movie: "   " })));

    expect(response.status).toBe(400);
    expect(ErrorBodySchema.parse(await response.json()).error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Enter a movie title.",
      issues: [{ path: ["movie"], message: "Enter a movie title." }],
    });
  });

  it("rejects a body that isn't JSON", async () => {
    signInAs(await createUser());

    const response = await putMovie(putRequest("not json"));

    expect(response.status).toBe(400);
    expect(ErrorBodySchema.parse(await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("ignores a userId in the body and only changes the session user", async () => {
    const me = await createUser();
    const other = await createUser({ favoriteMovie: "Heat" });
    signInAs(me);

    await putMovie(putRequest(JSON.stringify({ movie: "Up", userId: other.id })));

    const untouched = await prisma.user.findUnique({ where: { id: other.id } });
    expect(untouched?.favoriteMovie).toBe("Heat");
  });
});

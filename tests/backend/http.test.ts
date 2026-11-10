import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBodySchema } from "@/lib/contracts";
import { requireUser, type CurrentUser } from "@/lib/dal";
import { AppError } from "@/lib/errors";
import { withUser } from "@/lib/http";

vi.mock("@/lib/dal", () => ({ requireUser: vi.fn() }));

const ADA: CurrentUser = {
  id: "user-ada",
  name: "Ada Okafor",
  email: "ada@example.com",
  image: null,
  favoriteMovie: "Inception",
};
const request = () => new Request("http://localhost/api/test");

describe("withUser", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 UNAUTHENTICATED when there is no session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AppError("UNAUTHENTICATED"));
    const handler = vi.fn();

    const response = await withUser(handler)(request());

    expect(response.status).toBe(401);
    expect(ErrorBodySchema.parse(await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the session user to the handler and returns its result as JSON", async () => {
    vi.mocked(requireUser).mockResolvedValue(ADA);

    const response = await withUser(async (user) => ({ greeting: `hi ${user.id}` }))(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ greeting: "hi user-ada" });
  });

  it("passes VALIDATION_ERROR issues through to the client", async () => {
    vi.mocked(requireUser).mockResolvedValue(ADA);
    const issues = [{ path: ["movie"], message: "Enter a movie title." }];

    const response = await withUser(async () => {
      throw new AppError("VALIDATION_ERROR", "Enter a movie title.", issues);
    })(request());

    expect(response.status).toBe(400);
    expect(ErrorBodySchema.parse(await response.json()).error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Enter a movie title.",
      issues,
    });
  });

  it("hides unexpected errors behind a generic INTERNAL response and logs them", async () => {
    vi.mocked(requireUser).mockResolvedValue(ADA);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await withUser(async () => {
      throw new Error("db exploded");
    })(request());

    expect(response.status).toBe(500);
    const body = ErrorBodySchema.parse(await response.json());
    expect(body.error.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("db exploded");
    expect(log).toHaveBeenCalled();
  });
});

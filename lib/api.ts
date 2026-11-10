import type { z } from "zod";
import {
  ErrorBodySchema,
  FactResponseSchema,
  MeSchema,
  SetMovieResponseSchema,
  type FactResponse,
  type Me,
  type SetMovieResponse,
} from "@/lib/contracts";
import type { ErrorCode, Issue } from "@/lib/errors";

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
const GENERIC_MESSAGE = "Something went wrong. Try again in a moment.";
const CONTRACT_MESSAGE = "The server sent a response the app didn't expect.";

// Every failure the browser can see, network included, arrives as this one type.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: Issue[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.code === "UNAUTHENTICATED";
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(new URL(path, window.location.origin), {
      ...init,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "INTERNAL", NETWORK_MESSAGE);
  }

  const body: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = ErrorBodySchema.safeParse(body);
    if (parsed.success) {
      const { code, message, issues } = parsed.data.error;
      throw new ApiError(response.status, code, message, issues);
    }
    const code: ErrorCode = response.status === 401 ? "UNAUTHENTICATED" : "INTERNAL";
    throw new ApiError(response.status, code, GENERIC_MESSAGE);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(response.status, "INTERNAL", CONTRACT_MESSAGE);
  return parsed.data;
}

export const api = {
  getMe: (): Promise<Me> => request("/api/me", MeSchema),
  getFact: (): Promise<FactResponse> => request("/api/fact", FactResponseSchema),
  setMovie: (movie: string): Promise<SetMovieResponse> =>
    request("/api/me/movie", SetMovieResponseSchema, {
      method: "PUT",
      body: JSON.stringify({ movie }),
    }),
};

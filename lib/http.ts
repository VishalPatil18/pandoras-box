import "server-only";
import type { z } from "zod";
import type { ErrorBody } from "@/lib/contracts";
import { requireUser, type CurrentUser } from "@/lib/dal";
import { AppError, type Issue } from "@/lib/errors";

// Request bodies are untrusted: bad JSON or a schema miss becomes one VALIDATION_ERROR.
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Send the request body as JSON.");
  }

  const result = schema.safeParse(json);
  if (result.success) return result.data;

  const issues: Issue[] = result.error.issues.map((issue) => ({
    path: issue.path.map((segment) => (typeof segment === "symbol" ? String(segment) : segment)),
    message: issue.message,
  }));
  throw new AppError("VALIDATION_ERROR", issues[0]?.message, issues);
}

function errorResponse(error: AppError): Response {
  const body: ErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.issues && { issues: error.issues }),
    },
  };
  return Response.json(body, { status: error.status });
}

// Every API route goes through here: session check first, then one error shape for all failures.
export function withUser<T>(
  handler: (user: CurrentUser, request: Request) => Promise<T>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const user = await requireUser();
      return Response.json(await handler(user, request));
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error);
      console.error("Unhandled API error", error);
      return errorResponse(new AppError("INTERNAL"));
    }
  };
}

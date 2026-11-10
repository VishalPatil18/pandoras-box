import "server-only";
import type { ErrorBody } from "@/lib/contracts";
import { requireUser, type CurrentUser } from "@/lib/dal";
import { AppError } from "@/lib/errors";

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

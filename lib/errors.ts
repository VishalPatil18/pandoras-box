export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  VALIDATION_ERROR: 400,
  ONBOARDING_REQUIRED: 409,
  FACT_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type Issue = { path: (string | number)[]; message: string };

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  VALIDATION_ERROR: "Check the highlighted field and try again.",
  ONBOARDING_REQUIRED: "Choose your favorite movie first.",
  FACT_UNAVAILABLE: "Couldn't load a fact. OpenAI didn't answer in time.",
  INTERNAL: "Something went wrong. Try again in a moment.",
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly issues?: Issue[],
  ) {
    super(message);
    this.name = "AppError";
    this.status = ERROR_STATUS[code];
  }
}

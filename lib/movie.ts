import { z } from "zod";

export const MOVIE_MAX = 100;

export const MOVIE_ERRORS = {
  empty: "Enter a movie title.",
  tooLong: "Keep the title under 100 characters.",
  hidden: "Remove the hidden characters from the title.",
} as const;

export type MovieError = (typeof MOVIE_ERRORS)[keyof typeof MOVIE_ERRORS];

// Whitespace collapses first, so pasted tabs and newlines become spaces instead of errors.
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export const MovieTitleSchema = z
  .string({ error: MOVIE_ERRORS.empty })
  .transform((raw) => raw.trim().replace(/\s+/g, " "))
  .refine((title) => !CONTROL_CHARS.test(title), { error: MOVIE_ERRORS.hidden, abort: true })
  .refine((title) => title.length > 0, { error: MOVIE_ERRORS.empty, abort: true })
  .refine((title) => title.length <= MOVIE_MAX, { error: MOVIE_ERRORS.tooLong });

export type NormalizedMovie =
  { ok: true; value: string; key: string } | { ok: false; message: MovieError };

export function movieKey(title: string): string {
  return title.toLowerCase();
}

export function normalizeMovie(input: unknown): NormalizedMovie {
  const result = MovieTitleSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, message: result.error.issues[0].message as MovieError };
  }
  return { ok: true, value: result.data, key: movieKey(result.data) };
}

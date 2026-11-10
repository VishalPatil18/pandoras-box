import { z } from "zod";
import { ERROR_STATUS, type ErrorCode } from "@/lib/errors";
import { MovieTitleSchema } from "@/lib/movie";

// One schema per endpoint, shared by the route handlers and the browser client.

export const MeSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
  favoriteMovie: z.string().nullable(),
});

export const SetMovieBodySchema = z.object({ movie: MovieTitleSchema });

export const SetMovieResponseSchema = z.object({ favoriteMovie: z.string() });

export const FactSourceSchema = z.enum(["cache", "generated", "shared", "fallback"]);

export const FactResponseSchema = z.object({
  fact: z.object({
    text: z.string(),
    movieTitle: z.string(),
    generatedAt: z.iso.datetime(),
  }),
  source: FactSourceSchema,
  secondsUntilRefresh: z.number().int().min(0).max(60),
});

const ERROR_CODES = Object.keys(ERROR_STATUS) as [ErrorCode, ...ErrorCode[]];

export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    issues: z
      .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
      .optional(),
  }),
});

export type Me = z.infer<typeof MeSchema>;
export type SetMovieBody = z.infer<typeof SetMovieBodySchema>;
export type SetMovieResponse = z.infer<typeof SetMovieResponseSchema>;
export type FactSource = z.infer<typeof FactSourceSchema>;
export type FactResponse = z.infer<typeof FactResponseSchema>;
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

# Context

What exists, how it works, and what is locked in. Entries are appended per session and past entries are never edited.

---

## 2026-11-10: Planning, design and foundation

### What exists

- **Planning docs:** `dev-docs/epic.md`, `research.md`, `design-decisions.md` (D1 to D30, ADR-031), `architecture.md`, `srs.md`, `plan.md`.
- **Visual system:** `design/DESIGN.md`, plus clickable HTML mockups in `design/mocks/` and Rune icons in `design/icons/`.
- **A Next.js 16.4.6 app** that builds, with a placeholder home page. No auth, database or API code yet.
- **Tooling:**
  - pnpm 12.
  - TypeScript 6 strict.
  - ESLint 9 with Next's core web vitals and TypeScript rules.
  - Prettier with a 100-character line width. It skips Markdown, `design/` and `dev-docs/`.
  - Vitest 5 with `backend` (node) and `frontend` (jsdom) projects.
- **Local database:** `docker-compose.yml` runs `postgres:17` on port 5433.
- **CI:** GitHub Actions runs install, typecheck, lint, test and build on Node 24 with a Postgres service.

### How it works

- **Theme:** `app/globals.css` holds the DESIGN.md tokens as a Tailwind v4 `@theme`, with utilities like `bg-sky`, `text-carbon`, `rounded-pill` and `font-display`. shadcn's semantic variables (`primary`, `border`, `ring` and so on) point at the same tokens, so shadcn and Cult UI components pick up the brand without per-component overrides.
- **Fonts:** `app/layout.tsx` loads Bowlby One from Google Fonts through `next/font`, and General Sans 500 and 700 from `app/fonts/` (ITF Free Font License, which allows self-hosting; the license file is alongside).
- **Type check:** `pnpm typecheck` runs `next typegen` first, because types like `LayoutProps` only exist after Next generates them.

### Locked in

- Library versions are pinned exactly. The full table, including packages still to install, is under plan Task 1.
- TypeScript stays on 6.x until typescript-eslint supports 7. ESLint stays on 9.x until eslint-plugin-react supports 10.
- Prisma is pinned to 7.10.1, because npm's `latest` tag points at an 8.0 release candidate.
- `next.config.ts` keeps the template's `cacheComponents: true` and `partialPrefetching: true` for now. This affects how pages read the session (see learnings). The owner decides it before the auth work.
- The agent never commits or pushes. Each change ends with a commit message for the owner.

---

## 2026-11-10: Data, auth and validation (plan Tasks 3 to 6)

### What exists

- **Database schema** (`prisma/schema.prisma`, migration `20261110181010_init`):
  - Better Auth's `user`, `session`, `account` and `verification` tables.
  - Three app columns on `user`: `favoriteMovie` (`VARCHAR(100)`, null until onboarding), and `factLeaseUntil` (`timestamptz`) plus `factLeaseToken` for the generation lease.
  - A `fact` table: `userId`, `movieTitle`, `movieKey`, `text`, and a `createdAt` set by the database. It's indexed on `(userId, movieKey, createdAt DESC)` and cascades on user delete.
- **`lib/db.ts`:** one Prisma client on a `pg` pool with 5-second connect and idle timeouts, reused across dev hot reloads. The client is generated into `generated/prisma` (gitignored) by `postinstall`.
- **`lib/movie.ts`:** `MovieTitleSchema` and `normalizeMovie()`. Trim, collapse whitespace, reject control characters, 1 to 100 characters, and a lowercased key.
- **`lib/auth.ts`:** Better Auth with the Prisma adapter and Google (`prompt: select_account`). The profile is refreshed on every sign-in. The cookie cache is off, so logout takes effect on the next request.
- **`lib/dal.ts`:** `getCurrentUser()` and `requireUser()`, the one place a request becomes a user.
- **`lib/errors.ts`:** `AppError` with five codes, their statuses, and default messages a user can act on.
- **`lib/contracts.ts`:** Zod schemas for `/api/me`, `/api/me/movie`, `/api/fact` and the error body.
- **`lib/http.ts`:** `withUser()`, which every API route uses. It checks the session first, returns one error shape, and logs unexpected errors while showing a generic message.
- **`/api/auth/[...all]`:** Better Auth's handler, plus `lib/auth-client.ts` for the browser.
- **Tests:** 19 backend tests. The movie rule, the schema against real Postgres, the auth helpers and the route wrapper.

### How it works

- `prisma7.config.ts` is the Prisma 7.10 config file name. It loads `.env` itself and points migrations at `DIRECT_URL`.
- Backend tests run against `pandoras_test` on the same Docker Postgres. `tests/setup/global-db.ts` creates it if needed and runs `prisma migrate deploy` before the suite. CI sets `TEST_DATABASE_URL` to its own service.
- Vitest aliases `server-only` to an empty module, because the real package throws outside Next's server bundle.

### Locked in

- ADR-032: `cacheComponents` is off and `partialPrefetching` is removed. Pages read the session and redirect on the server before rendering.
- better-auth 1.7.18 and the `auth` CLI 1.7.18 are pinned outside pnpm's one-day release-age window.
- pnpm may run install scripts for `prisma` and `@prisma/engines` only (`pnpm-workspace.yaml`).

---

## 2026-11-10: Fact service and API (plan Tasks 7 to 11, Variant A)

### What exists

- **`GET /api/me`:** the session user's profile.
- **`PUT /api/me/movie`:** validates the body with `SetMovieBodySchema` through `parseBody`, then saves the normalized title (`lib/users.ts`).
- **`GET /api/fact`:** `getFact(user.id)` from `lib/facts.ts`, with `maxDuration = 15`.
- **`lib/openai.ts`:** `generateFact({ movieTitle, previousFact? })`. It calls the Responses API with `gpt-5.4-mini` (or `OPENAI_MODEL`), `reasoning.effort: "none"`, a 150-token cap, an 8 second timeout and no retries. It throws `FactGenerationError` for any failure, incomplete response or blank text.
- **`lib/facts.ts`:** the algorithm from architecture §7:
  1. A fresh fact (under 60 seconds, measured with Postgres `now()`) is returned as `cache`.
  2. Otherwise the request claims the user's lease with one conditional `UPDATE` (15 seconds, random token).
  3. A request that doesn't get the lease polls every 500 ms for up to 9 seconds. It returns `shared` when the holder's fact appears, takes over if the lease frees up, and falls back at the deadline.
  4. The holder re-checks, generates, stores, and releases the lease with a token check in `finally`.
  5. If OpenAI fails, the last fact for that movie comes back as `fallback`, or `FACT_UNAVAILABLE` (503) when there is none.
- **Tests:** 47 in total. The new ones cover routes, the OpenAI wrapper, the cache window, five-way concurrency (exactly one OpenAI call), lease expiry and token-checked release, a movie change during generation, fallback, and authorization.

### How it works

- Request bodies are validated once, in `parseBody`. Services receive values that are already valid.
- The OpenAI client is created on first use, so `next build` and imports never need the API key.
- Backend tests mock only `generateFact` (keeping the real `FactGenerationError`), and stub `next/headers` where a route has to run its real auth chain.

### Locked in

- ADR-033: reasoning effort is `none`.
- `openai` 7.54.0 is pinned, because 7.55.0 was inside pnpm's one-day window.

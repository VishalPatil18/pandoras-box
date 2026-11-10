# Pandoras Box implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Pandoras Box: Google sign-in, one favorite movie, and a dashboard with an AI fact. It includes Variant A (server cache, lease, fallback) and Variant B (typed API, optimistic edit, client cache), and gets deployed to Vercel.

**Architecture:** One Next.js App Router app. A server-only data access layer (`requireUser`) guards every page and route. `getFact` serves facts from Postgres within 60 seconds. A conditional-UPDATE lease makes sure only one OpenAI call runs per user, and the last fact is the fallback. The browser keeps facts for 30 seconds with TanStack Query and edits the movie optimistically.

**Tech stack:** Next.js 16 (≥ 16.2.6), React 19, TypeScript strict, Tailwind v4 + shadcn + Cult UI, Better Auth, Prisma 7 + `@prisma/adapter-pg`, Supabase Postgres, OpenAI Node SDK (Responses API), TanStack Query v5, Zod, Vitest, MSW, React Testing Library, pnpm.

**Spec:** [srs.md](srs.md). It is backed by [architecture.md](architecture.md), [design-decisions.md](design-decisions.md), [design/DESIGN.md](../design/DESIGN.md) and the mockups in [design/mocks/index.html](../design/mocks/index.html). Read the spec alongside this plan. Requirement IDs (FR-*, NFR-*, T-*) refer to it.

## Global constraints

- Next.js version `>= 16.2.6`. There is no `middleware.ts` or `proxy.ts` (NFR-SEC-3).
- TypeScript `strict: true`, with no `any` in app code (NFR-MAIN-1).
- Every module that reads a secret or touches the database starts with `import "server-only"`. No secret uses the `NEXT_PUBLIC_` prefix (NFR-SEC-1).
- No route or service accepts a user ID from the client (FR-API-3).
- Time comparisons use Postgres `now()`, never `Date.now()`, on the server (D12).
- Timing constants: cache window 60 s, lease 15 s, OpenAI timeout 8000 ms with 0 retries, poll every 500 ms for up to 9000 ms, client `staleTime` 30000 ms.
- Error codes and statuses: `UNAUTHENTICATED` 401, `VALIDATION_ERROR` 400, `ONBOARDING_REQUIRED` 409, `FACT_UNAVAILABLE` 503, `INTERNAL` 500.
- Visual tokens, fonts and icons follow DESIGN.md and D28/D29. Copy strings match srs.md exactly.
- Code comments and docs use plain language with no em or en dashes (NFR-MAIN-3).
- **The owner commits and pushes by hand.** Each task ends with a checkpoint that gives the owner a Conventional Commits message. Don't run `git commit` or `git push`.

## Review focus

Five situations the spec implies but doesn't spell out, with the behavior a user would expect. Each one has a test in the task that owns the code.

1. **The movie changes while a fact is still generating for the old movie.** The request for the new movie must not wait 9 seconds and then return 503. Each poll iteration also tries to claim the lease, so the new movie gets generated as soon as the old generation releases it. Test: Task 10, `generates for a new movie after an in-flight generation for the old one finishes`.
2. **Non-English and accented titles** such as "Amélie" and "千と千尋の神隠し" must be accepted and keep their exact characters. An emoji-only title is accepted, because only control characters are rejected. Test: Task 4.
3. **OpenAI returns an empty or incomplete response** (`status: "incomplete"` or blank text). This is a failure, so it uses the fallback, and an empty fact must never be stored. Test: Task 11.
4. **The session expires while the user is on the dashboard.** The next save or fact request gets a 401, and the app goes to `/` rather than showing a generic error. Test: Task 13.
5. **Google sends no name.** Sign-in must still succeed, and the profile shows the email prefix. Test: Task 5, mapping helper.

---

## File map

```
.env.example                   every variable from arch §11, placeholders only
docker-compose.yml             postgres:17 on host port 5433 for local dev and tests
vitest.config.ts               two projects: "backend" (node) and "frontend" (jsdom)
.github/workflows/ci.yml       typecheck, lint, test with a Postgres service
prisma/schema.prisma           Better Auth models + app fields + Fact
prisma7.config.ts               datasource from DIRECT_URL, loads dotenv
app/layout.tsx                 fonts, globals, <Providers>
app/globals.css                Tailwind v4 @theme with DESIGN.md tokens
app/fonts/                     GeneralSans-Medium.woff2, GeneralSans-Bold.woff2
app/page.tsx                   landing + signed-in redirect
app/onboarding/page.tsx        guard + <OnboardingForm>
app/dashboard/page.tsx         guard + server data + <Dashboard>
app/api/auth/[...all]/route.ts Better Auth handler
app/api/me/route.ts            GET
app/api/me/movie/route.ts      PUT
app/api/fact/route.ts          GET, maxDuration 15
lib/db.ts                      Prisma client on a pg Pool
lib/auth.ts                    Better Auth server config
lib/auth-client.ts             Better Auth React client
lib/dal.ts                     getCurrentUser, requireUser
lib/errors.ts                  AppError, ErrorCode
lib/http.ts                    route wrapper, JSON error responses
lib/movie.ts                   title rule
lib/contracts.ts               Zod schemas + inferred types
lib/openai.ts                  generateFact
lib/facts.ts                   getFact and lease helpers
lib/api.ts                     typed browser client, ApiError
lib/queries.ts                 query keys and hooks
components/providers.tsx       QueryClientProvider + 401 redirect
components/icons.tsx           Rune icons as React components
components/ui/*                Cult UI components restyled to DESIGN.md
components/landing/*           marquee, ribbon, stickers, hero
components/onboarding-form.tsx
components/dashboard/*         profile-pill, movie-editor, fact-ticket, new-fact-button, dashboard
tests/setup/*                  db reset, MSW server, render helpers
tests/backend/*.test.ts        T-A1 to T-A8
tests/frontend/*.test.tsx      T-B1 to T-B5
```

---

# Phase 1: Foundation

### Task 1: Scaffold, tooling and design tokens ✅

**Files:**
- Created: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `components.json`, `components/ui/button.tsx` (shadcn default, restyled in Task 14), `lib/utils.ts`, `app/layout.tsx`, `app/page.tsx` (placeholder), `app/globals.css`, `app/fonts/*`, `docker-compose.yml`, `.env.example`, `vitest.config.ts`, `AGENTS.md`

**Interfaces:**
- Produces:
  - pnpm scripts `dev`, `build`, `start`, `typecheck` (`next typegen && tsc --noEmit`), `lint`, `format`, `test` (`vitest run`), `test:backend`, `test:frontend`, `db:up` (`docker compose up -d db`). Task 3 adds `db:migrate`.
  - Tailwind theme names: colors `carbon paper sky concrete mist blue mint lavender ember sun violet ink-soft`, radii `rounded-card` (20px), `rounded-card-xl` (40px), `rounded-pill`, fonts `font-display` (Bowlby One) and `font-ui` (General Sans). shadcn's semantic variables (`primary`, `border`, `ring`, `accent`, `destructive` and so on) point at these tokens.
  - Vitest projects `backend` (node, `tests/backend/**/*.test.ts`, files run one at a time) and `frontend` (jsdom, `tests/frontend/**/*.test.{ts,tsx}`), with `passWithNoTests` and native `resolve.tsconfigPaths`.

**How it was built, where it differs from the first draft:**
- `create-next-app@16.4.6` ran in a scratch folder and its files were copied in, because it refuses a folder that already holds `dev-docs/` and `design/`.
- The Next 16.4 template wires Tailwind through `@tailwindcss/turbopack`, so there's no `postcss.config.mjs`. It also turns on `cacheComponents` and `partialPrefetching` in `next.config.ts`.
- `shadcn init -d` chose the `base-nova` style on `@base-ui/react`, and its `cn` package replaces `clsx` and `tailwind-merge`.
- There is no smoke test. `passWithNoTests` keeps CI green until Task 3 adds real tests.
- Dropped packages: `dotenv` (use Node's `process.loadEnvFile`), `vite-tsconfig-paths` (Vite 8 does it), `@vitejs/plugin-react` (Vite 8 compiles JSX; add only if component tests need it, with the owner's OK).

**Pinned versions, checked 2026-11-10.** Installed now:

| Package | Version |
|---|---|
| next, eslint-config-next | 16.4.6 |
| react, react-dom | 19.3.1 |
| typescript | 6.0.3 (typescript-eslint supports below 6.1, so not 7.x) |
| eslint | 9.39.5 (eslint-plugin-react supports up to 9) |
| tailwindcss, @tailwindcss/turbopack | 4.3.5 |
| prettier | 3.9.10 |
| vitest | 5.1.0 |
| vite | 8.3.7 (a peer of Vitest 5) |
| @types/node | 24.19.2 |
| @types/react, @types/react-dom | 19.3.0 |
| @base-ui/react | 1.9.0 |
| class-variance-authority | 0.7.1 |
| cn | 0.5.2 |
| lucide-react | 1.70.0 |
| shadcn | 4.23.0 |
| tw-animate-css | 1.4.0 |

Install in the task that first uses them, re-checking that each version is still current:

| Package | Version | Task |
|---|---|---|
| prisma, @prisma/client, @prisma/adapter-pg | 7.10.1 (npm `latest` is an 8.0 RC, so pin 7) | 3 |
| pg, @types/pg | 8.23.1 | 3 |
| better-auth | 1.7.19 | 5 |
| server-only | 0.0.1 | 3 |
| zod | 4.6.7 | 4 |
| openai | 7.55.0 | 8 |
| @tanstack/react-query | 5.107.1 | 13 |
| msw | 3.0.4 | 12 |
| jsdom | 31.0.0 | 12 |
| @testing-library/react | 16.3.3 | 12 |
| @testing-library/user-event | 14.6.9 | 12 |
| @testing-library/jest-dom | 7.0.1 | 12 |

- [x] **Verified:** `pnpm exec prettier --check .`, `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build` all pass, and a screenshot of the production build shows the fonts and tokens rendering. `docker compose config` validates. Running the database container was not checked, because the Docker daemon (Colima) wasn't running.
- [x] **Checkpoint:** `chore: scaffold next app with tooling and tokens`

### Task 2: CI workflow ✅

**Files:**
- Created: `.github/workflows/ci.yml`

- Triggers on push and pull_request. Runs on `ubuntu-latest` with a `postgres:17` service.
- Steps: `actions/checkout@v7.0.1`, `pnpm/action-setup@v6.1.1`, `actions/setup-node@v7.1.0` (Node 24 LTS, pnpm cache), then `pnpm install --frozen-lockfile`, `typecheck`, `lint`, `test` and `build`.
- Env holds the database URLs for the service plus placeholder values for every other variable.
- Task 3 adds `pnpm prisma generate` and `prisma migrate deploy`, which fail until a schema exists.
- [ ] **Verify on first push:** the GitHub Actions run is green.
- [x] **Checkpoint:** `ci: run typecheck, lint and tests on push`

---

# Phase 2: Data, auth and validation

### Task 3: Schema, migration and database client ✅

> **As built:** Prisma 7.10.1 reads `prisma7.config.ts`, which loads `.env` with `process.loadEnvFile()`. The Better Auth CLI is `pnpm dlx auth@1.7.18 generate`, and it can't load files that import `server-only`, so remove that line for the run and restore it. Backend tests use a separate `pandoras_test` database that `tests/setup/global-db.ts` creates and migrates. `server-only` is aliased to `tests/setup/server-only.ts` in Vitest. `postinstall` runs `prisma generate`. better-auth is pinned to 1.7.18, because 1.7.19 and 1.7.20 were inside pnpm's one-day release-age window.

**Files:**
- Create: `prisma/schema.prisma`, `prisma7.config.ts`, `lib/db.ts`, `tests/setup/global-db.ts`, `tests/setup/db.ts`
- Test: `tests/backend/db.test.ts`

**Interfaces:**
- Produces:
  - `prisma` (PrismaClient) from `lib/db.ts`.
  - `resetDb(): Promise<void>` and `createUser(overrides?: Partial<{ email: string; name: string | null; favoriteMovie: string | null }>): Promise<{ id: string }>` from `tests/setup/db.ts`.

- [ ] **Step 1:** Generate the Better Auth models with `pnpm dlx @better-auth/cli generate --config lib/auth.ts`. (A minimal `lib/auth.ts` with the Prisma adapter is enough here; Task 5 completes it.) Then add the app fields and the `Fact` model exactly as in srs §4.1.
- [ ] **Step 2:** Set up the Prisma client.
  - `prisma7.config.ts`: `import "dotenv/config"`, with the datasource URL from `DIRECT_URL`.
  - `lib/db.ts`: `server-only`, one `pg.Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000 })`, then `new PrismaClient({ adapter: new PrismaPg(pool) })`, kept on `globalThis` in development.
- [ ] **Step 3:** Run `pnpm db:up && pnpm prisma migrate dev --name init`. Expected: the migration is created and the tables exist.
- [ ] **Step 4:** Write the test helpers.
  - `tests/setup/global-db.ts` runs `prisma migrate deploy` against the test database.
  - `tests/setup/db.ts` has `resetDb()`, which runs `TRUNCATE "fact", "session", "account", "verification", "user" CASCADE` (match the generated table names), and `createUser()`.
- [ ] **Step 5:** Write `db.test.ts`:
  - `creates a fact with database time`: insert a user and a fact without `createdAt`, and expect `createdAt` to be within 5 s of `SELECT now()`.
  - `deleting a user deletes their facts`: expect the fact count to be 0 after the user is deleted.
- [ ] **Step 6:** Run `pnpm test:backend tests/backend/db.test.ts`. Expected: PASS.
- [ ] **Step 7:** Checkpoint: `feat(db): add prisma schema with fact history and lease columns`

### Task 4: Movie title rule ✅

> **As built:** `MovieTitleSchema` (Zod) holds the rule and `normalizeMovie()` wraps it. Whitespace collapses **before** the control-character check, as srs §5.1 orders it, so a pasted tab or newline becomes a space. Step 3 below had the order reversed and is superseded.

**Files:**
- Create: `lib/movie.ts`
- Test: `tests/backend/movie.test.ts` (T-A8)

**Interfaces:**
- Produces:
  - `normalizeMovie(input: unknown): { ok: true; value: string; key: string } | { ok: false; message: MovieError }`
  - `MOVIE_MAX = 100`
  - `type MovieError = "Enter a movie title." | "Keep the title under 100 characters." | "Remove the hidden characters from the title."`

- [ ] **Step 1:** Write the failing tests.
  ```ts
  expect(normalizeMovie("  The   Matrix ")).toEqual({ ok: true, value: "The Matrix", key: "the matrix" });
  expect(normalizeMovie("M")).toMatchObject({ ok: true, value: "M" });
  expect(normalizeMovie("   ")).toEqual({ ok: false, message: "Enter a movie title." });
  expect(normalizeMovie("a".repeat(100))).toMatchObject({ ok: true });
  expect(normalizeMovie("a".repeat(101))).toEqual({ ok: false, message: "Keep the title under 100 characters." });
  expect(normalizeMovie("Up\u0007")).toEqual({ ok: false, message: "Remove the hidden characters from the title." });
  expect(normalizeMovie(42)).toEqual({ ok: false, message: "Enter a movie title." });
  // Review focus 2
  expect(normalizeMovie("Amélie")).toMatchObject({ ok: true, value: "Amélie", key: "amélie" });
  expect(normalizeMovie("千と千尋の神隠し")).toMatchObject({ ok: true, value: "千と千尋の神隠し" });
  ```
- [ ] **Step 2:** Run `pnpm vitest run tests/backend/movie.test.ts`. Expected: FAIL, because the module doesn't exist yet.
- [ ] **Step 3:** Implement the rule in srs §5.1. Check for control characters before collapsing whitespace, because `\s` would swallow some of them. Length is `value.length`.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat: add shared movie title validation`

### Task 5: Auth and the data access layer ✅

> **As built:** `profileToUser` returns `image: undefined` (not `null`) when there's no photo, because Better Auth's mapper type requires it. `lib/errors.ts` also exports `ERROR_STATUS` and default user-facing messages. `getCurrentUser` is wrapped in React `cache` and maps an empty stored name to `null`.

**Files:**
- Create: `lib/auth.ts`, `lib/auth-client.ts`, `lib/dal.ts`, `lib/errors.ts`, `app/api/auth/[...all]/route.ts`
- Test: `tests/backend/auth.test.ts`

**Interfaces:**
- Produces:
  - `auth` (Better Auth instance), and `profileToUser(profile: { name?: string | null; email: string; picture?: string | null }): { name: string; image: string | null }`.
  - `type CurrentUser = { id: string; name: string | null; email: string; image: string | null; favoriteMovie: string | null }`
  - `getCurrentUser(): Promise<CurrentUser | null>`, which uses `auth.api.getSession({ headers: await headers() })` and then loads the user with Prisma.
  - `requireUser(): Promise<CurrentUser>`, which throws `AppError("UNAUTHENTICATED")`.
  - `class AppError extends Error { constructor(code: ErrorCode, message?: string, issues?: Issue[]); status: number }`
  - `ErrorCode`, the union of the five codes.
  - `authClient` with `signIn.social`, `signOut`.

- [ ] **Step 1:** Write the failing tests.
  - `profileToUser keeps a real name`.
  - `profileToUser with no name stores an empty string so sign-in still succeeds` (review focus 5).
  - `AppError maps codes to statuses`: assert all 5 pairs from Global constraints.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - `lib/auth.ts`:
    - `betterAuth({ database: prismaAdapter(prisma, { provider: "postgresql" }), socialProviders: { google: { clientId, clientSecret, mapProfileToUser: profileToUser, overrideUserInfoOnSignIn: true } }, session: { cookieCache: { enabled: false } } })`
    - Check that the option names match the installed Better Auth version. FR-AUTH-7 needs the profile overwritten on each sign-in.
  - The display fallback to the email prefix lives in the UI (Task 15). Storage keeps `""`.
  - The route file exports `GET` and `POST` from `toNextJsHandler(auth)`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(auth): add better auth with google, database sessions and requireUser`

### Task 6: Contracts and the route wrapper ✅

**Files:**
- Create: `lib/contracts.ts`, `lib/http.ts`
- Test: `tests/backend/http.test.ts`

**Interfaces:**
- Produces:
  - In `lib/contracts.ts`, the Zod schemas for srs §6: `MeSchema`, `SetMovieBodySchema` (`{ movie: z.string() }`), `SetMovieResponseSchema`, `FactResponseSchema`, `ErrorBodySchema`, plus the inferred types `Me`, `FactResponse` and `FactSource`.
  - `withUser<T>(handler: (user: CurrentUser, req: Request) => Promise<T>): (req: Request) => Promise<Response>`. It returns JSON 200 with the result, `AppError` becomes `{ error: { code, message, issues? } }` with its status, and any other throw becomes logged `INTERNAL` 500 with the message "Something went wrong."

- [ ] **Step 1:** Write the failing tests.
  - `withUser returns 401 UNAUTHENTICATED when requireUser throws`: mock `@/lib/dal` and assert status 401 with body `{ error: { code: "UNAUTHENTICATED" } }`.
  - `withUser hides unexpected errors as INTERNAL`: the handler throws `new Error("db exploded")`, and the body message must not contain "db exploded".
  - `withUser passes AppError issues through for VALIDATION_ERROR`.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(api): add shared contracts and route error wrapper`

---

# Phase 3: Variant A, the fact service and API

### Task 7: `/api/me` and `/api/me/movie` ✅

> **As built:** Request validation lives in `parseBody(request, schema)` in `lib/http.ts`. It turns bad JSON or a Zod miss into `VALIDATION_ERROR` with field issues. So `setFavoriteMovie(userId, movie: string): Promise<string>` takes an already-normalized title.

**Files:**
- Create: `app/api/me/route.ts`, `app/api/me/movie/route.ts`, `lib/users.ts`
- Test: `tests/backend/me-routes.test.ts`

**Interfaces:**
- Consumes: `withUser`, `normalizeMovie`, `prisma`.
- Produces: `setFavoriteMovie(userId: string, input: unknown): Promise<string>`, which throws `AppError("VALIDATION_ERROR", message, [{ path: ["movie"], message }])`.

- [ ] **Step 1:** Write the failing tests. Mock `getCurrentUser` to return a seeded user, or null for the 401 cases.
  - `GET /api/me returns the profile`
  - `GET /api/me without session is 401`
  - `PUT /api/me/movie saves the normalized title`: send `"  inception "` and expect `{ favoriteMovie: "inception" }` and the database row updated.
  - `PUT /api/me/movie rejects an empty title with VALIDATION_ERROR and issues`
  - `PUT /api/me/movie ignores any userId in the body`: send `{ movie: "Up", userId: other.id }` and assert the other user is unchanged.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(api): add me and movie endpoints`

### Task 8: The OpenAI call ✅

> **As built:** `openai` is pinned to 7.54.0 (7.55.0 was inside pnpm's one-day window). `reasoning.effort` is `"none"` because `gpt-5.4-mini` doesn't accept `"minimal"` (ADR-033). The client is created on first use so imports never need the key. Output passes a Zod check (trimmed, 1 to 600 characters). The format example in the instructions is the neutral `Title (Year):`.

**Files:**
- Create: `lib/openai.ts`
- Test: `tests/backend/openai.test.ts`

**Interfaces:**
- Produces:
  - `generateFact(input: { movieTitle: string; previousFact?: string }): Promise<string>`, which throws `FactGenerationError` on an SDK error, a timeout, `status !== "completed"` or empty text.
  - `class FactGenerationError extends Error`.

- [ ] **Step 1:** Write the failing tests, mocking `openai` so `responses.create` is a `vi.fn`.
  - `sends the title as quoted data, not instructions`: `input` contains `"""Inception"""` and `instructions` doesn't contain "Inception".
  - `includes the previous fact when given`.
  - `uses model from OPENAI_MODEL and output cap 150`.
  - `throws FactGenerationError on incomplete or blank output`.
  - `client is built with timeout 8000 and maxRetries 0`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `server-only`, one module-level `new OpenAI({ timeout: 8000, maxRetries: 0 })`, and `responses.create({ model, instructions, input, max_output_tokens: 150, reasoning: { effort: "none" } })`.
  - Return `output_text.trim()`.
  - The `instructions` text is the FR-FACT-2 rule list, written as plain sentences.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(ai): add server-only fact generation with timeout and prompt rules`

### Task 9: `getFact`, the cache path ✅

> **As built:** `tests/setup/db.ts` gained `insertFact(userId, { movieTitle, text, ageSeconds })`, which backdates using the database clock.

**Files:**
- Create: `lib/facts.ts`
- Test: `tests/backend/facts-cache.test.ts` (T-A1, T-A2, T-A3)

**Interfaces:**
- Consumes: `prisma`, `normalizeMovie`, `generateFact` (mocked in tests with `vi.mock("@/lib/openai")`).
- Produces:
  - `getFact(userId: string): Promise<FactResponse>`
  - The exported constants `CACHE_WINDOW_SECONDS = 60`, `LEASE_SECONDS = 15`, `POLL_INTERVAL_MS = 500`, `POLL_TIMEOUT_MS = 9000`.
  - The internal `findFreshFact(userId, movieKey)` returns the fact plus `secondsUntilRefresh`, computed in SQL as `GREATEST(0, CEIL(60 - EXTRACT(EPOCH FROM now() - "createdAt")))::int`.

- [ ] **Step 1:** Write the failing tests. Seed the user with `favoriteMovie: "Inception"`. Insert facts with raw SQL to backdate them (`now() - interval '10 seconds'`).
  - `T-A1 returns a fact under 60 s old as cache without calling OpenAI`: `source === "cache"`, the generator is called 0 times, and `secondsUntilRefresh` is between 49 and 50.
  - `T-A2 generates when the newest fact is 61 s old`: `source === "generated"`, the generator is called once, and the fact count is 2.
  - `T-A3 a fresh fact for another movie does not count`: a fresh fact for "Up" while the movie is "Inception" gives `generated`.
  - `T-A3 a case-only change still hits the cache`: the fact's key is `inception`, the movie is "INCEPTION", and the result is `cache`.
  - `throws ONBOARDING_REQUIRED when the user has no movie`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement steps 1, 2 and 4 of the arch §7 algorithm, skipping the lease for now (Task 10 adds it). Insert with `movieTitle` set to the user's saved title and `movieKey` from `normalizeMovie`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(facts): serve facts from a 60 second database window`

### Task 10: Lease and concurrency ✅

> **As built:** Before the lease existed, the five-request test failed with several OpenAI calls, which confirmed the race was real. The waiting loop's 9 second deadline uses the app clock, which is fine because it only limits waiting. The window and the lease expiry use Postgres `now()`.

**Files:**
- Modify: `lib/facts.ts`
- Test: `tests/backend/facts-lease.test.ts` (T-A4, T-A5)

**Interfaces:**
- Produces, exported for tests:
  - `claimLease(userId: string): Promise<string | null>`, which returns the token or null.
  - `releaseLease(userId: string, token: string): Promise<void>`.

- [ ] **Step 1:** Write the failing tests. The mocked generator waits 300 ms and then returns `"fact-" + callCount`.
  - `T-A4 five parallel calls make exactly one OpenAI call`: `await Promise.all` of 5 `getFact` calls, then expect 1 generator call, all five texts equal, and sources containing exactly one `generated` with the rest `shared` or `cache`.
  - `T-A5 an expired lease can be reclaimed`: set `factLeaseUntil = now() - interval '1 second'`, then `claimLease` returns a token.
  - `T-A5 releasing with a stale token keeps the newer lease`: claim (t1), expire it, claim (t2), `releaseLease(t1)`, then the row still holds t2.
  - `a live lease blocks a second claim`: a second `claimLease` returns null.
  - `generates for a new movie after an in-flight generation for the old one finishes` (review focus 1):
    - Start `getFact` with the movie "Up", using a generator that takes 400 ms.
    - Change the movie to "Heat" through `setFavoriteMovie`.
    - Call `getFact` again.
    - The second call returns `generated` with `movieTitle: "Heat"` in under 2 s, and the generator is called twice.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement arch §7 steps 3 to 5, using raw SQL for the claim and release exactly as written there. In the waiting loop, each iteration does a fresh check first, then tries `claimLease`. If it wins, it continues as the holder (this is the review focus 1 fix). Release happens in `finally`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(facts): add lease so concurrent requests share one generation`

### Task 11: Fallback, the fact route and authorization ✅

> **As built:** The 401 test runs the real `withUser` → `requireUser` → Better Auth chain, with only `next/headers` stubbed to a request without a cookie. Only `FactGenerationError` triggers the fallback; any other error surfaces as `INTERNAL`.

**Files:**
- Modify: `lib/facts.ts`
- Create: `app/api/fact/route.ts` (`export const maxDuration = 15`)
- Test: `tests/backend/facts-fallback.test.ts` (T-A6), `tests/backend/authorization.test.ts` (T-A7)

- [ ] **Step 1:** Write the failing tests.
  - `T-A6 falls back to the last fact when OpenAI fails`: an old fact exists and the generator throws, so the result is `source: "fallback"` with `secondsUntilRefresh: 0`, the old text, and the lease released.
  - `T-A6 FACT_UNAVAILABLE when OpenAI fails and there is no fact`: rejects with `AppError` code `FACT_UNAVAILABLE`, and the lease is released.
  - `empty output is a failure and is not stored` (review focus 3): the generator throws `FactGenerationError`, so the fact count is unchanged.
  - `T-A7 getFact never returns another user's fact`: A and B both have the movie "Inception", A has a fresh fact, and `getFact(B)` returns `generated` with B's own text.
  - `T-A7 every endpoint is 401 without a session`: call the `GET` handlers of `/api/me` and `/api/fact` and the `PUT` of `/api/me/movie` with a plain `Request` that has no cookie. Expect 401 for each.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement FR-FAIL-1 to FR-FAIL-3. Log with `console.error("fact generation failed", { userId, name: err.name, message: err.message })`. The route is `withUser((user) => getFact(user.id))`.
- [ ] **Step 4:** Run `pnpm test:backend`. Expected: every backend test passes.
- [ ] **Step 5:** Checkpoint: `feat(facts): fall back to last fact on failure and expose GET /api/fact`

---

# Phase 4: Variant B and the UI

### Task 12: Typed API client

**Files:**
- Create: `lib/api.ts`, `tests/setup/frontend.ts` (jest-dom, the MSW `setupServer`, reset handlers after each test)
- Test: `tests/frontend/api.test.ts` (T-B1, T-B2)

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number; code: ErrorCode; issues?: Issue[] }`
  - `api.getMe(): Promise<Me>`, `api.setMovie(movie: string): Promise<{ favoriteMovie: string }>`, `api.getFact(): Promise<FactResponse>`
  - `isUnauthenticated(e: unknown): boolean`

- [ ] **Step 1:** Write the failing tests with MSW handlers.
  - `T-B1 401 becomes ApiError UNAUTHENTICATED`.
  - `T-B2 500 becomes ApiError INTERNAL with the server message`.
  - `T-B2 a network failure becomes status 0 INTERNAL`: use `HttpResponse.error()`.
  - `a 200 body that fails the schema becomes INTERNAL`.
  - `VALIDATION_ERROR keeps issues`.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement FR-API-4. **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(client): add typed api client with normalized errors`

### Task 13: Query layer and providers

**Files:**
- Create: `lib/queries.ts`, `components/providers.tsx`
- Modify: `app/layout.tsx`
- Test: `tests/frontend/providers.test.tsx`

**Interfaces:**
- Produces:
  - `queryKeys = { me: ["me"], fact: (movieKey: string) => ["fact", movieKey] }`
  - `useMe(initial: Me)` (`initialData`, `staleTime: 30_000`)
  - `useFact(movieKey: string)` (`staleTime: 30_000`, no retry on 4xx)
  - `useSetMovie()`, the optimistic mutation that follows the arch §8 recipe. Its `onSuccess` updates `["me"]` and invalidates `["fact"]`.
  - `<Providers>`, whose `QueryCache` and `MutationCache` `onError` call `window.location.assign("/")` when `isUnauthenticated(error)`.

- [ ] **Step 1:** Write the failing tests.
  - `a 401 from any query sends the user to /` (review focus 4): stub `window.location.assign`, render a component using `useFact` with MSW returning 401, and expect the stub to be called with `"/"`.
  - `a fact fetched under 30 s ago is reused on remount` (FR-CLIENT-2): mount, unmount and remount `useFact` within 30 s using fake timers. The MSW handler is called once.
- [ ] **Step 2:** Run them. Expected: FAIL. **Step 3:** Implement it, and wrap `app/layout.tsx` children in `<Providers>`. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(client): add query hooks, providers and 401 redirect`

### Task 14: UI kit from Cult UI and the icons

**Files:**
- Create: `components/ui/*` (from the shadcn CLI), `components/icons.tsx`, `components/sticker.tsx`
- Test: `tests/frontend/ui.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ variant: "solid" | "outline", size?: "sm" | "md" })`
  - `Field({ label, help?, error?, ...inputProps })`, which wires `aria-describedby` and `aria-invalid`
  - `Badge`, `Toast` (the `useToast().show(message)` API), `Avatar({ src, name })`, `CutoutCard`, `RollingNumber({ value })`
  - `Icon({ name: IconName })` for the 16 names in `design/icons/`
  - `Sticker({ color, rotate, icon })`

- [ ] **Step 1:** Run `pnpm dlx shadcn@latest add @cult-ui/halo-button @cult-ui/halo-field @cult-ui/halo-badge @cult-ui/halo-toast @cult-ui/collab-avatar @cult-ui/cutout-card @cult-ui/morph-surface @cult-ui/rolling-number`.
- [ ] **Step 2:** Restyle each component to DESIGN.md:
  - Pills (`rounded-pill`) and 1px carbon borders.
  - Solid buttons are carbon with paper text. Outline buttons are paper with carbon text.
  - No shadows, gradients or halo glows. Remove those effects from the Cult UI source.
  - Disabled is mist.
  - The press state is `active:scale-[.97]`.
  - Match the mockup's computed values in `design/mocks/styles.css`.
- [ ] **Step 3:** Build `components/icons.tsx` from the SVG path data in `design/icons/*.svg`, with stroke `currentColor` and a default size of `1.15em`.
- [ ] **Step 4:** Write the tests and run them.
  - `Field links its error with aria-describedby and sets aria-invalid`.
  - `Avatar shows initials when src is missing and when the image errors` (FR-DASH-3): fire `error` on the img.

  Expected: PASS.
- [ ] **Step 5:** Checkpoint: `feat(ui): add design system components restyled from cult ui`

### Task 15: Landing, onboarding and page guards

**Files:**
- Create: `app/page.tsx`, `app/onboarding/page.tsx`, `components/landing/hero.tsx`, `components/landing/marquee.tsx`, `components/landing/ribbon.tsx`, `components/onboarding-form.tsx`, `lib/display.ts`
- Test: `tests/frontend/onboarding.test.tsx`

**Interfaces:**
- Produces:
  - `displayName(user: { name: string | null; email: string }): string`, which falls back to the email prefix (FR-DASH-2).
  - `initials(name: string): string`, at most 2 letters.
  - `<OnboardingForm />`, which calls `api.setMovie` and then `router.replace("/dashboard")`.

- [ ] **Step 1:** Write the failing tests.
  - `displayName falls back to the email prefix when name is empty`.
  - `onboarding shows the server validation message and stays put`: MSW returns 400 with issues, so the message appears with `role="alert"` and there is no navigation.
  - `onboarding saves and goes to the dashboard`.
  - `submit is disabled while saving`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - The pages are Server Components calling `getCurrentUser()` and applying the arch §5 guard table with `redirect()`.
  - The landing matches the mockup: marquee, wordmark, ribbon SVG, stickers, tagline, and a "Sign in with Google" button calling `authClient.signIn.social({ provider: "google", callbackURL: "/" })`.
  - The marquee animation stops under reduced motion.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then check by hand with `pnpm dev`: the landing at 1440px and 400px wide looks like the mockup.
- [ ] **Step 5:** Checkpoint: `feat: add landing and onboarding with session-based routing`

### Task 16: Dashboard with inline edit, fact ticket and countdown

**Files:**
- Create: `app/dashboard/page.tsx`, `components/dashboard/dashboard.tsx`, `components/dashboard/profile-pill.tsx`, `components/dashboard/movie-editor.tsx`, `components/dashboard/fact-ticket.tsx`, `components/dashboard/new-fact-button.tsx`, `lib/countdown.ts`
- Test: `tests/frontend/movie-editor.test.tsx` (T-B3, T-B5), `tests/frontend/fact-ticket.test.tsx` (T-B4)

**Interfaces:**
- Consumes: `useMe`, `useFact`, `useSetMovie`, the UI kit, `displayName`, `authClient.signOut`.
- Produces:
  - `useCountdown(seconds: number, receivedAt: number): number`, which ticks every second down to 0.
  - `<Dashboard initialMe={Me} />`.

- [ ] **Step 1:** Write the failing tests. Render `<Dashboard>` inside a fresh `QueryClient` with MSW.
  - `T-B3 save shows the new title immediately`: type "Heat" and click Save, then expect the heading to read "Heat" before the PUT resolves (delay the handler 200 ms).
  - `T-B3 a failed save restores the old title and shows the toast`: PUT returns 500, then the heading reads "Inception" and the toast reads: Couldn't save "Heat". Your favorite is still Inception.
  - `T-B4 a successful save refetches the fact for the new movie`: the GET `/api/fact` handler is called again, and the ticket shows the Heat fact.
  - `T-B5 cancel restores the view and returns focus to Edit`.
  - `T-B5 an invalid title shows the message and sends nothing`: the PUT handler is not called.
  - `a capitalization-only edit keeps the current fact` (FR-EDIT-7): save "INCEPTION", the PUT runs, and the fact endpoint isn't called again.
  - `the New fact button counts down from secondsUntilRefresh and enables at 0`: use fake timers. With 3 s, it reads "New fact in 3s" and is disabled, then after 3 s it reads "New fact" and is enabled.
  - `fallback shows the stale notice; 503 shows Try again and hides New fact`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement to match the mockup's dashboard.
  - The Server Component gets the user, applies the guard, and passes `initialMe`.
  - `MovieEditor` uses `morph-surface` for view and edit, with Escape to cancel. Save is disabled while pending.
  - `FactTicket` uses `cutout-card` with the stub. Its states are skeleton, fact, stale notice and error panel. It is `aria-live="polite"` and sets `aria-busy`. The print reveal stops under reduced motion.
  - `NewFactButton` uses `RollingNumber` for the seconds.
  - Logout calls `authClient.signOut()` and then `window.location.assign("/")`.
- [ ] **Step 4:** Run `pnpm test`. Expected: every test passes.
- [ ] **Step 5:** Check the full flow by hand with real keys in `.env.local`: sign in, onboard, see a fact, refresh within 60 s to get the same fact, edit the movie, and log out.
- [ ] **Step 6:** Checkpoint: `feat(dashboard): add inline movie edit, fact ticket and countdown`

---

# Phase 5: Deploy and bug squash

### Task 17: Deploy to Vercel with Supabase

The owner does the account steps, and the agent prepares the commands and checks.

- [ ] **Step 1 (owner):**
  - Create the Supabase project. Copy the pooled connection string into `DATABASE_URL` and the direct one into `DIRECT_URL`.
  - Create a Google OAuth client with the redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<vercel-domain>/api/auth/callback/google`.
  - Create the OpenAI key.
- [ ] **Step 2:** Run `DIRECT_URL=<supabase direct> pnpm prisma migrate deploy`. Expected: "All migrations have been successfully applied."
- [ ] **Step 3 (owner):** Import the GitHub repo into Vercel, set every variable from `.env.example` for Production, with `BETTER_AUTH_URL` set to the Vercel domain, and deploy.
- [ ] **Step 4:** Smoke test production against srs §3: every FR-AUTH, FR-ONB, FR-DASH and FR-EDIT item, plus two tabs refreshing at once. Check in Supabase that only one new `fact` row appears.
- [ ] **Step 5:** Checkpoint: `chore: production deploy configuration`

### Task 18: Bug squash

- [ ] **Step 1:** Run `pnpm build && pnpm test` and the production smoke test again. Log each defect with its srs ID.
- [ ] **Step 2:** For each defect, use superpowers:systematic-debugging. Write a failing test first, fix the root cause, then rerun the full suite.
- [ ] **Step 3:** Run the srs §11 traceability table as a final checklist, ticking each row in production.
- [ ] **Step 4:** Checkpoint: `fix: <defect>`, one per fix.

---

# Phase 6: Documentation and demo

### Task 19: README and AI usage note

- [ ] **Step 1:** Expand `README.md` to cover DOC-1 to DOC-8:
  - setup (`pnpm i`, `pnpm db:up`, copy `.env.example`, `pnpm db:migrate`, `pnpm dev`)
  - the environment variable table
  - migration steps for local and production
  - a 1 to 2 page architecture overview condensed from architecture.md, with its diagrams
  - the variant choice
  - the tradeoffs, including D18
  - "With 2 more hours": a per-user generation rate limit, a TMDB lookup for ambiguous titles, Playwright end-to-end tests with a seeded session, and fact streaming
  - an "AI usage" bullet section
- [ ] **Step 2:** Run the project's humanizer rules over the README and check for dashes: `grep -c "[–—]" README.md` should print 0.
- [ ] **Step 3:** Checkpoint: `docs: complete readme with setup, architecture and tradeoffs`

### Task 20: Walkthrough video

- [ ] **Step 1:** Write `dev-docs/video-script.md`, a 3 to 5 minute script:
  - demo the flow (45 s)
  - the schema and why facts are history (45 s)
  - the lease, the two-tab test and why not the other options (75 s)
  - the failure fallback (30 s)
  - the client cache, countdown and optimistic edit (45 s)
  - tradeoffs and next steps (30 s)
- [ ] **Step 2 (owner):** Record the video and link it in the README.
- [ ] **Step 3:** Checkpoint: `docs: add walkthrough video script and link`

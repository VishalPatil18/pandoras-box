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

---

## 2026-11-10: Client orchestration and app UI (plan Tasks 12 to 16, Variant B)

### What exists

- **Pages:** `/` (landing: marquee, wordmark over the ribbon, stickers, Google sign-in), `/onboarding` (movie form) and `/dashboard` (profile pill, logout, inline movie editor, fact ticket, New fact countdown). Each page is a server component that calls `getCurrentUser()` and redirects per the guard table.
- **`lib/api.ts`:** `api.getMe`, `api.setMovie` and `api.getFact`. Every failure, network included, becomes one `ApiError { status, code, message, issues? }`.
- **`lib/queries.ts`:** `useMe` (seeded from the server), `useFact(key, { enabled })` with a 30 second `staleTime`, and `useSetMovie` (optimistic, rolls back on error, invalidates facts only when the movie key changes).
- **`components/providers.tsx`:** the QueryClient. Any 401 from a query or mutation sends the browser to `/` with a full page load.
- **UI kit:** `components/ui/{button,field,avatar,rolling-number,badge,toast}.tsx`, `components/icons.tsx` (16 Rune icons) and `components/sticker.tsx`.
- **Tests:** 76 in total, 29 frontend: the API client, providers, UI kit, onboarding, inline edit and fact ticket.

### How it works

- **Fact query key:** `["fact", movieKey]`. While a save is in flight the query is paused, and the ticket shows its skeleton. After success the new key fetches on its own. After failure the old title and its cached fact come back.
- **The New fact button** counts down `secondsUntilRefresh` from the moment the response arrived (`dataUpdatedAt`), then calls `refetch()`.
- **Sign-in** is `authClient.signIn.social({ provider: "google", callbackURL: "/" })`. The landing page then routes to onboarding or the dashboard.
- **Logout** calls `authClient.signOut()`, then does a full page load to `/`.

### Locked in

- ADR-034: Cult UI is used only for `rolling-number` and the adapted avatar.
- Pinned: `@tanstack/react-query` 5.107.1, `motion` 14.11.1, `msw` 3.0.4, `jsdom` 31.0.0, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.8 (14.6.9 was inside pnpm's one-day window), `@testing-library/jest-dom` 7.0.1.

---

## 2026-11-10: Owner design review (ADR-035)

- **Landing (`components/landing/hero.tsx`):** a full-viewport rounded frame (`h-dvh overflow-hidden`) with `public/landing-bg.jpg` loaded through `next/image` (static import, blur placeholder). On top: the white wordmark over `Ribbon` with two stickers, the tagline, `SignInButton` (Gochi Hand label) at the top right, and a footer. Footer links: the `SignInLink` sign-in action, Docs (README), Changelog and Github on the GitHub repo, and "Vishal" linked to https://vishalpatil.tech/. `marquee.tsx` is deleted.
- **Dashboard and onboarding:** a centered 1200px column (`max-w-[1200px] mx-auto` with responsive padding) inside full-width color bands, and a text wordmark instead of the box icon.
- **`ProfilePill`:** owns logout now. Avatar, name and truncated email sit on the left; Log out sits on the right behind a hairline divider. On phones it shows only the avatar and the icon, which keeps `aria-label="Log out"`.
- **Checked:** 76 tests, type check, lint and build pass. Screenshots of the landing page at 1440, 1280x640 and 600, and of the dashboard and onboarding at 1440 and 390.
- **Later the same day (ADR-036):**
  - **Landing:** full bleed, with no frame or rounded corners.
  - **`Ribbon`:** a client component. A full-width Ember strip whose path `d` morphs with `motion` (7 second mirrored loop) unless the user prefers reduced motion.
  - **Stickers:** they use `animate-float` from `globals.css`.
  - **Sign in label:** General Sans bold. Gochi Hand is removed from the layout.

---

## 2026-11-10: Toasts and ticket polish (ADR-037)

- **Toasts:** `lib/notify.ts` wraps notch-toast (5 second duration, the `FACT_TOAST` id for the generation cycle). `components/flash-toast.tsx` reads the `?toast=` keys `signed-in`, `signed-out`, `onboarded` and `session-expired`. `goToLanding(flash?)` passes a key through a full page load.
- **Ticket:** while a fact is generating, the whole ticket animates. Its new details are an inner keyline, a "Title, Year" heading split from the fact text, a meta row pinned to the bottom, and a stub barcode.
- **Tests:** 77 passing. The frontend setup stubs `notch-toast` (renderer and toast spies) and `next/navigation` globally.
- **Verified live:** a dashboard visit with no stored fact made a real OpenAI call and showed the result with the "New fact ready." toast.

---

## 2026-11-10: Security audit and fixes (plan Task 18, before deploy)

### What exists

- **`dev-docs/security-audit.md`:** the full report. Seven findings, the fixes, what was checked and found safe, and the deploy-time checks.
- **Generation cap (`lib/facts.ts`):** `GENERATION_LIMIT` 20 per `GENERATION_WINDOW_SECONDS` 600, counted across all movies under the lease. Over the cap it serves `fallback`, or `RATE_LIMITED` (429) when the movie has no fact yet.
- **Migration `20261110200000_enable_rls`:** RLS on `user`, `session`, `account`, `verification`, `fact` and `_prisma_migrations`, with no policies.
- **`next.config.ts`:** `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff` and `strict-origin-when-cross-origin` on every route.
- **`docker-compose.yml`:** Postgres binds to `127.0.0.1:5433` only.
- **CI:** `permissions: contents: read`.
- **Tests:** 81 passing. New: T-A9 (the cap) and T-A10 (RLS on every table).

### Locked in

- ADR-042 replaces D18: the per-user cap is in, and the OpenAI budget limit is the backstop.
- ADR-043: every new table gets RLS in its migration.
- The order changed: the security fixes land before the first deploy, so production starts with RLS on.

---

## 2026-11-10: Documentation, video script and logo (plan Tasks 19 and 20)

### What exists

- **`README.md`:** rewritten for the finished app. Setup, env vars, local and production migrations, scripts, a condensed architecture with the system and lease diagrams, the variant choice, tradeoffs, "With 2 more hours", AI usage, and credits.
- **`dev-docs/video-script.md`:** a 4 minute 30 second script in six timed segments, with a pre-recording checklist.
- **Logo (ADR-044):** `design/logo/pandoras-box.svg` is the master: an isometric open carton with a sunset movie window. `app/icon.svg` is the favicon variant. `app/apple-icon.png` is 180px on Sky Wash. Next's file conventions add the `<link>` tags, so `layout.tsx` is unchanged.
- **`design/DESIGN.md`:** the Logo Mark section describes this logo, its sampled colors, its files and its usage rules.

### Locked in

- Logo colors are sampled from the hero image: `#173A8C`, `#2346A0`, `#355BC2`, with `#0E2463` for the inside of the box.
- Below 48px, use the favicon variant.
- Still owed by the owner: record the video, and add its link and the live URL to the README (there's a comment marking the spot).

---

## 2026-11-10: Docs page and diagrams (ADR-045)

### What exists

- **`/docs`** (`app/docs/page.tsx`): a public page. Logo and title, the walkthrough video (`WALKTHROUGH_VIDEO_ID`, `null` for now, which shows a placeholder), then a long article with a sticky "On this page" pane from `lg` up and a collapsible list below it. Text is justified with hyphenation in the 1200px column.
- **`components/docs/content.tsx`:** 15 sections. Overview, why, architecture, stack, data model, sign-in, getting a fact, failures, the browser side, every decision, security, testing, design, known limits, next steps. Exports `SECTIONS`, `DocsContent` and `Walkthrough`.
- **`components/docs/decisions.tsx`:** all 45 decisions (D1 to D30, ADR-031 to 045) as typed data, rendered with what was considered, what was chosen and why.
- **`components/docs/diagrams.tsx`:** nine inline SVG diagrams: system architecture, request path, data model, sign-in, the getFact flow, two tabs, lease alternatives, cache layers and the movie edit.
- **`dev-docs/diagrams/*.svg`:** standalone exports, embedded by `README.md` and `dev-docs/architecture.md`. Both docs no longer use Mermaid.
- **`components/docs/on-this-page.tsx`:** a client component that marks the section whose top has passed 120px.
- **Footer:** the landing page's Docs link opens `/docs`. `REPO_URL` is exported from `hero.tsx`.
- **Tests:** 93. New: the 9 diagram export checks, and 3 docs page tests.

### Locked in

- Change a diagram, then run `pnpm docs:diagrams`. A plain `pnpm test` fails while a file is stale.
- A new ADR goes in both `design-decisions.md` and `components/docs/decisions.tsx`.
- The owner pastes the YouTube video ID into `WALKTHROUGH_VIDEO_ID` once the video is uploaded.

---

## 2026-11-10: Walkthrough video

### What exists

- **The video:** https://youtu.be/hk047uCOHls, 5:26. Narration follows `dev-docs/video-script.md`.
- **`video/`:** a separate Remotion project that builds it. Real app recordings with a drawn cursor, code excerpts read from the repo, narration from Fish Audio, captions, and a looping piano bed. `video/README.md` covers how to regenerate each part.
- **`/docs`:** `WALKTHROUGH_VIDEO_ID` is set, so the page embeds the video instead of the placeholder.
- **README:** the thumbnail is `dev-docs/walkthrough-thumbnail.jpg`, a frame from the render, linking to YouTube.

### Locked in

- The root `tsconfig.json`, ESLint config and `.prettierignore` exclude `video/`. It has its own dependencies and tooling.
- The music file is gitignored (`video/public/music/`); its license doesn't allow redistributing it.


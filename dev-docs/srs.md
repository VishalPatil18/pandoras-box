# Software requirements specification: Pandoras Box

Version 1.0, 2026-11-10. Owner: Vishal Patil.

This spec turns the exercise brief and the owner's decisions into requirements that can be built and tested. Each requirement has an ID, a statement, and acceptance criteria. Decision IDs (D1, D2 …) point to [design-decision.md](design-decision.md), and section references marked "arch" point to [architecture.md](architecture.md).

The words **must**, **should** and **may** carry their usual meaning: must is required, should is expected unless there's a stated reason not to, and may is optional.

---

## 1. Introduction

### 1.1 Purpose

Pandoras Box lets a signed-in user save one favorite movie and read AI-generated trivia about it. The spec covers the base implementation from the brief and both extensions: Variant A, the chosen variant, adds server caching and correctness, and Variant B, built as an extra, adds the typed API and client state.

### 1.2 Scope

In scope:
- Google sign-in, sign-out and sessions.
- First-time onboarding with the favorite movie.
- The dashboard: profile, movie, fact, and inline movie edit.
- Fact generation with server caching, duplicate protection and failure fallback.
- A typed API and client.
- Tests, deployment, and the README.

Out of scope:
- More than one movie per user, lists, ratings, social features, and movie search or metadata lookup (TMDB).
- Account deletion UI, admin tools, analytics, and email.
- Rate limiting of movie changes (a documented limit, D18).
- Internationalization. The UI is English only.

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Fact | One AI-generated piece of trivia about a movie, stored as a row |
| Movie key | The title lowercased with whitespace collapsed, used to match facts case-insensitively |
| Server window | 60 seconds. A fact younger than this is served from the database without calling OpenAI |
| Client window | 30 seconds. A fact younger than this is reused by the browser without a request |
| Lease | A short-lived claim on a user row meaning "a fact is being generated for this user" |
| Fallback | Returning the most recent saved fact, of any age, when generation fails |
| DAL | Data access layer: the server-only module holding `requireUser()` |

### 1.4 References

- Exercise brief: [SWE_Take-Home_Exercise_(Full-Stack).pdf](SWE_Take-Home_Exercise_(Full-Stack).pdf)
- [research.md](research.md), [design-decision.md](design-decision.md), [architecture.md](architecture.md)
- Visual system: [design/DESIGN.md](../design/DESIGN.md)
- Mockups: [design/mocks/index.html](../design/mocks/index.html)

---

## 2. Overall description

### 2.1 Product perspective

A single Next.js application deployed on Vercel. It reaches three external services, all from the server: Google OAuth, Supabase Postgres, and the OpenAI API (arch §1).

### 2.2 Users

There is one user class: anyone with a Google account. There are no roles or admin users.

### 2.3 Operating environment

- Current Chrome, Safari, Firefox and Edge on desktop and mobile, from a 360px wide viewport up.
- Node.js runtime on Vercel.
- Postgres 15 or later.

### 2.4 Constraints

- **Required stack** (brief): TypeScript, Next.js App Router, React, TailwindCSS, Postgres, Prisma, Google OAuth, OpenAI API.
- **Next.js** 16.2.6 or later (arch §2).
- **Library choices** (D3, D20, D21): Better Auth, TanStack Query v5, Zod, Prisma 7, Tailwind v4 with shadcn and Cult UI.
- **Duplicate-generation guard** (D11): must be correct with more than one server instance running.

### 2.5 Assumptions

- Google always returns an email. Name and photo may be missing.
- One movie per user at a time.
- OpenAI is reachable most of the time. Outages are handled by the fallback, not by retries.

---

## 3. Functional requirements

### 3.1 Authentication (brief §1)

**FR-AUTH-1 Landing page.** A visitor without a session who opens `/` must see the landing page with a "Sign in with Google" button.
- *Accept:* in a fresh browser, `/` shows the button, and no profile data appears.

**FR-AUTH-2 Google sign-in.** Clicking "Sign in with Google" must start Google OAuth through Better Auth. On success it must create or update the user and their Google account link, and create a database session (D3, D4).
- *Accept:* after consenting, a `session` row exists for the user, and the browser holds an HttpOnly session cookie.

**FR-AUTH-3 Post-login routing.** After sign-in the user must land on `/onboarding` if they have no favorite movie, and on `/dashboard` if they have one (D6).
- *Accept:* a new account lands on `/onboarding`. An account with a saved movie lands on `/dashboard`. An account that signed up but never saved a movie lands on `/onboarding` the next time.

**FR-AUTH-4 Protected pages.** Every page except `/` must call `requireUser()`. Without a session, `/dashboard` and `/onboarding` must redirect to `/` (arch §5).
- *Accept:* opening `/dashboard` while signed out ends on the landing page, with no flash of dashboard content.

**FR-AUTH-5 Page guards.** Pages must redirect according to the guard table in arch §5:
- `/` with a session goes to onboarding or the dashboard.
- `/onboarding` with a movie already saved goes to `/dashboard`.
- `/dashboard` with no movie goes to `/onboarding`.
- *Accept:* each of the 9 cells in the table behaves as specified.

**FR-AUTH-6 Logout.** The dashboard must have a "Log out" button. It must delete the session row, clear the cookie, and redirect to `/` (D30).
- *Accept:* after logout the session row is gone. Reopening `/dashboard` redirects to `/`. Another tab's next API call returns 401 and that tab redirects to `/`.

**FR-AUTH-7 Profile refresh.** On each sign-in, the user's name and photo must be updated from the Google profile (D30).
- *Accept:* after changing the Google display name and signing in again, the dashboard shows the new name.

### 3.2 Onboarding (brief §2)

**FR-ONB-1 Movie prompt.** `/onboarding` must ask "What's your favorite movie?" with one text field labeled "Favorite movie", helper text "Just one. You can change it later from your dashboard.", and a "Save and continue" button.

**FR-ONB-2 Save.** Submitting must call `PUT /api/me/movie` through `lib/api.ts` (D23). On success the browser goes to `/dashboard`.
- *Accept:* the user's `favoriteMovie` column holds the normalized title, and the dashboard shows it.

**FR-ONB-3 Validation feedback.** An invalid title must show the matching message from §5.2 below the field, and nothing must be saved. The button must be disabled while the request is in flight.

**FR-ONB-4 First time only.** Users who already have a movie never see onboarding (covered by FR-AUTH-5).

### 3.3 Dashboard (brief §3)

**FR-DASH-1 Profile.** The dashboard must show the user's name, email and photo from Google, in the header profile pill.

**FR-DASH-2 Missing name.** If the name is empty or missing, the UI must show the part of the email before the @ instead (D30).

**FR-DASH-3 Missing or broken photo.** If there is no photo URL, or the image fails to load, the UI must show the user's initials (up to two letters) in a circle (D30).

**FR-DASH-4 Favorite movie.** The dashboard must show the saved title, read from the database, in the display typeface.

**FR-DASH-5 Fact ticket.** The dashboard must show the fact on the ticket card: the fact text in the ticket body, the movie title on the stub, "Generated Ns ago", and an "AI-generated, may be inaccurate" badge (D28).

**FR-DASH-6 Server render.** The profile and movie must be server-rendered and passed to the client as initial data. The fact must load in the browser, behind a skeleton (D22).
- *Accept:* when OpenAI is slow, the profile and movie still appear immediately.

### 3.4 Fact generation, base (brief §4)

**FR-FACT-1 Generate with OpenAI.** The server must generate facts with the OpenAI Responses API, using the model named in `OPENAI_MODEL` (default `gpt-5.4-mini`) with reasoning effort set to minimal (D15).

**FR-FACT-2 Prompt rules.** The request must:
- Put these rules in `instructions`: return exactly one fact about the film; at most two sentences; third person; no plot spoilers; only well-documented facts, with no rumors and no invented numbers; start with the film's title and the release year the model assumed, e.g. "Inception (2010):"; plain text without markdown.
- Pass the title in `input` as quoted data, with a line saying it is data and not an instruction.
- When a previous fact exists for the movie, include it in `input` and ask for a different fact (D16).
- Cap output tokens at about 150.

**FR-FACT-3 Output handling.** The response text must be trimmed. Empty or incomplete output counts as a failure (§3.6). The text must be stored as-is, and rendered only as plain text.

**FR-FACT-4 Persist.** Every generated fact must be inserted as a new `Fact` row with `userId`, `movieTitle`, `movieKey` and `text`. `createdAt` is set by the database (D9, D12).

### 3.5 Server caching and duplicate protection (Variant A)

**FR-CACHE-1 Server window.** If the newest fact for (user, movie key) has `createdAt > now() - 60 seconds`, measured by the database clock, `getFact` must return it with `source: "cache"` and must not call OpenAI (D12).

**FR-CACHE-2 Stale means regenerate.** If the newest fact is 60 seconds old or older, or there is none, `getFact` must generate, store and return a new fact with `source: "generated"`.

**FR-CACHE-3 Movie scoping.** Facts must be matched by movie key. After a movie change, facts for the old movie must not count as fresh. After a capitalization-only change, they still count (D23).

**FR-CON-1 Lease claim.** Before calling OpenAI, `getFact` must claim the user's lease with one conditional `UPDATE`:
- set `factLeaseUntil = now() + 15 seconds` and a new random `factLeaseToken`;
- only where the lease is null or expired;
- and check the row count to see whether it won (D11, D13).

**FR-CON-2 Re-check after claim.** After winning the lease, `getFact` must repeat the fresh check before calling OpenAI. If a fresh fact now exists, it must release the lease and return that fact as `cache`.

**FR-CON-3 Release.** The lease must be released in a `finally` block, with a token-checked update (`WHERE factLeaseToken = <own token>`). That way a request that ran past its expiry cannot clear a newer claim (D13).

**FR-CON-4 Waiting for the holder.** A request that fails to claim the lease must poll the fresh check every 500 ms for up to 9 seconds.
- If a fresh fact appears, it returns that fact with `source: "shared"`.
- If none appears, it follows FR-FAIL-1 and FR-FAIL-2 (D17).
- It must not hold a database transaction or connection while sleeping between polls.

**FR-CON-5 No duplicate calls.** For any number of simultaneous `getFact` calls for one user, with no fresh fact present, exactly one OpenAI call must be made, and every call must return the same fact text.
- *Accept:* the concurrency test in §8 passes.

**FR-CON-6 Crash recovery.** A lease whose `factLeaseUntil` has passed must be claimable by the next request.

### 3.6 Failure handling (Variant A)

**FR-FAIL-1 Timeout.** The OpenAI client must use an 8-second timeout and 0 retries (D14). The function runtime limit on `/api/fact` must be at least 15 seconds.

**FR-FAIL-2 Fallback.** If generation fails (error, timeout, or empty/incomplete output), `getFact` must:
- return the newest fact for (user, movie key), whatever its age, with `source: "fallback"` and `secondsUntilRefresh: 0`;
- if there is none, fail with `FACT_UNAVAILABLE` (HTTP 503).

**FR-FAIL-3 Logging.** The server must log the error class and message, plus the user ID. It must never send OpenAI error details to the client.

**FR-FAIL-4 Fallback UI.** A `fallback` fact must show the notice "Couldn't get a fresh fact, so here's your last one." A 503 must show "Couldn't load a fact. OpenAI didn't answer in time." with a "Try again" button that refetches.

### 3.7 Typed API (Variant B)

**FR-API-1 Endpoints.** The app must expose the three endpoints in §6, each validated with a Zod schema from `lib/contracts.ts`.

**FR-API-2 Error shape.** Every error response must use the matching HTTP status and the body `{ error: { code, message, issues? } }`, where `code` is one of the five codes in §6.4 (D21).

**FR-API-3 Session-only identity.** No endpoint may accept a user ID in the path, query or body. The handler must take identity only from `requireUser()` (D7).

**FR-API-4 Typed client.** `lib/api.ts` must export `getMe()`, `setMovie(movie)` and `getFact()`. They share one `request()` helper, which:
- sends `credentials: "same-origin"` and JSON headers;
- parses success bodies with the endpoint's Zod schema;
- throws `ApiError { status, code, message, issues? }` for any non-2xx response, network failure, or response that doesn't match the schema (status 0 and code `INTERNAL` for network failures).

**FR-API-5 401 handling.** When any client call gets `UNAUTHENTICATED`, the app must redirect to `/`.

### 3.8 Inline movie edit (Variant B)

**FR-EDIT-1 Enter edit mode.** An "Edit" button beside the title must replace it with a text field pre-filled with the current title and focused, plus "Save" and "Cancel" buttons.

**FR-EDIT-2 Cancel.** Cancel or Escape must restore the view mode unchanged and return focus to the Edit button.

**FR-EDIT-3 Client validation.** Saving an invalid title must show the §5.2 message inline and send no request.

**FR-EDIT-4 Optimistic update.** Saving a valid title must show the new title immediately, both in the heading and on the stub, plus a "Saving" indicator, and then send `PUT /api/me/movie`.

**FR-EDIT-5 Rollback.** If the request fails, the previous title must be restored and a toast must say: Couldn't save "<new>". Your favorite is still <old>.

**FR-EDIT-6 Success.** On success, the `['me']` query must be updated and the fact cache invalidated. The ticket then loads a fact for the new movie (FR-CLIENT-3).

**FR-EDIT-7 Same movie.** If the new title differs from the old one only in case or spacing, it is saved, and the current fact stays on screen.

### 3.9 Client caching (Variant B)

**FR-CLIENT-1 Query setup.** The fact must be fetched with TanStack Query under the key `['fact', movieKey]` with `staleTime: 30_000` (D20).

**FR-CLIENT-2 Reuse.** Within 30 seconds of the last successful fetch, remounting the ticket or refocusing the window must not send a request.

**FR-CLIENT-3 Invalidate on change.** A successful movie change must invalidate the `['fact']` queries. The new movie key means the old entry is never shown for the new movie.

**FR-CLIENT-4 New fact button.** The button below the ticket must:
- read "New fact in Ns" and be disabled while the countdown is above zero;
- read "New fact" when enabled, and call `refetch()` when clicked;
- read "Getting a fact" and be disabled while a request is in flight;
- be hidden in the error state, because the ticket's "Try again" covers it.

**FR-CLIENT-5 Countdown source.** The countdown must start from the response's `secondsUntilRefresh`, counted down from the moment the response arrived, so the browser's clock never decides it (D19).

**FR-CLIENT-6 States.** Every async surface must have loading, error and success states, as listed in arch §8 "UI states".

---

## 4. Data requirements

### 4.1 Schema

Better Auth generates the `User`, `Session`, `Account` and `Verification` models with its CLI. The app adds these fields and model:

```prisma
model User {
  // ...fields generated by Better Auth (id, name, email, emailVerified, image, createdAt, updatedAt)
  favoriteMovie   String?   @db.VarChar(100)
  factLeaseUntil  DateTime? @db.Timestamptz(3)
  factLeaseToken  String?
  facts           Fact[]
  // ...relations generated by Better Auth (sessions, accounts)
}

model Fact {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  movieTitle String   @db.VarChar(100)
  movieKey   String   @db.VarChar(100)
  text       String
  createdAt  DateTime @default(now()) @db.Timestamptz(3)

  @@index([userId, movieKey, createdAt(sort: Desc)])
}
```

### 4.2 Integrity rules

| Rule | Enforced by |
|---|---|
| A fact always belongs to an existing user | Foreign key with cascade delete |
| `movieTitle` and `favoriteMovie` are at most 100 characters | Column type, plus the shared validator |
| Timestamps come from the database clock | `@default(now())` and SQL `now()` in lease and window queries |
| One lease per user | The two lease columns live on the user row |

### 4.3 Migrations

- Schema changes go through `prisma migrate dev` locally and `prisma migrate deploy` in CI and production.
- Migrations connect with `DIRECT_URL`.
- The first migration includes the Better Auth tables and the `Fact` model.

---

## 5. Validation rules

### 5.1 Movie title (D10)

One function in `lib/movie.ts` returns either `{ value, key }` or an error. It runs on the server, which is authoritative, and in the browser for early feedback.

1. Reject anything that isn't a string.
2. Trim the ends, and replace every run of whitespace with one space.
3. Reject if any control character is present (U+0000 to U+001F, U+007F).
4. Reject if the length is 0 or greater than 100.
5. `value` is the result of rule 2, keeping the user's capitalization. `key` is `value.toLowerCase()`.

### 5.2 Messages

| Case | Message |
|---|---|
| Empty after trimming | Enter a movie title. |
| Longer than 100 characters | Keep the title under 100 characters. |
| Control characters | Remove the hidden characters from the title. |

---

## 6. API specification

All endpoints use JSON and require a session cookie. Timestamps are ISO 8601 strings in UTC.

### 6.1 `GET /api/me`

Response `200`:
```ts
{
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  favoriteMovie: string | null;
}
```
Errors: `401 UNAUTHENTICATED`.

### 6.2 `PUT /api/me/movie`

Request:
```ts
{ movie: string } // validated with §5.1
```
Response `200`:
```ts
{ favoriteMovie: string } // the normalized value
```
Errors: `400 VALIDATION_ERROR` with `issues: [{ path: ["movie"], message }]`, `401 UNAUTHENTICATED`.

### 6.3 `GET /api/fact`

Response `200`:
```ts
{
  fact: { text: string; movieTitle: string; generatedAt: string };
  source: "cache" | "generated" | "shared" | "fallback";
  secondsUntilRefresh: number; // integer 0 to 60, from DB time; 0 for fallback
}
```
Errors: `401 UNAUTHENTICATED`, `409 ONBOARDING_REQUIRED`, `503 FACT_UNAVAILABLE`.

### 6.4 Error codes

| Code | Status | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `VALIDATION_ERROR` | 400 | Body fails its schema or the movie rule |
| `ONBOARDING_REQUIRED` | 409 | Fact requested before a movie is saved |
| `FACT_UNAVAILABLE` | 503 | Generation failed and there's no earlier fact |
| `INTERNAL` | 500 | Anything unexpected. The message is generic, and details are logged on the server |

---

## 7. Non-functional requirements

### 7.1 Security

- **NFR-SEC-1** Secrets (`OPENAI_API_KEY`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, database URLs) must be read only in server code. None may use the `NEXT_PUBLIC_` prefix. Modules that read them must import `server-only`.
- **NFR-SEC-2** The session cookie must be HttpOnly, Secure in production, and SameSite=Lax. Better Auth's cookie cache must be off (D4).
- **NFR-SEC-3** Every protected page and API route must call `requireUser()`. There must be no proxy or middleware acting as the only check (D5).
- **NFR-SEC-4** No endpoint accepts a user ID (D7).
- **NFR-SEC-5** Fact text must be rendered as text, never through `dangerouslySetInnerHTML`.
- **NFR-SEC-6** Error responses must not include stack traces, SQL, or upstream error bodies.

### 7.2 Performance

- **NFR-PERF-1** A cached fact (`source: "cache"`) should return in under 300 ms at the server, excluding cold starts.
- **NFR-PERF-2** The dashboard's profile and movie must render without waiting on OpenAI (D22).
- **NFR-PERF-3** At most one OpenAI call per user per 60 seconds for an unchanged movie.

### 7.3 Reliability

- **NFR-REL-1** The lease guarantee (FR-CON-5) must hold with several concurrent server instances.
- **NFR-REL-2** The Prisma client must use one module-level `pg` pool with an explicit connection timeout (5 seconds) and idle timeout. At runtime it connects through the pooled `DATABASE_URL`.

### 7.4 Accessibility

- **NFR-A11Y-1** All controls must be reachable and usable by keyboard, with a visible focus ring.
- **NFR-A11Y-2** Text contrast must be at least 4.5:1 for body text and 3:1 for large text. Ember is never used for small text.
- **NFR-A11Y-3** Form fields must have labels, and errors must be announced (`role="alert"`) and tied to their field (`aria-describedby`, `aria-invalid`).
- **NFR-A11Y-4** The fact ticket must be a polite live region, and must set `aria-busy` while loading.
- **NFR-A11Y-5** Motion (the marquee, the print reveal, spinners) must stop under `prefers-reduced-motion: reduce`.

### 7.5 Visual design

- **NFR-UI-1** The UI must follow [design/DESIGN.md](../design/DESIGN.md) tokens and the approved mockups. The exceptions are recorded in D28.
- **NFR-UI-2** Icons come from [design/icons/](../design/icons/), and fonts are self-hosted Bowlby One and General Sans (D29).
- **NFR-UI-3** Layouts must work from 360px wide upward without horizontal scrolling. The ticket stacks its stub below the body under 768px.

### 7.6 Maintainability

- **NFR-MAIN-1** TypeScript strict mode, with no `any` in application code.
- **NFR-MAIN-2** ESLint and Prettier must pass in CI.
- **NFR-MAIN-3** Code comments and docs follow the project's plain-writing style, with no em or en dashes.

---

## 8. Test requirements

Every test below must run in CI (D25, D26). OpenAI is always mocked.

| ID | Type | Covers | Check |
|---|---|---|---|
| T-A1 | Backend, real DB | FR-CACHE-1 | A fact created 10 s ago is returned as `cache`; OpenAI is not called |
| T-A2 | Backend, real DB | FR-CACHE-2 | A fact backdated to 61 s triggers one OpenAI call and returns `generated` |
| T-A3 | Backend, real DB | FR-CACHE-3 | After a movie change, the old movie's fresh fact isn't returned; after a case-only change, it is |
| T-A4 | Backend, real DB | FR-CON-5 | Five parallel `getFact` calls make exactly 1 OpenAI call and return identical text |
| T-A5 | Backend, real DB | FR-CON-6, FR-CON-3 | An expired lease is reclaimed; releasing with a stale token leaves a newer lease intact |
| T-A6 | Backend, real DB | FR-FAIL-2 | OpenAI throws with an older fact present: returns `fallback`. With none: `FACT_UNAVAILABLE` |
| T-A7 | Backend, real DB | FR-API-3, NFR-SEC-4 | User B's `getFact` never returns user A's facts; each endpoint returns 401 without a session |
| T-A8 | Unit | §5.1 | Movie rule: trimming, collapsing, 0/1/100/101 lengths, control characters, the key |
| T-B1 | Frontend, MSW | FR-API-4 | 401 response becomes `ApiError` with `UNAUTHENTICATED` |
| T-B2 | Frontend, MSW | FR-API-4 | 500 response becomes `ApiError` with `INTERNAL`; a network failure becomes status 0 |
| T-B3 | Frontend, MSW + RTL | FR-EDIT-4, FR-EDIT-5 | Save shows the new title at once; a 500 restores the old title and shows the toast |
| T-B4 | Frontend, MSW + RTL | FR-EDIT-6, FR-CLIENT-3 | Successful save refetches the fact for the new movie |
| T-B5 | Frontend, MSW + RTL | FR-EDIT-2, FR-EDIT-3 | Cancel restores the view; an invalid title shows the message and sends nothing |

---

## 9. Deployment requirements

- **DEP-1** The app deploys to Vercel from the GitHub `main` branch. Environment variables are set per environment as listed in arch §11.
- **DEP-2** Production migrations run with `prisma migrate deploy` using `DIRECT_URL` before or during the deploy.
- **DEP-3** The Google OAuth client must list the production and local callback URLs: `{BETTER_AUTH_URL}/api/auth/callback/google`.
- **DEP-4** A `.env.example` must list every variable with a placeholder value and no real secrets.

## 10. Documentation requirements (brief "Deliverables")

The README must contain:
- **DOC-1** setup instructions;
- **DOC-2** required environment variables;
- **DOC-3** database migration steps;
- **DOC-4** a 1 to 2 page architecture overview;
- **DOC-5** the chosen variant (A) and why, with B described as an extra;
- **DOC-6** key tradeoffs, including the movie-change limit (D18);
- **DOC-7** "what I'd improve with 2 more hours".

The repo also includes:
- **DOC-8** a short note on AI usage, as bullets;
- **DOC-9** a 3 to 5 minute walkthrough video covering the schema, the caching and client-state strategy, and failure handling.

---

## 11. Traceability to the brief

| Brief requirement | Requirements |
|---|---|
| Landing with Sign in with Google | FR-AUTH-1, FR-AUTH-2 |
| First-time to onboarding, returning to dashboard | FR-AUTH-3, FR-AUTH-5 |
| Onboarding: server validation, store, associate | FR-ONB-1 to FR-ONB-4, §5 |
| Dashboard: name, email, photo, movie, logout | FR-DASH-1 to FR-DASH-4, FR-AUTH-6 |
| Logged out on /dashboard redirects | FR-AUTH-4 |
| Fact via OpenAI, stored | FR-FACT-1 to FR-FACT-4 |
| A: 60 s cache window | FR-CACHE-1 to FR-CACHE-3 |
| A: burst / idempotency protection | FR-CON-1 to FR-CON-6 |
| A: failure handling | FR-FAIL-1 to FR-FAIL-4 |
| A: tests for cache and authorization | T-A1 to T-A7 |
| B: typed API layer | FR-API-1 to FR-API-5, §6 |
| B: inline edit, optimistic, revert | FR-EDIT-1 to FR-EDIT-7 |
| B: client cache 30 s, explicit refresh, invalidate | FR-CLIENT-1 to FR-CLIENT-5 |
| B: tests for client errors and edit flow | T-B1 to T-B5 |
| Validate input server side | §5.1, FR-API-1 |
| Users can't access others' data | FR-API-3, NFR-SEC-4, T-A7 |
| No secrets on the client | NFR-SEC-1 |
| Missing Google photo or name | FR-DASH-2, FR-DASH-3 |
| Deliverables | DOC-1 to DOC-9 |

## 12. Open questions

None. All load-bearing decisions are recorded in [design-decision.md](design-decision.md).

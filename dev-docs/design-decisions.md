# Design decisions: Pandoras Box

Every decision below was made by the project owner, Vishal Patil, on 2026-11-10. Each entry records the context, the options that were on the table, what was chosen, and what follows from it. Background research for most entries is in [research.md](research.md), and the resulting system is described in [architecture.md](architecture.md).

A few details were filled in by the architect while writing these docs, because they follow directly from an owner decision. They are marked "architect's detail" so they can be checked.

## Contents

- Scope and framing: D1 to D2
- Auth and access: D3 to D7
- Data: D8 to D10
- Fact generation (Variant A): D11 to D18
- Client and API (Variant B): D19 to D23
- Platform and tooling: D24 to D27
- Design: D28 to D30

---

## Scope and framing

### D1. Build both variants, with A as the primary choice

**Context.** The brief asks for the base app plus one variant (A: backend caching and correctness, or B: frontend and API contracts). The README has to state which variant was chosen and why.

**Decision.** Build both. The README names Variant A as the chosen variant and presents Variant B as an extra.

**Why.** The goal is to show full-stack range. Naming one variant as primary still answers "which and why" directly, so the submission doesn't read as ignoring the instructions.

**Consequences.** The two caches stack. The browser's 30-second cache (B) answers first, and the server's 60-second cache (A) stops repeated OpenAI calls. Both sets of required tests ship.

### D2. App name

**Decision.** The app is called **Pandoras Box**.

---

## Auth and access

### D3. Better Auth with its Google provider

**Options.**
- Better Auth: maintained, works with Prisma and Google.
- Auth.js v5: still in beta and only getting security fixes.
- Auth.js v4: built for the older pages router.
- Supabase Auth: users live in Supabase's own schema, and sessions are JWTs.

**Decision.** Better Auth with the Google provider. Supabase is used only as the Postgres host (see D24).

**Why.** Better Auth is the maintained option. Keeping auth in our own Prisma tables means sessions can live in the database (D4) and every check can go through one function (D5). Supabase Auth would have put users outside Prisma and used JWT sessions, which conflicts with D4.

### D4. Database sessions

**Options.** Database sessions (a random ticket in a cookie, looked up in Postgres), or JWTs (a signed token the server never looks up).

**Decision.** Database sessions, with Better Auth's cookie cache turned off.

**Why.** Logout really ends the session, because deleting the row invalidates the ticket everywhere. JWTs can't be revoked before they expire, and the cookie cache has a known issue that keeps revoked sessions valid (GHSA-fvxx-76fc-893x).

**Consequences.** Every authenticated request costs one indexed session lookup.

### D5. Check the session next to the data, not only at the edge

**Options.**
- Proxy/middleware only.
- A server-side `requireUser()` called by every page and API route.
- Both.

**Decision.** `requireUser()` in a server-only data access layer, called from every protected page and every API route. No proxy file.

**Why.** Two middleware bypass CVEs (CVE-2025-29927 and CVE-2026-44575) show that the edge isn't a safe place for the only check, and the official Next.js guide recommends this pattern. With a single rule there is one thing to audit and explain.

**Consequences.** Pages redirect when there's no session. API routes return 401 `UNAUTHENTICATED`.

### D6. Decide first-time vs returning from the data

**Decision.** A user with no favorite movie goes to `/onboarding`. A user with one goes to `/dashboard`. `/onboarding` redirects to `/dashboard` once a movie exists, and `/dashboard` redirects to `/onboarding` while there isn't one.

**Why.** A "new account" signal from the login library breaks when someone signs up and closes the tab before choosing a movie: they'd come back as "returning" with nothing to show.

### D7. Endpoints never accept a user ID

**Decision.** No route or service takes a user ID from the client. Identity always comes from the session through `requireUser()`.

**Why.** It makes reading or changing another user's data impossible by construction, so there's no ownership check to forget. Variant A's authorization test proves it.

*Architect's detail, following from D5 and the Variant A test requirement.*

---

## Data

### D8. The favorite movie is a column on User

**Options.** A column on User, its own table, or a shared Movie table.

**Decision.** A nullable `favoriteMovie` column on User.

**Why.** The brief has exactly one favorite per user. A separate table would only help with several favorites or a history, which aren't asked for. A shared Movie table falls apart because typed titles don't match each other reliably.

### D9. Facts are kept as history rows

**Decision.** Each generated fact is a new row with the user, the movie title it was about, a normalized movie key, the text, and the time it was created. The newest row for a user and movie is the cache.

**Why.**
- The brief says to store generated facts.
- History gives the fallback when OpenAI fails (D14).
- Recording the movie on the fact means changing the movie automatically skips the old cache.

**Architect's detail.** The normalized key is stored in its own `movieKey` column (lowercased, with spaces collapsed) rather than computed in a SQL function index. Prisma's schema can't express a functional index, and a plain column keeps the lookup index simple: `(userId, movieKey, createdAt)`.

### D10. Movie title rules

**Decision.** One rule, enforced on the server for both onboarding and inline edit:
- Trim the ends and collapse repeated spaces.
- 1 to 100 characters after trimming. The one-letter film *M* (1931) is why the minimum is 1.
- Reject control characters.
- Keep the user's capitalization for display.
- Compare case-insensitively when matching cached facts.

---

## Fact generation (Variant A)

### D11. A lease stops duplicate generation

**Options.**
- An in-memory lock: fails with more than one server.
- A unique constraint per 60-second window: stops the duplicate row, not the duplicate OpenAI call, and its windows don't line up with "60 seconds since the last fact".
- An advisory lock inside a transaction: holds a database connection open for the whole OpenAI call, longer than Prisma's 5-second transaction timeout.
- A lease, meaning a "generation in progress" claim that expires.

**Decision.** The lease. One conditional `UPDATE` claims it, and it only succeeds when no unexpired claim exists.

**Why.** It works correctly across many servers, holds no locks or transactions during the slow OpenAI call, recovers from crashes through expiry, and works behind a connection pooler.

### D12. The database clock decides "under 60 seconds"

**Decision.** Every comparison against the 60-second window and the lease expiry uses Postgres `now()`.

**Why.** All app servers share one clock, so clock drift between instances can't stretch or shrink the window.

### D13. Lease storage

**Decision.** Two columns on User:
- `factLeaseUntil` is the expiry, set 15 seconds ahead, which is longer than the 8-second OpenAI limit.
- `factLeaseToken` is a random ID for each claim.

The holder releases the lease only if the token still matches. There is one lease per user, not per user and movie, because a user has one movie at a time.

**Why the token.** If a request overruns its expiry and someone else claims the lease, the late request must not clear the newer claim.

### D14. Behavior when OpenAI is slow or fails

**Decision.**
- 8-second timeout and no automatic retries. The user's own click is the retry.
- On failure, return the newest saved fact for this user and movie, whatever its age, labeled as stale: "Couldn't get a fresh fact, so here's your last one."
- With no saved fact, return 503 `FACT_UNAVAILABLE`. The UI shows a friendly message and a "Try again" button.
- The server logs the real error. The client never sees it.

**Why.** The SDK defaults to a 10-minute timeout with 2 retries, which would hang the dashboard during an outage.

### D15. Model and prompt

**Decision.**
- Model `gpt-5.4-mini` by default, read from `OPENAI_MODEL`, with reasoning effort set to minimal.
- The prompt follows IMDb's trivia rules: one fact, about two sentences at most, third person, no spoilers, only well-documented facts, and name the release year it assumed.
- The movie title goes in as quoted data, never as instructions.
- The output is capped, trimmed, rejected if empty, and shown as plain text with an "AI-generated, may be inaccurate" label.

### D16. Avoid repeating the last fact

**Decision.** When a previous fact exists for this movie, the prompt includes it and asks for a different one.

### D17. What a request does while another holds the lease

**Options.**
- (a) Wait briefly and share the result.
- (b) Return the old fact immediately.
- (c) Return 202 and let the browser retry.

**Decision.** (a). The waiting request checks the database every 500 ms for up to 9 seconds. When the holder's new fact appears, it returns that same fact. If none appears, it falls back as in D14. It holds no database connection while waiting.

**Why.** Two tabs end up showing the same fact, which is what "no duplicate generation" means to a user.

### D18. Movie-change spam is a documented limit

**Context.** A new movie always skips the 60-second cache. The lease stops overlapping calls but not calls made one after another, so changing the movie 20 times in a minute costs 20 OpenAI calls.

**Decision.** Accept it and document it in the README as a known limit. The fix (a per-user rate limit) goes under "with 2 more hours".

**Why.** Naming the hole clearly is better reasoning than a half-measure guard.

---

## Client and API (Variant B)

### D19. The "New fact" button counts down

**Context.** An explicit click is supposed to skip the browser cache, but the server returns the same fact for 60 seconds, so a click at second 20 looks broken.

**Options.**
- Return the same fact with a note.
- Let a click skip the server cache too.
- Disable the button with a countdown.

**Decision.** The countdown. The button reads "New fact in Ns" and stays disabled until the server window ends. Clicking it after that produces a new fact.

**Why.** It's honest, it keeps both variants' rules exactly as written, and every allowed click does something.

**Architect's detail.** The API returns `secondsUntilRefresh`, computed by the server from database time. The client counts down from the moment it receives the response, so client clock skew doesn't matter.

### D20. TanStack Query for client caching

**Decision.** TanStack Query v5:
- `staleTime: 30_000` gives the 30-second reuse.
- `refetch()` serves the explicit "New fact".
- `invalidateQueries` clears the cache on movie change.
- Optimistic edits follow the documented snapshot and rollback recipe.

**Why.** Each Variant B caching rule is a documented built-in. SWR has no equivalent of `staleTime` (its `dedupingInterval` is a different thing), and plain React state would mean writing the cache and race handling ourselves.

### D21. API contract

**Decision.**
- Success returns the typed data directly.
- Errors return the right HTTP status and `{ error: { code, message } }`.
- The codes are a fixed set:
  - `UNAUTHENTICATED` (401)
  - `VALIDATION_ERROR` (400, with field issues)
  - `ONBOARDING_REQUIRED` (409)
  - `FACT_UNAVAILABLE` (503)
  - `INTERNAL` (500)
- One Zod schema per endpoint is shared by the route handler and `lib/api.ts`.
- `lib/api.ts` turns every failure, network errors included, into a single `ApiError` type.

### D22. Server draws the profile, the browser loads the fact

**Decision.** The dashboard's Server Component renders the profile and movie immediately and passes them to TanStack Query as initial data. The browser fetches the fact from `GET /api/fact` and shows a skeleton while it waits.

**Why.** The page is never held up by OpenAI, and the browser cache's 30-second clock starts from a real response rather than from page load.

### D23. One write path for the movie

**Decision.** Onboarding and inline edit both call `PUT /api/me/movie` through `lib/api.ts`.

**Why.** One endpoint, one validation rule, one set of tests.

**Movie changes, decided alongside this:**
- Old facts stay in history.
- The next fact request generates for the new title without waiting on the countdown.
- The browser drops its cached fact as soon as the save succeeds.
- A capitalization-only edit counts as the same movie, so the cached fact still applies.

---

## Platform and tooling

### D24. Hosting: Vercel and Supabase Postgres

**Decision.** Vercel hosts the app and Supabase provides Postgres only. At runtime the app connects through Supabase's pooled connection string, and migrations use the direct connection string.

### D25. Testing

**Decision.**
- Vitest for everything.
- **Variant A tests run against a real Postgres in Docker, with only OpenAI mocked:**
  - the 60-second cache
  - five simultaneous requests producing exactly one OpenAI call
  - the failure fallback
  - reclaiming an expired lease
  - one user being unable to read another's facts
- **Variant B tests use MSW and React Testing Library:**
  - `lib/api.ts` handling 401 and 500
  - the optimistic edit showing, reverting on failure, and refreshing the fact on success
- There are no end-to-end tests through real Google login.

**Why.** The duplicate guard lives in SQL, and a mocked database can't prove it works.

### D26. Tooling and CI

**Decision.** pnpm, ESLint, Prettier, and GitHub Actions running type-check, lint and all tests on every push, with a Postgres service container.

### D27. Styling base

**Decision.** Tailwind v4 with shadcn. DESIGN.md's tokens become the theme variables.

**Why.** Cult UI components install through the shadcn CLI, which expects Tailwind v4.

---

## Design

### D28. Visual direction: ticket stub on the DESIGN.md system

**Decision.**
- The UI follows [design/DESIGN.md](../design/DESIGN.md): pastel color bands, 1px black outlines, pill buttons, a crushed display face and the six sticker colors, with no shadows or gradients.
- The fact appears on a ticket with a tear-off stub, as shown in [design/mocks/index.html](../design/mocks/index.html).
- Component structure comes from Cult UI, restyled to DESIGN.md:

  | Use | Cult UI component |
  |---|---|
  | Buttons | `halo-button` |
  | Form field | `halo-field` |
  | Inline title edit | `morph-surface` |
  | Fact ticket | `cutout-card` |
  | AI label | `halo-badge` |
  | Avatar | `collab-avatar` |
  | Failed-save message | `halo-toast` |
  | Countdown | `rolling-number` |

- Icons are Rune outline icons stored in [design/icons/](../design/icons/) (Apache 2.0).

**Where DESIGN.md had to bend.** Error text is black with an Ember warning sticker, because Ember text on white fails contrast.

### D29. Fonts

**Decision.** The free substitutes that DESIGN.md lists, self-hosted: Bowlby One for display (in place of Lateral) and General Sans for the UI (in place of Aeonik Pro).

### D30. Missing Google name or photo, and logout

**Decision.**
- **Missing name:** show the part of the email before the @.
- **Missing or broken photo:** show the user's initials in a circle.
- **Profile refresh:** name and photo are refreshed from Google on each login.
- **Logout:** deletes the session row and returns to the landing page. Other open tabs are logged out on their next request.

---

## Decisions made after the initial set

New entries follow the ADR format in `CLAUDE.md`.

## ADR-031: OpenAI is an allowed paid service

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** `CLAUDE.md` asks for free, open source or local services only. The exercise brief requires the OpenAI API, which is paid.
- **Options:** A / treat OpenAI as a required exception. B / swap in a free or local model and break the brief's required stack.
- **Decision:** A. OpenAI is the one paid service. Hosting and the database stay on free tiers (Vercel, Supabase).
- **Why:** The brief requires OpenAI, and the owner confirmed it is a required exception.
- **Consequences:** Every fact costs money. The 60-second cache, the lease (one call at a time per user), the `gpt-5.4-mini` default and the 150-token output cap keep that cost small. Rapid movie changes are still unbounded (D18).

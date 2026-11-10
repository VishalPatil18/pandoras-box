# Epic - Pandoras Box

> Take-home exercise (SWE, Full-Stack). Source brief: [SWE*Take-Home_Exercise*(Full-Stack).pdf](<SWE_Take-Home_Exercise_(Full-Stack).pdf>)
> Owner / sole decision maker: Vishal Patil

---

## 1. Problem statement

Build **Pandoras Box** - the "Movie Memory" product from the brief - a small full-stack web app where a user signs in with Google, tells us their favorite movie once, and gets a dashboard showing their profile, that movie, and an AI-generated fun fact about it.

The brief's own grading principle governs every step below:

> "The goal is not feature volume, but correctness, clarity, and thoughtful tradeoffs." - "Clean, thoughtful engineering beats over-engineering."

## 2. Why we're doing both variants

The brief says _choose ONE_ variant. We implement **both**, to demonstrate full-stack capability (frontend and backend).

- **Variant A (Backend - caching & correctness) is the PRIMARY choice.** The README states A as "the variant chosen" with its reasoning.
- **Variant B (Frontend/API - client orchestration) is presented as an EXTRA**, clearly labeled, so the README still directly answers "which variant and why".
- The two compose cleanly into a two-layer cache:
  - **Browser (B, 30s)** answers first - no network call if a fresh fact is held client-side.
  - **Server (A, 60s)** answers next - stops repeated / concurrent OpenAI calls.

## 3. Hard constraints (from the brief - non-negotiable)

| Area           | Requirement                                            |
| -------------- | ------------------------------------------------------ |
| Language       | TypeScript                                             |
| Framework      | Next.js (App Router preferred)                         |
| UI             | React + TailwindCSS                                    |
| DB             | Postgres via Prisma                                    |
| Auth           | Google OAuth                                           |
| AI             | OpenAI API                                             |
| Explainability | Every line submitted must be explainable by the author |

## 4. Scope

### Goals

- Base implementation, fully correct.
- Variant A, fully correct, with its required tests.
- Variant B, fully correct, with its required tests.
- Deployed, working public URL.
- README + AI-usage note + 3 to 5 min walkthrough video.

### Non-goals

- Features not in the brief (social, lists, multiple movies, ratings, search, etc.).
- Production-scale infrastructure beyond what a single deployed instance needs.

### Anti-goals (would be a failure even if it "works")

- Over-engineering that the author can't defend in the video.
- Any secret (OpenAI key, OAuth secret, DB URL) reachable from the browser bundle.
- Any path where user X can read or modify user Y's data.
- README that is ambiguous about which variant was "chosen".

---

## 5. Requirements checklist (traceable to the brief)

### 5.1 Base - Authentication

- [ ] `/` unauthenticated → landing page with **"Sign in with Google"**.
- [ ] After Google login, **first-time user** (no favorite movie) → `/onboarding`.
- [ ] After Google login, **returning user** → `/dashboard`.
- [ ] Logged-out visit to `/dashboard` → redirect to login.

### 5.2 Base - Onboarding (first-time only)

- [ ] Prompt for favorite movie.
- [ ] **Server-side** validation: trim, min length, max length.
- [ ] Persist in Postgres, associated with the authenticated user.
- [ ] Users who already completed onboarding are not shown it again.

### 5.3 Base - Dashboard

- [ ] User name (from Google) - graceful fallback if missing.
- [ ] User email (from Google).
- [ ] User photo (if available) - graceful fallback if missing.
- [ ] Favorite movie (from DB).
- [ ] Logout button.

### 5.4 Base - Fact generation

- [ ] Display a fun fact about the favorite movie via OpenAI.
- [ ] Persist generated facts in the DB.

### 5.5 Variant A - Backend (PRIMARY)

- [ ] **60-second cache window:** most recent fact for _this user + movie_ < 60s old → return it; else generate, store, return.
- [ ] **Burst / idempotency protection:** rapid refresh and multiple tabs must not trigger simultaneous generations. Pick exactly one approach (decided in grilling): DB transaction guard · "generation in progress" flag · unique constraint per user per 60s window · in-memory lock (limitation documented).
- [ ] **Failure handling:** OpenAI timeout/error → return most recent cached fact if any; otherwise a user-friendly error.
- [ ] **Tests:** 60-second cache logic.
- [ ] **Tests:** authorization - a user cannot fetch another user's facts.

Evaluation emphasis: data modeling · cache-window correctness · concurrency reasoning · safe OpenAI integration · backend correctness.

### 5.6 Variant B - Frontend/API (EXTRA)

- [ ] **Typed API endpoints:** `GET /api/me`, `PUT /api/me/movie`, `GET /api/fact`.
- [ ] **Typed client wrapper** (`lib/api.ts`): consistent requests, typed response parsing, normalized errors.
- [ ] **Inline edit of favorite movie** on dashboard: Save + Cancel, optimistic update, revert on server failure.
- [ ] **Client-side cache:** last fact + timestamp; reuse within 30s unless user explicitly asks for a new one; invalidate when movie changes. Choice of mechanism (React state / SWR / React Query / custom) explained.
- [ ] Loading / error / empty states for every async surface.
- [ ] **Tests:** API client error handling (401, 500).
- [ ] **Tests:** movie edit flow behavior (optimistic + revert).

Evaluation emphasis: API contract clarity · typed client design · loading/error/empty states · cache invalidation correctness · frontend state reasoning.

### 5.7 Security & correctness (applies to all)

- [ ] Movie input validated server-side (onboarding _and_ inline edit share the same rule).
- [ ] Every data access is scoped to the session user - no user-id from the client is trusted.
- [ ] No secrets in client bundle (no `NEXT_PUBLIC_` for secrets).
- [ ] Missing Google photo / name handled gracefully.

### 5.8 Deliverables

- [ ] GitHub repository.
- [ ] README: setup · env vars · DB migration steps · architecture overview (1 to 2 pages) · variant chosen (A) + why, with B as extra · key tradeoffs · "with 2 more hours I'd…".
- [ ] AI-usage note (bullets).
- [ ] 3 to 5 min walkthrough video of key decisions.

### 5.9 Evaluation criteria to self-check against before submission

1. Auth flow correctness
2. Data modeling quality
3. Security and authorization
4. Error handling
5. Code clarity and structure
6. Ability to explain decisions (schema · caching/client-state · tradeoffs & failure cases)
7. Depth in chosen variant

---

## 6. Delivery steps (the work plan for this epic)

Each step has an output and an exit gate. A step doesn't start until the previous gate is met.

### Step 0 - Understand the brief → `epic.md` ✅ (this file)

- [x] Read the brief end to end.
- [x] Resolve "one variant" vs "both" → A primary, B extra.
- [x] Name the app → Pandoras Box.
- **Gate:** owner confirms this checklist.

### Step 1 - Market research → `research.md` (part 1) ✅

- [x] **Consumer products:** how movie/trivia products surface facts and personal taste (Letterboxd, IMDb "Did you know" / trivia, TMDB, similar AI movie-fact apps).
- [x] **Developer patterns:** how this stack is typically built - Auth.js/NextAuth + Prisma starters, Next.js App Router auth patterns, AI-fact generators, server caching & dedup/locking patterns for LLM calls, client caching (SWR / React Query).
- [x] For each: what they do, how (architecture where visible), what's worth borrowing.
- **Gate:** owner reads research part 1.

### Step 2 - Flaw analysis → `research.md` (part 2) ✅

- [x] For each competitor/pattern: architectural flaws (e.g. race conditions in naive cache-then-generate, middleware-only auth checks, client-trusted user IDs, unbounded LLM cost, missing fallbacks, stale client caches).
- [x] For each flaw: how Pandoras Box avoids it, scoped to what the brief rewards (no over-engineering).
- **Gate:** owner reads research part 2.

### Step 3 - Grilling session → `design-decision.md` + `architecture.md` ✅

- [x] Owner is **sole decision maker**. Agent proposes options with plain-language explanations; nothing is assumed.
- [x] Decisions to settle (minimum list - more may surface):
  - Auth library & session strategy (DB sessions vs JWT).
  - Where route protection lives (middleware, server layouts, both).
  - How "first-time vs returning" is determined.
  - Data model: User / Account / Session / Movie / Fact - movie as a column vs table; fact keyed to user+movie how.
  - Movie validation rules (min/max length, allowed characters) and shared validator.
  - Variant A cache-window implementation (DB time vs app time).
  - Variant A burst protection approach (one of the four).
  - OpenAI: model, prompt, timeout, max tokens, error mapping.
  - Rendering split: Server Components vs client components on the dashboard (given B's client cache).
  - Variant B: API response/error envelope shape; client cache mechanism; "new fact" behavior vs server 60s window.
  - Testing stack (unit / integration / component) and test DB strategy.
  - Hosting: app host + Postgres provider.
  - UI design direction.
- [x] Each decision logged as an ADR-style entry: context · options · choice · why · consequences.
- [x] `architecture.md`: system context, components, data model, request flows (login, onboarding, dashboard, fact fetch with both cache layers, edit movie), security model, failure modes.
- **Gate:** owner approves both docs.

### Step 4 - Specification → `srs.md`

- [ ] Functional requirements with IDs, each traceable to §5 above.
- [ ] Non-functional: security, performance, reliability, accessibility basics.
- [ ] API contracts (request/response/error types) for all endpoints.
- [ ] Data schema, validation rules, state machines (fact fetch, edit flow).
- [ ] Acceptance criteria per requirement.
- **Gate:** owner approves; no open load-bearing questions.

### Step 5 - Build plan → `plan.md`

- [ ] Phased plan derived from `srs.md` + all `dev-docs`.
- [ ] Each phase: goal, files touched, acceptance criteria, tests, verification command.
- **Gate:** owner approves.

### Step 6 - Build (phases from `plan.md`)

- [ ] Base implementation.
- [ ] Variant A + tests.
- [ ] Variant B + tests.
- [ ] Each phase verified before moving on.

### Step 7 - Deploy & bug squash

- [ ] Deploy app + Postgres; configure Google OAuth redirect URIs and env vars for production.
- [ ] Run full manual pass on production (§5 checklist) + all tests.
- [ ] Fix every bug found at root cause; re-verify.

### Step 8 - Documentation & demo

- [ ] README (all §5.8 items).
- [ ] AI-usage note.
- [ ] 3 to 5 min walkthrough video script + recording.

---

## 7. Output files (dev-docs/)

| File                 | Step | Purpose                             |
| -------------------- | ---- | ----------------------------------- |
| `epic.md`            | 0    | This checklist                      |
| `research.md`        | 1, 2 | Market research + flaw analysis     |
| `design-decision.md` | 3    | Owner's decisions, ADR format       |
| `architecture.md`    | 3    | System architecture                 |
| `srs.md`             | 4    | Software requirements specification |
| `plan.md`            | 5    | Phased build plan                   |

Code lives at the repo root; `.claude/` is untouched.

## 8. Open decisions

All decisions are settled and recorded in `design-decision.md` (D1 to D30). UI direction is approved: ticket stub on the DESIGN.md system, mockups in `design/mocks/`.

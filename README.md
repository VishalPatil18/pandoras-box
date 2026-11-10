# Pandoras Box

Pandoras Box is a small full-stack web app built as a take-home exercise. You sign in with Google, name your favorite movie, and get a piece of AI-generated trivia about it. Ask for another fact once a minute.

> **Status:** planning and design are done. Application code hasn't been written yet. This README will grow setup, migration and run instructions as the app is built.

## What it does

- **Landing:** sign in with Google.
- **Onboarding:** first-time users name one favorite movie, validated on the server.
- **Dashboard:** your Google name, email and photo, your movie, and an AI fact shown on a movie-ticket card. You can edit the movie inline.
- **Facts:**
  - The server reuses a fact for 60 seconds and makes sure two tabs never trigger two OpenAI calls.
  - If OpenAI fails, it falls back to your last fact.
  - The browser reuses a fact for 30 seconds.

## Variant choice

The exercise asks for one of two extensions. **Variant A (backend caching and correctness) is the chosen variant.** The reason is that the interesting problem in this app is on the server: making "at most one fact per minute" hold when several requests arrive at once, across more than one server, without holding a database lock during a slow OpenAI call.

**Variant B (typed API client, optimistic inline edit, client cache) is also built, as an extra.** The two fit together as two cache layers: the browser answers first, and the server stops repeated OpenAI calls.

## Planned stack

| Concern | Choice |
|---|---|
| App | Next.js App Router (16.2.6 or later), TypeScript, React |
| Styling | Tailwind v4, shadcn, Cult UI components restyled to the project design system |
| Auth | Better Auth with Google, database sessions |
| Data | Postgres on Supabase, Prisma 7 |
| AI | OpenAI Responses API |
| Client data | TanStack Query |
| Tests | Vitest, Docker Postgres, MSW, React Testing Library |
| Hosting | Vercel |

## Repository layout

| Path | What's there |
|---|---|
| [dev-docs/epic.md](dev-docs/epic.md) | The requirements checklist and delivery plan |
| [dev-docs/research.md](dev-docs/research.md) | How similar products and common stacks handle this, and where they fall short |
| [dev-docs/design-decision.md](dev-docs/design-decision.md) | Every design decision with its options and reasoning |
| [dev-docs/architecture.md](dev-docs/architecture.md) | System design: data model, auth, the fact generation algorithm, client caching, failure modes |
| [design/DESIGN.md](design/DESIGN.md) | Visual design system (colors, type, spacing, components) |
| [design/mocks/index.html](design/mocks/index.html) | Clickable HTML mockups of every screen and state. Open it in a browser. |
| [design/icons/](design/icons/) | Rune icons used by the UI (Apache 2.0) |

## Key tradeoffs so far

- **Duplicate generation is stopped with a database lease, not a lock.** One conditional `UPDATE` claims a short "generation in progress" lease, so nothing stays locked during the OpenAI call and it works across many servers. The cost is a little more logic for the request that loses the race: it waits briefly and returns the winner's fact.
- **Login is checked next to the data, not in middleware.** Every page and API route calls one `requireUser()` function. Recent Next.js middleware bypass CVEs are the reason.
- **Rapid movie changes aren't rate limited.** A new movie always gets a fresh fact, so changing it many times in a minute costs one OpenAI call each. This is a known, documented limit.

The full list, with alternatives considered, is in [dev-docs/design-decision.md](dev-docs/design-decision.md).

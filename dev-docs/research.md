# Research: Pandoras Box

This document covers how other products and developers handle what Pandoras Box does, and where their designs fall short. Research was done on 2026-11-10.

Source labels:

- `[DOC]` means the vendor or official documentation says it.
- `[3P]` means only a third-party source says it, so check it before relying on it.
- `[INF]` is our own inference.

Nothing here is a decision. Anything marked "candidate" is an option to weigh, and the owner records the final call in [design-decisions.md](design-decisions.md).

---

# Part 1: How it's done today

## Consumer products

### Letterboxd

Each profile has four "Favorite Films" slots. You add a film with a + on an empty slot and remove it with an x, directly on the profile page. Secondary sources say new users are asked for favorites at sign-up. [DOC/3P: [MakeUseOf](https://www.makeuseof.com/tips-getting-the-most-out-of-letterboxd/), [PopSci](https://www.popsci.com/diy/how-to-use-letterboxd/)]

All of its film data comes from TMDB. [DOC: [Letterboxd support](https://support.letterboxd.com/hc/en-us/articles/15269025512847-Where-does-Letterboxd-get-its-film-data-from)] The API is available by request only, and Letterboxd points developers to TMDB directly. [DOC: [api-docs.letterboxd.com](https://api-docs.letterboxd.com/)] Favorites are probably stored as film IDs rather than free text. [INF]

Worth borrowing: editing the favorite inline on the profile, which is close to what our inline-edit requirement asks for.

### IMDb trivia ("Did you know")

IMDb trivia is written by people and ranked by votes. Its submission rules [DOC: [IMDb trivia guide](https://help.imdb.com/article/contribution/titles/trivia/G42ZNVNNQT6P78FE), [contributor tips](https://help.imdb.com/article/contribution/contribution-information/contributor-top-tips/G24YJU8YXNN2BRSY)]:

- The item has to be interesting and about the title itself.
- It is written in the third person and kept under 1,000 characters.
- Rumors are rejected, copied text is not allowed, and a source is required.
- Spoilers have to start with `SPOILER:`.
- Editors moderate submissions before they appear.

Those rules translate almost directly into instructions for an LLM: one fact, kept short, written in the third person, with no spoilers or rumors.

### TMDB (data and API)

The rate limit is around 40 requests per second, it can change, and clients have to handle `429`. [DOC: [rate limiting](https://developer.themoviedb.org/docs/rate-limiting)] The `/3/search/movie` endpoint returns `id`, `title` and `release_date`, which is enough to tell "Dune" (1984) from "Dune" (2021). [DOC: [search-movie](https://developer.themoviedb.org/reference/search-movie)]

The terms of use forbid caching data for more than six months. They also require the TMDB logo and a disclaimer, and commercial use needs a written agreement. Using TMDB content "in connection with … an AI based Application" also needs a written agreement. [DOC: [TMDB API terms](https://www.themoviedb.org/api-terms-of-use)]

TMDB could help with ambiguous titles, but that would be optional scope. Sending TMDB overview text to OpenAI probably falls under the AI clause. [INF]

### AI movie-fact and recommendation apps

Movie-Fact-Generator ([GitHub](https://github.com/tylercairney99/Movie-Fact-Generator)) is essentially the same brief, so it is the closest comparison.

- **Stack:** Next.js 15, NextAuth with Google, Prisma/Postgres and GPT-3.5-turbo.
- **Behavior:** the README says you "Get a new AI-generated fact every time you refresh the page."
- **What's missing:** it mentions error handling, but describes no fallback, no caching, no rate limiting and no edit flow. [DOC: README]

Movierecs.ai ([site](https://www.movierecs.ai/)) takes up to three movies, needs no login, uses TMDB, and shows the TMDB disclaimer. Its FAQ says it analyzes "viewing history", which contradicts its session-only design. [DOC]

MovieGPT, the 36 "movie trivia" tools on There's An AI For That, and Writecream's generator all generate text with no grounding and no visible sources. [INF; [MovieGPT](https://gptstore.ai/gpts/7HXogrBgnr-moviegpt), [There's An AI For That](https://theresanaiforthat.com/s/movie+trivia/), [Writecream](https://www.writecream.com/free-ai-movie-quote-trivia-generator/)] Jotform warns that ChatGPT trivia "can provide facts that aren't true or are outdated." [DOC: [Jotform](https://www.jotform.com/blog/chatgpt-trivia-questions/)]

Netflix has AI search in its app ([BGR](https://www.bgr.com/tech/how-to-use-netflixs-new-ai-chatbot-to-find-stuff-to-watch/)) and Tubi has an app inside ChatGPT ([kingy.ai](https://kingy.ai/news/chatgpt-tubi-ai-movie-recommendations/)). This is background only and doesn't affect how we generate facts.

## Developer patterns (as of November 2026)

### Versions

| Item | Status |
|---|---|
| Next.js | 16.4.5 is the latest. Next 15 reached end of life in October 2026. [3P: [eolrisk](https://eolrisk.com/nextjs/)] `middleware.ts` was renamed to `proxy.ts` in v16 and runs on Node.js. [DOC: [Next 16 blog](https://nextjs.org/blog/next-16)] |
| Next.js security | Use 16.2.6 or later. [CVE-2026-44575](https://www.strix.ai/cve/CVE-2026-44575) (CVSS 7.5) let `.rsc` and prefetch requests skip proxy auth, and the first fix (CVE-2026-45109) was incomplete. [DOC: [Vercel May 2026 release](https://vercel.com/changelog/next-js-may-2026-security-release)] An earlier bug, CVE-2025-29927 (CVSS 9.1), let a single header skip middleware entirely. |
| Auth.js / next-auth | v5 is still in beta (5.0.0-beta.32). The Better Auth team maintains it now, it gets security fixes only, and it recommends Better Auth for new projects. [DOC: [Better Auth security post, July 2026](https://better-auth.com/blog/security-update-july-2026)] |
| Better Auth | Active, around version 1.7. [3P] |
| Prisma | v7 is stable (7.10) and v8 is still a release candidate. v7 requires a driver adapter and moves the connection URL into `prisma.config.ts`. [DOC: [changelog](https://www.prisma.io/changelog/2026-10-02), [v7 upgrade](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)] |
| TanStack Query | v5.106. [3P] |
| OpenAI Node SDK | The Responses API (`responses.create`, `output_text`) is the documented approach. [DOC: [openai-node](https://github.com/openai/openai-node/blob/main/README.md)] The cheaper models are `gpt-5.4-nano` and `gpt-5.4-mini`. [DOC: [OpenAI](https://openai.com/index/introducing-gpt-5-4-mini-and-nano/)] |
| Vitest | 4.x. [DOC: [Prisma testing series](https://www.prisma.io/blog/testing-series-1-8eRB5p0Y8o)] |

### Auth

create-t3-app still defaults to Auth.js v5 with the Prisma adapter and database sessions. [DOC: [create.t3.gg](https://create.t3.gg/en/usage/next-auth)] The maintained alternative is Better Auth with its Prisma adapter and Google. It reads the session with `auth.api.getSession({ headers })` and has a `newUserCallbackURL` option for first sign-ins. [DOC: [Better Auth Next](https://better-auth.com/docs/integrations/next), [basic usage](https://better-auth.com/docs/basic-usage)]

The official Next.js guide [DOC: [Next auth guide](https://nextjs.org/docs/app/guides/authentication)]:

- Proxy (middleware) is for quick, optimistic checks only.
- The real check belongs in a data access layer (`verifySession()`) that pages, server actions and route handlers all call.
- Route handlers deserve the same care as public API endpoints.
- Database sessions are more secure, and stateless sessions are simpler.

### Reference starters

| Starter | Auth | Where the check happens |
|---|---|---|
| create-t3-app | Auth.js + Prisma, database sessions | tRPC `protectedProcedure` on the server [DOC] |
| create-t3-turbo | Better Auth + Drizzle | Server-side session [3P] |
| nextjs/saas-starter | Custom JWT cookies | Global middleware and also a check in each server action [DOC: [README](https://github.com/nextjs/saas-starter)] |
| Next.js auth guide | Any library | Optimistic proxy, plus a data access layer and DTOs [DOC] |

In all of them, the session check that actually protects data runs next to the data access, not just at the edge.

### Data modeling

The auth library owns the User, Account, Session and Verification tables, and the app adds its own fields to User. [DOC: create.t3.gg] Prisma 7 requires a driver adapter (`PrismaPg`). The `pg` driver has no default connection timeout, so you have to set one. [DOC: [v7 upgrade](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)] Some people report Turbopack failing to resolve the output of the new `prisma-client` generator. [3P: [buildwithmatija](https://www.buildwithmatija.com/blog/migrate-prisma-v7-nextjs-16-turbopack-fix)]

### LLM caching and deduplication

Most tutorials, and the closest comparable app, do the simple thing: look for a fact newer than 60 seconds, and if there isn't one, call OpenAI and insert the result. The research turned up five ways to stop two requests from generating at the same time:

- An in-memory lock.
- A unique constraint on a time bucket.
- `SELECT … FOR UPDATE`.
- A Postgres advisory lock inside a transaction (`pg_advisory_xact_lock`). [DOC: [PG explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)]
- A lease, which is a "generation in progress" marker with an expiry time.

Part 2 compares them.

### OpenAI SDK behavior

The SDK's defaults are a poor fit for a page that's waiting on the call. [DOC: [openai-node](https://github.com/openai/openai-node/blob/main/README.md), [configuration](https://github.com/openai/openai-node/blob/main/docs/configuration.md)]

- **Timeout:** 10 minutes by default.
- **Retries:** 2 by default, covering timeouts, 408, 409, 429, 5xx and connection errors.
- **Overrides:** `timeout`, `maxRetries` and an `AbortSignal` can all be set per request.
- **Errors:** they arrive as typed `APIError` subclasses.
- **Browser use:** requires a flag called `dangerouslyAllowBrowser`.

When a response hits its output cap, it comes back with `status: "incomplete"`. On reasoning models, reasoning tokens count against that cap. [DOC/3P: [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning)]

### Client data patterns

TanStack Query covers each part of the client-side fact behavior:

- `staleTime: 30_000` gives the 30-second window with no network calls while the data is fresh.
- `refetch()` handles an explicit refresh.
- `invalidateQueries` clears the cache when the movie changes.

Its documented recipe for optimistic updates [DOC: [optimistic updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)]:

1. In `onMutate`, cancel in-flight queries, take a snapshot, and set the new value.
2. In `onError`, restore the snapshot.
3. In `onSettled`, invalidate the query.

SWR's `dedupingInterval` (2 seconds by default) is a different thing from `staleTime`, so it can't serve as a 30-second cache. [3P: [pkgpulse](https://www.pkgpulse.com/guides/tanstack-query-vs-swr-2026)] Client components can't call the data access layer. The server fetches the data and passes it down as props. [DOC: Next auth guide]

### Testing

Prisma's testing series mocks the client with `vitest-mock-extended`. [DOC: [Prisma testing](https://www.prisma.io/blog/testing-series-1-8eRB5p0Y8o)] A mock accepts data that a real database would reject. [3P: [codepunkt](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/)] Real-database setups usually run Testcontainers or docker Postgres, apply migrations with `prisma migrate deploy`, and truncate tables between tests. [3P: [alexrusin](https://blog.alexrusin.com/testcontainers-for-postgres/)] Vitest can't render async Server Components, and Next recommends end-to-end tests for those. [DOC: [Next Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest)] MSW v2 mocks network calls inside Vitest. [DOC: [MSW](https://mswjs.io/api/setup-server)]

### Hosting

Vercel Postgres is gone, and new databases come from the Vercel Marketplace (Neon, Prisma Postgres, Supabase). [DOC: [Vercel](https://vercel.com/docs/postgres)] On Fluid compute, the documented setup is a module-scope `pg.Pool`, `attachDatabasePool`, and `PrismaPg(pool)`. [DOC: [Prisma deploy to Vercel](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel), [Vercel KB](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute)] The app uses the pooled URL at runtime, and migrations use the direct URL. [3P: [Neon](https://neon.com/docs/guides/vercel-connection-methods)]

---

# Part 2: Flaws, and how Pandoras Box can avoid them

Each flaw comes with candidate fixes sized for this brief. A fix marked "over-engineering" is something we would choose not to build, since the brief says clean engineering beats over-engineering.

## Generation cost and correctness

### F1. A new LLM call on every refresh

Movie-Fact-Generator and the trivia wrappers do this. Cost has no ceiling, and a user can spam refresh. Variant A exists to fix exactly this.

Candidate fixes:

- The 60-second server cache keyed by user and movie, which the brief requires.
- The 30-second client cache from Variant B.
- Optionally, a cooldown on the "new fact" action.

Over-engineering: rate limiting backed by Redis.

### F2. Two tabs both generate (check-then-act race)

The simple pattern looks for a recent fact and, finding none, calls OpenAI. Two requests that arrive together can both find nothing and both pay for a generation. This is what Variant A's burst protection requirement is about. Here are the brief's four approaches plus the two the research found:

| Approach | Works? | Problem |
|---|---|---|
| In-memory lock | Only on a single server | Serverless and multi-instance hosts don't share memory, so in production it quietly stops working. [INF] The brief accepts it if the limitation is documented. |
| Unique constraint per user per 60-second window | Partly | It prevents the duplicate row, not the duplicate OpenAI call, so both requests still pay. Wall-clock buckets also break the "under 60 seconds old" rule: a fact made at :59 and a request at :01 land in different buckets. [INF] |
| `SELECT … FOR UPDATE` | Partly | It can only lock rows that already exist. If the user has no fact yet, there's nothing to lock, so you end up locking the User row instead. [INF, from [PG docs](https://www.postgresql.org/docs/current/explicit-locking.html)] |
| Transaction guard / advisory lock | Yes | The transaction and its pooled connection stay open for the whole OpenAI call. Prisma interactive transactions time out at 5 seconds by default (with a 2-second wait for a connection), and Prisma's docs advise against network calls inside them. [DOC: [Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)] Session-level advisory locks also leak under PgBouncer. [3P: [viprasol](https://viprasol.com/blog/postgres-advisory-locks/)] |
| Lease ("generation in progress" with an expiry) | Yes | It needs an expiry so a crashed request can't hold the lease forever. We also have to decide what the request that loses the race gets back. It holds no transaction during the OpenAI call and works behind a connection pooler. [INF] |

Candidates: the lease and the advisory lock both hold up. The other three come with flaws we would have to explain away.

### F3. Inconsistent clocks

If each server checks the 60-second window against its own `Date.now()`, clock drift between instances makes the window longer or shorter. Candidate fix: compare against the database's `now()`, which is the same clock for every instance. [INF]

### F4. No fallback when the LLM fails

Movie-Fact-Generator mentions error handling but never describes a fallback. With the SDK's defaults (a 10-minute timeout and two retries), an OpenAI outage leaves the dashboard hanging. [DOC]

Candidate fixes:

- Set a short explicit timeout and a low retry count.
- On failure, return the most recent fact for this user and movie regardless of age, marked as possibly stale.
- If there is no earlier fact, show a friendly error with a way to retry.

### F5. Facts that are made up, repeated, or full of spoilers

Every AI trivia app has this problem because nothing grounds the output.

Candidate fixes:

- Use IMDb-style rules in the prompt: one fact, short, third person, no spoilers, only well-documented facts.
- Show an "AI-generated, may be inaccurate" label.
- Optionally, pass the previous fact in so the model avoids repeating it.

Over-engineering: retrieval with citations, or deduplicating facts with embeddings.

### F6. Prompt injection through the movie title

The title is text the user controls, and it goes into a prompt (OWASP LLM01). [DOC: [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)] The damage is limited here because the model has no tools and no secrets in its context.

Candidate fixes:

- Validate the title's length on the server.
- Pass the title as delimited data in the user input, never inside the system instructions.
- Cap and trim the output, and render it as plain text.

Over-engineering: moderation API calls or classifier models.

### F7. Ambiguous titles ("Dune")

The model may pick a different film than the user meant. Candidate fixes:

- Have the prompt ask the model to name the year it assumed.
- Optionally, add a year field to the form.
- Optionally, use TMDB search, though its AI clause applies.

## Auth and authorization

### F8. Checking auth only in middleware

Many tutorials put the auth check only in middleware. CVE-2025-29927 and CVE-2026-44575 both skipped it entirely. The fix the official Next.js guide recommends is a server-only data access layer with a `requireUser()` function. Every page and every API route calls it. Proxy is then only for optional redirects that improve the user experience.

### F9. Trusting a user ID sent by the client

An endpoint like `GET /api/fact?userId=…` lets one user read another user's data (an IDOR bug). Candidate fix: endpoints never take a user ID. The identity always comes from the session, so cross-user access can't happen, and a test proves it (Variant A requires one).

### F10. Deciding onboarding from a "first sign-in" event

If `newUserCallbackURL` alone decides who sees onboarding, a user who signs up and closes the tab comes back as a "returning" user with no movie. Candidate fix: decide from the data. A user with no favorite movie goes to onboarding. Once a movie exists, `/onboarding` redirects to `/dashboard`.

### F11. Sessions that can't be revoked

JWT sessions can't be revoked on the server. Better Auth's `cookieCache` keeps a revoked session valid until the cache expires ([GHSA-fvxx-76fc-893x](https://github.com/better-auth/better-auth/security/advisories/GHSA-fvxx-76fc-893x)). Candidate fix: database sessions with the cookie cache turned off, so logging out really ends the session.

### F12. Auth library maturity

Auth.js v5 is still in beta, gets security fixes only, and had a fail-open middleware bug that wasn't fixed until beta.32. Candidates: Better Auth, or Auth.js v5 pinned to a version with the reason written down in the README.

## Frontend and API

### F13. A stale client cache after the movie changes

This is the classic invalidation bug. Candidate fix: key the client fact cache by movie, invalidate it when a movie edit succeeds, or both. The server cache key already includes the movie, so a new movie misses it automatically.

### F14. A "new fact" button that seems to do nothing

Variant A says a request inside the 60-second server window returns the same fact. To the user, the button looks broken. This is a product call where the A and B rules meet. Candidates:

- (a) Show when the fact was generated and explain the window.
- (b) Let an explicit refresh skip the server cache, with the burst guard still in place.
- (c) Disable the button until the server window has passed.

### F15. Untyped fetch calls and ad-hoc error handling

Each component ends up handling 401 and 500 its own way, and the response shapes drift apart between server and client. Candidate fix:

- One typed request function in `lib/api.ts` that throws a single `ApiError` type.
- Request and response schemas (Zod, for example) shared by the route handlers and the client.

### F16. Optimistic updates without a full rollback

Two things go wrong when rollback is incomplete. The UI can keep showing a movie the server rejected, or a background refetch can overwrite the optimistic value. Candidate fix: TanStack's documented sequence. Cancel in-flight queries, take a snapshot, set the new value, restore the snapshot on error, then invalidate. [DOC: TanStack]

### F17. A 30-second clock that starts at the wrong time

If the server-rendered fact goes into the client cache without its real timestamp, the 30 seconds start counting from page load instead of from when the fact was generated. Candidate fix: seed the client cache with the fact's actual creation time. [INF]

## Operations and testing

### F18. Running out of database connections on serverless

This is common in Prisma-on-Vercel setups. Candidate fixes:

- Use the pooled database URL at runtime and the direct URL for migrations.
- Create the pool once per module.
- Set a connection timeout explicitly, because `pg` has none by default.

### F19. Testing concurrency with mocks

A mocked Prisma client can't prove that a guard in SQL works. Candidate fix: run the cache and concurrency tests against a real Postgres in docker and mock only OpenAI. For example, five parallel requests should produce exactly one OpenAI call.

### F20. End-to-end tests through real Google OAuth

These are brittle and slow. Candidate fix: test the server logic directly. If an end-to-end test is wanted, seed a session instead of going through Google.

---

## Summary: Pandoras Box compared with the closest existing app

| | Movie-Fact-Generator | Pandoras Box (candidate direction) |
|---|---|---|
| LLM calls | One per refresh | At most one per user and movie every 60 seconds, plus a 30-second client cache |
| Concurrency | Unprotected | One guard in SQL (lease or advisory lock, owner's choice) |
| LLM failure | Shows an error | Short timeout, falls back to the last fact, otherwise a friendly error |
| Auth checks | Middleware and session | Data access layer on the server, called from every page and route |
| Cross-user access | Not addressed | Impossible by design, with a test |
| Client state | Ad hoc | Typed API client, query cache, optimistic update with rollback |
| Fact quality | No constraints | IMDb-style rules in the prompt and an AI label |

Left out on purpose because they'd be over-engineering here: Redis, queues, retrieval with citations, moderation pipelines, embedding deduplication, TMDB integration, retry loops under `SERIALIZABLE`, the Prisma 8 release candidate, and end-to-end tests through real Google OAuth.

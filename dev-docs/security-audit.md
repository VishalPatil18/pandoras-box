# Security audit

**Date:** 2026-11-10
**Source:** branch `phase5-bug-squash-security-audit-and-release`, based on `18146ba`
**Scope:** the whole repository. App code (`app/`, `components/`, `lib/`), the Prisma schema and migrations, `next.config.ts`, the CI workflow, `docker-compose.yml`, and the production dependency tree.
**Not in scope:** the live Vercel, Supabase, Google and OpenAI settings. The repo can't show them, so they're listed under [Deploy-time checks](#deploy-time-checks) with the exact fact the owner has to confirm.

## Summary

| ID | Finding | Status | Severity | Fixed in |
|---|---|---|---|---|
| F1 | One account can run up unlimited OpenAI calls by switching movies | Confirmed | Medium | `lib/facts.ts`, `lib/errors.ts` |
| F2 | Session tokens and Google OAuth tokens readable through Supabase's Data API | Needs validation | High if the Data API is on | New RLS migration |
| F3 | Any site can frame the app (clickjacking) | Confirmed | Low | `next.config.ts` |
| F4 | Local dev database listens on every network interface with public credentials | Confirmed | Low | `docker-compose.yml` |
| F5 | CI token has no explicit permission scope | Confirmed | Informational | `.github/workflows/ci.yml` |
| F6 | Two advisories in the shadcn CLI's dependencies | Not reachable at runtime | Informational | No change |
| F7 | Better Auth's rate limiter keeps its counters in memory | Confirmed | Informational | No change |

Every fix ships with a test or a check that was run. See [Verification](#verification).

## Method

1. Mapped the trust boundaries: the browser and the API routes, the session cookie and Better Auth, the app and Postgres, the app and OpenAI, and the repo and CI.
2. Read every route handler, the data access layer, the fact service, the OpenAI wrapper, every page guard, and every client component that renders user or model data.
3. Searched for risky sinks: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, dynamic `href` and `src`, raw SQL, `window.location`, `NEXT_PUBLIC_`, and logging.
4. Read Better Auth 1.7.18's own source for the defaults this app depends on: `/update-user` field filtering, secret validation, and the rate limiter.
5. Checked secret hygiene: `.gitignore`, git history for `.env` files, and a pattern search for OpenAI, Google and Supabase credentials across all commits.
6. Ran `pnpm audit --prod`.
7. Ran each fix's check locally against Docker Postgres and a production build. Nothing touched a deployed service.

## Findings

### F1: One account can run up unlimited OpenAI calls by switching movies

**Severity:** medium. **Status:** confirmed, fixed. Supersedes the accepted risk in D18.

**Boundary.** A signed-in user against the owner's OpenAI budget. The 60 second window is meant to cap a user at one call a minute (NFR-PERF-3, "Ask for another fact once a minute").

**Path.** `findFreshFact` in [lib/facts.ts](../lib/facts.ts) matches on `(userId, movieKey)`. `PUT /api/me/movie` has no limit. So this loop makes one OpenAI call per pass, as fast as each call returns:

1. `PUT /api/me/movie` with `{ "movie": "Title 1" }`, then `"Title 2"`, and so on.
2. `GET /api/fact`. No fresh fact exists for the new key, so the request takes the lease and calls OpenAI.

The lease only stops overlapping calls for one user, not back to back calls. Each new Google account adds another loop. Parallel requests also hold Vercel functions open for up to 9 seconds while they poll.

**Result.** The owner pays for every call. Once the OpenAI project hits its limit, every user's fact requests fail and fall back.

**Fix.** FR-LIMIT-1. While holding the lease, and before calling OpenAI, `generateAndStore` counts the user's facts from the last 10 minutes across all movies, using the database clock. At 20 or more it skips OpenAI. It serves the last fact for this movie as `fallback`, or returns `429 RATE_LIMITED` with "You've asked for a lot of facts. Try again in a few minutes." when there isn't one.

- The count runs under the lease, so concurrent requests from one user can't race past it.
- 20 per 10 minutes is twice what normal use needs: one movie refreshed every minute makes 10.
- The ceiling drops from about one call every 2 to 8 seconds per account (450 to 1,800 an hour) to 120 an hour.
- The fact table already records every generation, so there's no new table or dependency.

**Remaining risk.** Someone with many Google accounts still multiplies the ceiling. The OpenAI project budget limit (DEP-5) is the backstop.

**Test.** `tests/backend/facts-rate-limit.test.ts` (T-A9): at the cap with no fact for the movie it throws `RATE_LIMITED` and makes no OpenAI call; at the cap with an earlier fact it returns `fallback`; below the cap it generates, and facts older than 10 minutes don't count.

### F2: Session tokens and Google OAuth tokens readable through Supabase's Data API

**Severity:** high if the Data API exposes `public`, none otherwise. **Status:** needs validation, fixed in source anyway.

**Boundary.** Anyone holding the Supabase project URL and its `anon` key, against every user's account.

**Path.** Prisma creates all tables in the `public` schema. The init migration doesn't enable row level security. On Supabase, the Data API (PostgREST) serves `public` tables to the `anon` and `authenticated` roles. Without RLS, those roles can read every row:

- `session.token`: every live session token. Better Auth signs the cookie with `BETTER_AUTH_SECRET`, so a raw token alone doesn't sign anyone in, but one leaked secret would turn this table into account takeover.
- `account.accessToken`, `account.refreshToken` and `account.idToken`: Google OAuth tokens, stored in plain text by Better Auth.
- `user`: every name and email address.

This app never ships the `anon` key, but Supabase treats that key as public. It's meant to sit in browser code.

**Missing fact.** Whether this project's Data API is on and exposes `public`. That's a dashboard setting outside the repo.

**Fix.** Migration `20261110200000_enable_rls` enables RLS on all six tables, including `_prisma_migrations`, with no policies. With no policies, the `anon` and `authenticated` roles get zero rows. Prisma connects as the role that owns the tables, and owners bypass RLS, so the app is unaffected locally and on Supabase. Deploy step 3 also turns the Data API off, so two independent controls cover it (ADR-043).

**Test.** `tests/backend/db.test.ts` (T-A10) asserts that no table in `public` has RLS off. The full backend suite passes with RLS on, which shows the owner bypass works.

### F3: Any site can frame the app

**Severity:** low. **Status:** confirmed, fixed.

**Path.** No response set `X-Frame-Options` or a `frame-ancestors` policy. A hostile page could load `/dashboard` in a transparent iframe and trick a signed-in user into clicking Log out or New fact.

**Result.** A forced sign-out or a fact refresh. Changing the movie needs typing, so it isn't practical through framing. That keeps this low.

**Fix.** `next.config.ts` sends these headers on every route (NFR-SEC-8):
- `Content-Security-Policy: frame-ancestors 'none'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

A full script CSP was left out. Next.js injects inline scripts, so it would need per-request nonces and dynamic rendering everywhere, which is a bigger change than this finding justifies.

**Check.** A production build served with `next start` returned all four headers on `/` and on `/api/fact`.

### F4: Local dev database listens on every network interface

**Severity:** low. **Status:** confirmed, fixed.

**Path.** `docker-compose.yml` published `5433:5432`, which Docker binds to `0.0.0.0`. The login is `pandoras:pandoras`, and it's in the repo. Anyone on the same network, such as café Wi-Fi, could connect to a developer's database. That database can hold real session rows and Google tokens after a local sign-in.

**Fix.** Bind to loopback only: `127.0.0.1:5433:5432`.

**Check.** After `docker compose up -d`, `docker compose port db 5432` printed `127.0.0.1:5433`.

### F5: CI token has no explicit permission scope

**Severity:** informational. **Status:** confirmed, fixed.

**Path.** `.github/workflows/ci.yml` had no `permissions` block, so `GITHUB_TOKEN` got the repository's default scope. That default is write access on older repositories and some organization settings. The workflow uses no untrusted event fields, so there's no injection path today. This only limits damage if a dependency's install script ever turns hostile.

**Fix.** `permissions: contents: read` at the top level.

### F6: Two advisories in the shadcn CLI's dependencies

**Severity:** informational. **Status:** not reachable at runtime, no change.

`pnpm audit --prod` reports:
- `minimatch` (moderate, GHSA-g3hv-75wg-m249) via `shadcn > ts-morph`;
- `deepmerge` (low, GHSA-gcqx-w48m-w2h4, no patched version) via `shadcn`.

`shadcn` sits in `dependencies` because `app/globals.css` imports `shadcn/tailwind.css` at build time. The app never runs the CLI code that pulls in these packages, so no request reaches them.

### F7: Better Auth's rate limiter keeps its counters in memory

**Severity:** informational. **Status:** confirmed, no change.

Better Auth turns its rate limiter on in production, with `storage: "memory"` unless secondary storage is configured. On Vercel each function instance keeps its own counters, so the limit is per instance, not global. The only Better Auth endpoints this app uses are Google sign-in, sign-out and get-session. None of them takes a password or sends email, so there's nothing to brute force. A shared store would be the fix if email or password sign-in is ever added.

## Checked and found safe

| Area | What was checked | Result |
|---|---|---|
| Access to other users' data | Every route takes the user only from the session (`withUser` then `requireUser`). No route or service accepts a user ID. | Safe. Covered by T-A7. |
| SQL injection | Every raw query in `lib/facts.ts` uses Prisma's tagged template, which sends values as parameters. | Safe. |
| XSS | Fact text, the movie title, the name and the email all render as React text. There's no `dangerouslySetInnerHTML` or `innerHTML` anywhere. The avatar `src` comes from the user's own Google profile and only that user sees it. | Safe. |
| Open redirect | The sign-in `callbackURL` is fixed. The landing page builds its redirect from fixed strings. `?toast=` is checked against an allowlist. | Safe. |
| CSRF | The session cookie is `SameSite=Lax`. `PUT /api/me/movie` with a JSON body needs a CORS preflight, which a cross-site form can't send. Better Auth checks the `Origin` header on its own POST endpoints. | Safe. |
| Writing protected fields through Better Auth | `/api/auth/update-user` writes only `name`, `image` and declared `additionalFields`. This app declares none, so `favoriteMovie` and the lease columns can't be set that way (checked in `better-auth/dist/db/schema.mjs`). A user can rename themselves, but only they see it. | Safe. |
| Prompt injection | The movie title goes into the prompt as quoted data with an instruction to ignore commands inside it. Even if it worked, the output only reaches the user who typed the title, and it renders as text, length checked by Zod. | No cross-user impact. |
| Secrets | `.env` and `.env.*` are gitignored. No `.env` file appears in git history. No OpenAI, Google or Supabase credential pattern appears in any of the 19 commits. Every module that reads a secret imports `server-only`. | Safe. |
| Weak auth secret | Better Auth 1.7.18 throws at startup in production when `BETTER_AUTH_SECRET` is missing or left at its default, and warns when it's under 32 characters. | Safe if set as in the deploy steps. |
| Error leakage | `withUser` logs unexpected errors on the server and returns a generic `INTERNAL` message. OpenAI failures are logged and never forwarded. | Safe. Covered by `tests/backend/http.test.ts`. |

## Deploy-time checks

The repo can't show these. Each one is a step in the deploy guide.

| Check | Why | How to confirm |
|---|---|---|
| Supabase Data API off, or `public` not exposed | Second control for F2 | Supabase dashboard, Project Settings, Data API |
| RLS on for every table | First control for F2 | Supabase Table Editor shows no "RLS disabled" warnings after `prisma migrate deploy` |
| OpenAI project monthly budget set | Backstop for F1 across many accounts | OpenAI dashboard, project limits |
| `BETTER_AUTH_SECRET` is 32 or more random bytes, different from local | Signs every session cookie | Generated with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` is the exact production origin | Better Auth trusts only this origin, and the Google callback is built from it | Vercel env vars |
| Google OAuth redirect URIs list only the localhost and production callbacks | Stops redirects to other hosts | Google Cloud Console |

## Verification

All run locally on 2026-11-10:

- `pnpm test`: 18 files, 81 tests passed, including the four new ones.
- `pnpm typecheck` and `pnpm lint`: clean.
- `pnpm build`: succeeded.
- `prisma migrate deploy` and `prisma migrate status` on the dev database: applied, schema up to date.
- `next start` on the production build: all four security headers present on `/` and `/api/fact`.
- `docker compose port db 5432`: `127.0.0.1:5433`.

## Limits of this audit

- One reviewer, one pass. No previous audit exists to compare against.
- No deployed service was probed. F2's severity depends on a setting the repo can't show.
- Dependency checks rely on `pnpm audit` advisory data as of the audit date.

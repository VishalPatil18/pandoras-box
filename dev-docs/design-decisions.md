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

**Status.** Superseded by ADR-042.

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

## ADR-032: Turn off Cache Components

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** The Next.js 16.4 template turns on `cacheComponents` and `partialPrefetching`. With them on, reading the session cookie outside `<Suspense>` is a build error, so page guards could only redirect after a static shell had already streamed.
- **Options:** A / turn both off and redirect on the server before rendering. B / keep them on and wrap every session read in `<Suspense>`. C / keep them on and opt every page out with `export const instant = false`.
- **Decision:** A. `cacheComponents: false` in `next.config.ts`. `partialPrefetching` is removed too, because Next rejects it without `cacheComponents`.
- **Why:** Every page in the app is specific to the signed-in user, so there's no shared shell worth caching. Server redirects keep the guard table in architecture §5 exactly as written, with no flash of the wrong page.
- **Consequences:** No static-shell prefetching. The Next docs say both features will be on everywhere in the next major release, so upgrading to Next 17 means adopting the Suspense pattern (option B).

## ADR-033: Reasoning effort is "none", not "minimal"

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** D15 asked for `gpt-5.4-mini` with reasoning effort "minimal", so the output cap goes to the fact. OpenAI's model page lists the supported values as `none` (default), `low`, `medium`, `high` and `xhigh`. "minimal" isn't one of them for this model.
- **Options:** A / use `none`. B / use `low`. C / change the model to one that accepts `minimal`.
- **Decision:** A. `reasoning: { effort: "none" }`.
- **Why:** It's what D15 intended: no reasoning tokens, so all 150 output tokens go to the fact. The owner approved it.
- **Consequences:** Trivia relies on the model's knowledge without a reasoning pass. If facts come back thin, `low` is the next step up, at some cost in tokens and latency.

## ADR-034: Use Cult UI only where it fits the design system

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** D28 mapped eight Cult UI components to the UI. Their registry entries add about 2,900 lines plus `motion`, `sonner` and `@radix-ui/react-use-controllable-state`. The `halo-*` components are built around glow, gradient and blur effects (up to 44 halo and 37 gradient references each), all of which DESIGN.md bans. `cutout-card` is an image card with a corner cut, not a ticket.
- **Options:** A / install all eight and strip them. B / adopt only the components that fit and build the rest from the approved mockup. C / no Cult UI.
- **Decision:** B. `rolling-number` drives the countdown digits. `collab-avatar` is adapted into `Avatar`, keeping its initials logic and entrance motion, adding a photo with an initials fallback, and using flat sticker styling. The shadcn `button` is restyled. The field, badge, toast, ticket and inline editor are small components written to match `design/mocks/`.
- **Why:** It keeps Cult UI where it adds behavior and avoids vendoring effects the design system forbids. The owner chose B.
- **Consequences:** The only new runtime dependency is `motion`. The components that would have come from Cult UI are about 300 lines of our own code to maintain.

## ADR-035: Photo-framed landing page and a centered app column

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** The owner reviewed the running app and gave a reference image for the landing page, plus feedback: the box logo meant nothing, the account area looked awkward, and the dashboard stretched edge to edge.
- **Options:** A / keep the DESIGN.md sticker landing (Sky Wash, marquee, no photography). B / follow the owner's reference.
- **Decision:** B.
  - **Landing:** one rounded frame filled by the painting `public/landing-bg.jpg`, sized to the viewport with no scrolling. It has a white wordmark over the ribbon, two stickers, a white tagline, a hand-lettered Sign in button (Gochi Hand, loaded through `next/font`), and a translucent footer with Sign in, Docs, Changelog and Github links plus "Built by Vishal" linked to vishalpatil.tech.
  - **Removed:** the marquee, the box logo and the third sticker.
  - **Dashboard and onboarding:** content sits in a centered 1200px column, and a small text wordmark replaces the box.
  - **Account controls:** photo, name, email and Log out form one joined pill. On phones it collapses to the photo plus a log-out icon.
- **Why:** The owner's direction.
- **Consequences:**
  - DESIGN.md's "no photography" and "marquee" rules no longer apply to the landing page. The app screens keep the DESIGN.md system.
  - The painting carries a "WARMCORNER AI" mark, which stays as the artist's credit.
  - A third font adds one small request, on the landing page only.

## ADR-036: Full-bleed landing and a waving Ember strip

- **Date:** 2026-11-10 **Status:** accepted (refines ADR-035)
- **Context:** In a second review, the owner asked for the photo to reach every edge, a strip that is visible on the painting and spans the full width, motion on the strip and stickers, and the plain UI font on Sign in.
- **Options:** none; these were the owner's direction.
- **Decision:**
  - **Frame:** removed. The image fills the viewport.
  - **Strip:** full width and Ember with a dark outline. Its curve morphs between two shapes on a 7 second mirrored loop with `motion`.
  - **Stickers:** they bob on the same period (`animate-float`). The clapperboard sticker is now Mint so it stands apart from the strip.
  - **Sign in:** set in General Sans, and the Gochi Hand font is removed.
- **Why:** Owner feedback on the running app.
- **Consequences:**
  - The ribbon's grain filter is gone, because re-rendering `feTurbulence` on a moving path every frame is expensive.
  - Both animations stop when the user prefers reduced motion.

## ADR-037: notch-toast for notifications, and a printing ticket

- **Date:** 2026-11-10 **Status:** accepted (replaces the hand-built Toast from ADR-034)
- **Context:** The owner asked for toasts on sign-in, sign-out, onboarding, fact generation start and end, and errors, using notch-toast (`position="top-center"`, `mode="attached"`, `animation="gooey"`, 5 second duration). They also asked for the whole ticket, not just the button, to show that a fact is generating, and for a richer ticket.
- **Options:** none; the owner named the library and the settings.
- **Decision:**
  - **Toast library:** `notch-toast` 0.2.0 (MIT, peers React 19 and motion 14, no dependencies of its own) is pinned. `<NotchToaster>` lives in `Providers`.
  - **One module:** every call goes through `lib/notify.ts`, which applies `duration: 5000`. The custom `components/ui/toast.tsx` is deleted.
  - **Cross-page toasts:** messages that span a full page load travel as `?toast=<key>`, and only the whitelisted keys in `FLASH_MESSAGES` are shown. `FlashToast` shows the toast and strips the flag. The landing page forwards `signed-in` to wherever it redirects.
  - **Fact toasts:** "Generating a new fact" on New fact or a movie change, "New fact ready" for `generated` or `shared` results, a warning for `fallback`, an error for failures. A `cache` result dismisses a pending loading toast.
  - **Ticket while generating:** the whole ticket rocks (`animate-ticket-print`), the perforation's dashes march (`animate-perforate`), the stub title pulses, and the body reads "Printing a new fact".
  - **Ticket details:** an inner keyline frame, the "Title (Year)" prefix pulled out as the heading line, a divider above the meta row, and a barcode on the stub derived from the title.
- **Why:** The owner's direction.
- **Consequences:**
  - The library is young: version 0.x, one maintainer, and two releases. It's pinned exactly, and the wrapper means swapping it touches one file.
  - It renders one toast at a time, so a newer toast replaces an older one.

## ADR-038: Animated title replaces the strip; ticket stub reorder

- **Date:** 2026-11-10 **Status:** accepted (supersedes the strip and stickers from ADR-036)
- **Context:** The owner asked to drop the landing strip and stickers and animate the "Pandoras Box" title instead (with motion), to remove the ticket's second border, and to put the barcode above the movie name at a shared width.
- **Options:** none; the owner's direction.
- **Decision:**
  - **Title entrance:** `components/landing/hero-title.tsx` animates each letter out of a clipped line with a springy settle and slight tilt, staggered, "Pandoras" first and then "Box". The tagline fades up after.
  - **Title hover:** a letter lifts on hover. Nothing loops.
  - **Title semantics:** the `<h1>` keeps `aria-label="Pandoras Box"`, and the letter spans are hidden from screen readers.
  - **Removed:** `ribbon.tsx` and the float animation.
  - **Ticket:** the inner keyline is removed.
  - **Stub:** the barcode draws along the stub's direction (bars in a row on phones, stacked on desktop) and sits above the title. Both live in one wrapper sized by the title, so they always share a width. On desktop, long titles wrap into extra vertical columns instead of being cut off.
  - **Dashboard title (agent's call):** it steps down in size for long titles, so the ticket stays in view and words don't break mid-word.
- **Why:** The owner's direction. The title scaling fixes a problem a long title showed in testing.
- **Consequences:** The landing page has one authored motion moment, the entrance, plus hover. Reduced motion shows the title already in place.

## ADR-039: New fact button inside the ticket, barcode beside the name

- **Date:** 2026-11-10 **Status:** accepted (refines ADR-038)
- **Context:** The owner asked for a 40% taller landing footer, a better-placed and animated New fact button, the barcode left of the movie name (per a reference screenshot), and a smaller ticket.
- **Options:** none; the owner's direction.
- **Decision:**
  - **Footer:** vertical padding goes from 16/20px to 31/37px.
  - **Ticket:** a smaller fact font and padding, a narrower stub, no forced minimum height, and a smaller stub title (34px, or 26px for long names).
  - **Barcode:** on desktop it sits to the left of the name and stretches to the name's height. On phones it stays above the name.
  - **New fact button:**
    - It moves into the ticket's bottom row beside the meta.
    - It's a `motion.button` that animates its size changes, with a draining countdown ring, a pop into the ready state, a hover lift and a press squash.
    - The label crossfades between states (`AnimatePresence`), and the sparkle icon spins in when the button unlocks.
    - None of it animates under reduced motion.
- **Why:** The owner's direction.
- **Consequences:** The countdown test now waits for the exit animation of the "New fact in" label before checking the ready state.

## ADR-040: Rolling-paper ticket, colored toast icons, centered landing column

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** The owner asked for:
  - the landing title centered on phones, and a centered 1500px landing column;
  - the ticket's semicircle cutouts on mobile too;
  - a paper-roll animation while a fact generates;
  - toast icons colored by type.
- **Options:** none; the owner's direction.
- **Decision:**
  - **Landing:** header, content and the footer's contents sit in `max-w-[1500px] mx-auto`. On phones the title and tagline center horizontally and vertically.
  - **Mobile ticket:** half-circle notches at both ends of the horizontal seam.
  - **`RollingPaper`:** a `motion` value clips the fact from the left while a cylinder rides the clip edge and thickens. New fact rolls the paper left to right and shows "Printing a new fact" behind it; the result unrolls right to left. The old ticket wobble is removed.
  - **Toast icons:** styled through notch-toast's `nt-icon-<type>` classes in `globals.css`. Success is Mint green and error is red (filled dots); info is blue and warning is Sunburst yellow (glyph color).
- **Why:** The owner's direction.
- **Consequences:**
  - The roll respects reduced motion, jumping straight to the end state.
  - The toast colors depend on notch-toast's class names, so recheck them if the library is upgraded.

## ADR-041: The whole ticket rolls

- **Date:** 2026-11-10 **Status:** accepted (replaces the text-only `RollingPaper` from ADR-040)
- **Context:** The owner asked for the whole ticket, not just the fact text, to roll while a fact generates, with a polished look.
- **Options:** none; the owner's direction.
- **Decision:** `RollingTicket` wraps the entire `<article>`, body and stub together. One `motion` value drives everything:
  - a clip path that winds the ticket left to right in 0.85 s, then unwinds it right to left in 1.05 s on an ease-in-out curve;
  - a cylinder that rides the edge and thickens from 35% to 100% as paper collects;
  - an outer layer that turns Sunburst once the stub winds on;
  - a curl shadow on the paper side of the roll;
  - a gentle sway while the ticket is parked.

  The "Printing a new fact" placeholder fades in behind the rolled ticket. The first load unrolls into view.
- **Why:** The ticket is a paper object, so rolling it explains "a new one is being printed" better than a spinner.
- **Consequences:**
  - Only clip path, transform and opacity animate, so there's no layout thrash.
  - Under reduced motion the ticket and the placeholder swap with no movement.
- **Addendum (same day):**
  - **Phones roll bottom to top.** Below Tailwind's `md` breakpoint the ticket is stacked, so it winds upward into a horizontal roll parked at the top. The core is Sunburst, because the stub at the bottom winds on first.
  - **Direction detection:** `useIsDesktop()` (`useSyncExternalStore` on `matchMedia`) picks the axis. The roll element is keyed by axis so a stale `left` from the server render can't linger.
  - **Tests:** the frontend setup stubs `window.matchMedia`, which jsdom lacks.

## ADR-042: Cap OpenAI calls per user

- **Date:** 2026-11-10 **Status:** accepted (supersedes D18)
- **Context:** The security audit (F1) showed that switching movie titles skips the 60 second window, so one account could buy an OpenAI call every few seconds. D18 had accepted that as a documented limit.
- **Options:**
  - A: keep D18, and rely on an OpenAI budget limit.
  - B: cap generations per user by counting fact rows, under the lease.
- **Decision:** B. At 20 or more facts in the last 10 minutes across all movies, `getFact` skips OpenAI. It serves the last fact for the movie as `fallback`, or returns `429 RATE_LIMITED` when there isn't one. The OpenAI budget limit is still set at deploy.
- **Why:** The budget limit alone lets one user use up the month's quota and break facts for everyone. Counting the fact table needs no new table or dependency, and the lease already serializes a user's requests, so the count can't race.
- **Consequences:**
  - A sixth error code, `RATE_LIMITED`, in the contract.
  - Failed generations don't insert a row, so they don't count. Their cost is small, because they time out at 8 seconds with no retries.
  - Many Google accounts still multiply the ceiling. The budget limit covers that.

## ADR-043: Row level security on every table

- **Date:** 2026-11-10 **Status:** accepted
- **Context:** The security audit (F2) showed that Supabase's Data API can serve `public` tables to its `anon` role, and Prisma creates every table there without RLS. Session tokens and Google OAuth tokens would be readable.
- **Options:**
  - A: turn the Data API off in the dashboard only.
  - B: enable RLS with no policies in a migration, and also turn the Data API off.
- **Decision:** B.
- **Why:** A dashboard toggle isn't in the repo, so a new project or a teammate could miss it. RLS ships with the schema and a test enforces it. The app is unaffected, because the table owner bypasses RLS.
- **Consequences:**
  - Any table added later needs RLS in its own migration, or T-A10 fails.
  - If the app ever reads through Supabase's client libraries instead of Prisma, it will need real policies.

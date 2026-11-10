import type { ReactNode } from "react";

type Decision = {
  id: string;
  title: string;
  considered?: ReactNode;
  chose: ReactNode;
  why: ReactNode;
  status?: string;
};

type DecisionGroup = { title: string; decisions: Decision[] };

// Mirrors dev-docs/design-decisions.md, rewritten for readers who weren't in the room.
const GROUPS: DecisionGroup[] = [
  {
    title: "Scope",
    decisions: [
      {
        id: "D1",
        title: "Build both variants, with A as the primary choice",
        considered: "Build Variant A only, Variant B only, or both.",
        chose:
          "Both. The README names A as the variant I chose and presents B as an extra, clearly labeled.",
        why: "I wanted the submission to show both halves of full-stack work, but the brief asks for one choice and a reason. Naming A as primary answers that question directly, and the two variants stack into two cache layers instead of competing.",
      },
      {
        id: "D2",
        title: "The name",
        chose: "Pandoras Box.",
        why: "You open it and something you didn't expect comes out. That's the product.",
      },
    ],
  },
  {
    title: "Auth and access",
    decisions: [
      {
        id: "D3",
        title: "Better Auth with its Google provider",
        considered:
          "Better Auth, Auth.js v5 (still beta, security fixes only), Auth.js v4 (built for the pages router), and Supabase Auth (users in Supabase's schema, JWT sessions).",
        chose: "Better Auth with Google. Supabase is only the Postgres host.",
        why: "It's maintained, it keeps users and sessions in my own Prisma tables, and it supports database sessions. Supabase Auth would have put users outside Prisma and pushed me toward JWTs, which breaks the next decision.",
      },
      {
        id: "D4",
        title: "Database sessions, cookie cache off",
        considered: "Database sessions, or signed JWTs the server never looks up.",
        chose: "Database sessions, with Better Auth's cookie cache turned off.",
        why: "Logging out should actually log you out. Deleting the session row kills it everywhere on the next request. A JWT stays valid until it expires, and the cookie cache had a known bug that kept revoked sessions alive (GHSA-fvxx-76fc-893x). The price is one indexed lookup per request, which I'm happy to pay.",
      },
      {
        id: "D5",
        title: "Check the session next to the data",
        considered: "Middleware only, a requireUser() call in every page and route, or both.",
        chose: (
          <>
            <code>requireUser()</code> in a server-only data access layer, called by every page and
            API route. No middleware file at all.
          </>
        ),
        why: "Two middleware bypass CVEs (CVE-2025-29927 and CVE-2026-44575) showed the edge isn't a safe place for the only check, and Next's own guide recommends this pattern. One rule is also one thing to audit.",
      },
      {
        id: "D6",
        title: "First-time or returning comes from the data",
        chose:
          "No saved movie means onboarding. A saved movie means the dashboard. Each page redirects to the other when it's the wrong one.",
        why: 'A "new account" flag from the auth library breaks the moment someone signs up and closes the tab before picking a movie. They\'d come back as returning, with nothing to show.',
      },
      {
        id: "D7",
        title: "Endpoints never accept a user ID",
        chose:
          "Identity always comes from the session. No route or service takes a user ID from the client.",
        why: "If you can't name another user's ID, you can't read their data, and there's no ownership check to forget. The authorization test proves it.",
      },
    ],
  },
  {
    title: "Data",
    decisions: [
      {
        id: "D8",
        title: "The favorite movie is a column on user",
        considered: "A column, a favorites table, or a shared movie table.",
        chose: (
          <>
            A nullable <code>favoriteMovie</code> column, capped at 100 characters.
          </>
        ),
        why: "The brief has exactly one favorite per user. A separate table only pays off with several favorites or a history. A shared movie table falls apart because people type the same film in different ways.",
      },
      {
        id: "D9",
        title: "Facts are history rows",
        chose:
          "Every generated fact is a new row with the user, the title as typed, a lowercased movie key, the text and a database timestamp. The newest row for a user and movie is the cache.",
        why: "The brief says to store facts. History also gives me the fallback when OpenAI fails and a previous fact to tell the model not to repeat. The key lives in its own column because Prisma can't express a functional index.",
      },
      {
        id: "D10",
        title: "One movie title rule",
        chose:
          "Trim, collapse whitespace, reject control characters, allow 1 to 100 characters, keep the user's capitalization, compare in lowercase.",
        why: "The minimum is 1 because of Fritz Lang's M (1931). Accented and non-English titles like Amélie and 千と千尋の神隠し keep every character. The server enforces the rule; the browser only runs it for earlier feedback.",
      },
    ],
  },
  {
    title: "Fact generation (Variant A)",
    decisions: [
      {
        id: "D11",
        title: "A lease stops duplicate generation",
        considered:
          "An in-memory lock, a unique constraint per 60 second window, an advisory lock inside a transaction, or a lease.",
        chose: "A lease: one conditional UPDATE that only succeeds when no unexpired claim exists.",
        why: "An in-memory lock fails on the second server. A unique constraint stops the duplicate row but not the duplicate OpenAI call. An advisory lock holds a connection through the whole call, past Prisma's 5 second transaction limit. The lease works across servers, holds nothing during the slow part, and recovers from crashes by expiring.",
      },
      {
        id: "D12",
        title: 'The database clock decides "60 seconds"',
        chose: (
          <>
            Every comparison against the window or the lease uses Postgres <code>now()</code>.
          </>
        ),
        why: "Every server instance shares one clock, so drift between them can't stretch or shrink the window.",
      },
      {
        id: "D13",
        title: "Lease storage: expiry plus token",
        chose:
          "Two columns on user: an expiry 15 seconds out, longer than the 8 second OpenAI limit, and a random token per claim. Release only clears a matching token.",
        why: "If a request overruns its lease and someone else claims it, the late request must not clear the newer claim. One lease per user is enough, because a user has one movie at a time.",
      },
      {
        id: "D14",
        title: "8 second timeout, no retries, fall back to the last fact",
        chose:
          "The OpenAI client times out at 8 seconds with no automatic retries. A failure returns the newest saved fact for the movie, labeled as old, or a 503 when there isn't one.",
        why: "The SDK default is a 10 minute timeout with 2 retries, which would hang the dashboard through an outage. The user's own click is the retry.",
      },
      {
        id: "D15",
        title: "Model and prompt",
        chose:
          "gpt-5.4-mini by default. One fact, two sentences at most, third person, no spoilers, only documented facts, and it names the release year it assumed. The title goes in as quoted data.",
        why: "Trivia doesn't need a large model, and short output keeps each fact cheap. Naming the year lets the reader spot when the model guessed the wrong film. Quoting the title keeps a hostile title from reading as instructions.",
      },
      {
        id: "D16",
        title: "Don't repeat the last fact",
        chose: "When a previous fact exists, the prompt includes it and asks for a different one.",
        why: "Famous films tend to have one famous anecdote. Showing the model its last answer pushes it toward a different one.",
      },
      {
        id: "D17",
        title: "A waiting request shares the holder's result",
        considered:
          "Wait and share, return the old fact at once, or return 202 and make the browser retry.",
        chose:
          "Poll every 500 ms for up to 9 seconds. Return the holder's fact when it appears, take over if the lease frees up, and fall back at the deadline.",
        why: 'Two tabs showing the same fact is what "no duplicates" means to a person. Retrying the claim on every poll also fixes a subtle case: a request for a new movie doesn\'t sit behind a generation for the old one.',
      },
      {
        id: "D18",
        title: "Movie-change spam as a documented limit",
        status: "Replaced by ADR-042",
        chose: "Originally: accept that changing the movie skips the cache, and document it.",
        why: "Naming a hole felt better than a half-measure. The security audit changed my mind, because one account could buy unlimited OpenAI calls.",
      },
    ],
  },
  {
    title: "Client and API (Variant B)",
    decisions: [
      {
        id: "D19",
        title: "New fact counts down",
        considered:
          "Return the same fact with a note, let the click skip the server cache, or disable the button with a countdown.",
        chose: (
          <>
            A countdown. The server sends <code>secondsUntilRefresh</code> from database time, and
            the browser counts down from the moment the response arrived.
          </>
        ),
        why: "A click at second 20 that returns the same fact looks broken. The countdown is honest, keeps both variants' rules exactly as written, and makes every allowed click do something. Counting from arrival means a wrong client clock doesn't matter.",
      },
      {
        id: "D20",
        title: "TanStack Query for client caching",
        chose:
          "staleTime 30 seconds, refetch() for New fact, invalidation on movie change, and the documented optimistic recipe.",
        why: "Every Variant B rule is a built-in. SWR has nothing like staleTime, and plain React state would mean writing the cache and the race handling myself.",
      },
      {
        id: "D21",
        title: "One API contract, one error shape",
        chose:
          "Success returns typed data. Errors return the right status and { error: { code, message, issues? } } from a fixed set of codes. One Zod schema per endpoint is shared by the route and the browser client.",
        why: "The browser can switch on a code instead of parsing messages, and the contract can't drift between client and server because it's the same object.",
      },
      {
        id: "D22",
        title: "The server draws the profile, the browser loads the fact",
        chose:
          "The dashboard renders the profile and movie on the server and passes them in as initial data. The fact loads in the browser behind a skeleton.",
        why: "OpenAI never holds up the page, and the 30 second browser clock starts from a real response.",
      },
      {
        id: "D23",
        title: "One write path for the movie",
        chose: (
          <>
            Onboarding and inline edit both call <code>PUT /api/me/movie</code>. Old facts stay in
            history, and a capitalization-only edit counts as the same movie.
          </>
        ),
        why: "One endpoint, one validation rule, one set of tests.",
      },
    ],
  },
  {
    title: "Platform and tooling",
    decisions: [
      {
        id: "D24",
        title: "Vercel and Supabase Postgres",
        chose:
          "Vercel hosts the app. Supabase provides Postgres only: a pooled URL at runtime and a session URL for migrations.",
        why: "Both have free tiers that cover this app, and the pooler suits short serverless functions.",
      },
      {
        id: "D25",
        title: "Tests against a real Postgres",
        chose:
          "Vitest everywhere. Backend tests use a real Postgres in Docker with only OpenAI mocked. Frontend tests use MSW and React Testing Library.",
        why: "The duplicate guard lives in SQL. A mocked database can't prove that five simultaneous requests make one OpenAI call.",
      },
      {
        id: "D26",
        title: "pnpm, ESLint, Prettier and GitHub Actions",
        chose:
          "CI runs typecheck, lint, every test and the build on each push, with a Postgres service container.",
        why: "The same commands run locally and in CI, so a green check means the real suite passed.",
      },
      {
        id: "D27",
        title: "Tailwind 4 with shadcn",
        chose:
          "DESIGN.md's tokens become Tailwind theme variables, and shadcn's semantic names point at them.",
        why: "Cult UI components install through the shadcn CLI, which expects Tailwind 4, and pointing shadcn's names at the brand means no per-component overrides.",
      },
    ],
  },
  {
    title: "Design",
    decisions: [
      {
        id: "D28",
        title: "A ticket stub on a sticker-book system",
        chose:
          "Pastel bands, 1px black outlines, pill buttons, a heavy display face, no shadows or gradients. The fact prints on a ticket with a tear-off stub.",
        why: "A movie ticket is the most obvious physical object for a movie fact, and flat stickers keep the UI quick to read. Error text is black with an orange sticker, because orange text on white fails contrast.",
      },
      {
        id: "D29",
        title: "Free, self-hosted fonts",
        chose: "Bowlby One for display and General Sans for the UI.",
        why: "They're the free substitutes DESIGN.md lists for its paid faces, and self-hosting avoids a third-party request.",
      },
      {
        id: "D30",
        title: "Missing name or photo, and logout",
        chose:
          "No name shows the email prefix. No photo, or a broken one, shows initials. Name and photo refresh on each sign-in. Logout deletes the session and other tabs follow on their next request.",
        why: "Google doesn't always send a name, and a blank profile looks like a bug.",
      },
    ],
  },
  {
    title: "Decisions made while building",
    decisions: [
      {
        id: "ADR-031",
        title: "OpenAI is the one paid service",
        considered:
          "Treat OpenAI as a required exception, or swap in a free model and break the brief.",
        chose: "OpenAI stays. Hosting and the database stay on free tiers.",
        why: "The brief requires OpenAI. The cache, the lease, the small model and a 150 token cap keep each fact cheap.",
      },
      {
        id: "ADR-032",
        title: "Cache Components off",
        considered: "Turn it off, wrap every session read in Suspense, or opt every page out.",
        chose:
          "cacheComponents off, so pages read the session and redirect on the server before rendering.",
        why: "Every page here belongs to the signed-in user, so there's no shared shell worth caching, and a server redirect avoids flashing the wrong page. Next 17 will force the Suspense pattern, so this has a shelf life.",
      },
      {
        id: "ADR-033",
        title: "Reasoning effort none",
        chose: "reasoning.effort set to none.",
        why: "The plan said minimal, but gpt-5.4-mini doesn't accept it, even though the SDK types allow it. None gives all 150 output tokens to the fact.",
      },
      {
        id: "ADR-034",
        title: "Cult UI only where it fits",
        considered:
          "Install all eight planned components and strip them, adopt only the ones that fit, or skip Cult UI.",
        chose:
          "Only rolling-number for the countdown and an adapted avatar. The rest are small components built from the mockups.",
        why: "Most of the planned components were built around glow, gradients and blur, which DESIGN.md bans. Vendoring 2,900 lines to delete most of them made no sense.",
      },
      {
        id: "ADR-035",
        title: "A painted landing page and a centered app column",
        chose:
          "The landing page is a full-screen painting with the wordmark and sign-in on top. App screens sit in a centered 1200px column.",
        why: "I reviewed the running app with a reference image in hand. The box logo meant nothing, the account area looked awkward, and the dashboard stretched edge to edge on wide screens.",
      },
      {
        id: "ADR-036",
        title: "Full-bleed painting",
        chose: "The painting reaches every edge and the motion stops under reduced motion.",
        why: "On a second review I wanted the painting to reach every edge instead of sitting in a rounded frame.",
      },
      {
        id: "ADR-037",
        title: "notch-toast and a printing ticket",
        chose:
          "Toasts through one wrapper module, cross-page toasts passed as an allowlisted URL key, and a ticket that shows a fact is printing.",
        why: "Sign-in, sign-out and generation needed feedback. The allowlist means a crafted URL can't show arbitrary text, and the wrapper means swapping a young library touches one file.",
      },
      {
        id: "ADR-038",
        title: "An animated title",
        chose:
          "Each letter of the title springs into place on load and lifts on hover. Nothing loops.",
        why: "One authored moment on the landing page is enough. Reduced motion shows the title already in place.",
      },
      {
        id: "ADR-039",
        title: "New fact lives inside the ticket",
        chose:
          "The button moved into the ticket's bottom row, with a draining ring for the countdown.",
        why: "The action belongs next to the thing it changes.",
      },
      {
        id: "ADR-040",
        title: "Rolling paper and colored toast icons",
        chose: "A paper-roll animation while a fact generates, and toast icons colored by type.",
        why: 'A spinner says "wait". Paper rolling says "a new one is printing", which is the actual event.',
      },
      {
        id: "ADR-041",
        title: "The whole ticket rolls",
        chose:
          "One motion value rolls the entire ticket, body and stub, left to right on desktop and upward on phones.",
        why: "I wanted the whole ticket to roll, not just the text. The ticket is the paper object, so it's the thing that should look like it's printing.",
      },
      {
        id: "ADR-042",
        title: "Cap OpenAI calls per user",
        considered: "Keep D18 and rely on an OpenAI budget limit, or cap generations per user.",
        chose:
          "At 20 facts in 10 minutes across all movies, skip OpenAI and serve the last fact, or a 429 when there isn't one. Counted while holding the lease.",
        why: "A budget limit alone lets one person use up the month and break facts for everyone. Counting fact rows needs no new table, and the lease already serializes a user's requests, so parallel calls can't race past the count.",
      },
      {
        id: "ADR-043",
        title: "Row level security on every table",
        considered:
          "Turn off Supabase's Data API in the dashboard, or also enable RLS in a migration.",
        chose: "Both. RLS with no policies on every table, plus the dashboard toggle.",
        why: "A dashboard toggle lives outside the repo and is easy to miss on a new project. RLS ships with the schema and a test enforces it. Prisma connects as the table owner, which bypasses RLS, so the app doesn't notice.",
      },
      {
        id: "ADR-044",
        title: "An open carton logo",
        considered:
          "A box with a clapperboard lid, a closed box with a play button, or an open carton with a sunset window.",
        chose: "The open carton, plus a simpler favicon.",
        why: "It reads as a box being opened. The blues are sampled from the landing painting's sky, so the logo belongs to the same world. At 16px the sunset turned to mud, so the favicon uses a solid lit window.",
      },
      {
        id: "ADR-045",
        title: "A docs page with diagrams that can't go stale",
        considered:
          "SVG files shared by the page and the README, or inline SVG on the page with Mermaid in the README.",
        chose:
          "Inline SVG components on this page, exported to standalone files for the README and architecture doc. A test fails when a file drifts from its component.",
        why: "Inline drawings use the page's font and colors. Exporting them keeps one source, and the test means nobody has to remember to redraw.",
      },
    ],
  },
];

export const DECISION_COUNT = GROUPS.reduce((sum, group) => sum + group.decisions.length, 0);

export function DecisionLog() {
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          {group.decisions.map((decision) => (
            <article key={decision.id} id={decision.id.toLowerCase()} className="decision">
              <h4>
                <span className="decision-id">{decision.id}</span> {decision.title}
                {decision.status && <span className="decision-status">{decision.status}</span>}
              </h4>
              {decision.considered && (
                <p>
                  <strong>Considered.</strong> {decision.considered}
                </p>
              )}
              <p>
                <strong>Chose.</strong> {decision.chose}
              </p>
              <p>
                <strong>Why.</strong> {decision.why}
              </p>
            </article>
          ))}
        </div>
      ))}
    </>
  );
}

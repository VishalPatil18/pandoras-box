import type { ReactNode } from "react";
import { DECISION_COUNT, DecisionLog } from "@/components/docs/decisions";
import { DiagramFigure } from "@/components/docs/diagrams";

const SECTION_TITLES = {
  overview: "Overview",
  why: "Why I built it this way",
  architecture: "Architecture",
  stack: "The stack, and why",
  data: "Data model",
  "sign-in": "Sign-in and access",
  facts: "Getting a fact",
  failures: "When things go wrong",
  browser: "The browser side",
  decisions: "Every design decision",
  security: "Security",
  testing: "Testing",
  design: "Design system and logo",
  flags: "What I'd flag before you find it",
  next: "With 2 more hours",
} as const;

type SectionId = keyof typeof SECTION_TITLES;

export const SECTIONS = (Object.keys(SECTION_TITLES) as SectionId[]).map((id) => ({
  id,
  title: SECTION_TITLES[id],
}));

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{SECTION_TITLES[id]}</h2>
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STACK_TAGS = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Better Auth",
  "Prisma 7",
  "Postgres",
  "OpenAI",
  "TanStack Query",
  "Zod",
  "Tailwind 4",
  "Vitest",
];

// A privacy-enhanced embed; a placeholder card stands in until the video exists.
export function Walkthrough({ videoId }: { videoId: string | null }) {
  if (!videoId) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-card border border-carbon bg-paper p-6 text-center">
        <div>
          <p className="font-display text-xl uppercase">Walkthrough video coming soon</p>
          <p className="mt-2 text-ink-soft">
            A 4 minute tour of the app, the schema, the lease and the failure handling.
          </p>
        </div>
      </div>
    );
  }
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${videoId}`}
      title="Pandoras Box walkthrough"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      className="aspect-video w-full rounded-card border border-carbon bg-carbon"
    />
  );
}

export function DocsContent({ repoUrl }: { repoUrl: string }) {
  return (
    <>
      <Section id="overview">
        <p>
          Pandoras Box is a small full-stack app I built for a take-home exercise. You sign in with
          Google, name your favorite movie, and the app prints a piece of AI-written trivia about it
          on a movie ticket. You can ask for a new fact once a minute.
        </p>
        <p>
          The screens are simple on purpose. The part I care about is on the server: keeping
          &quot;one fact a minute&quot; true when two tabs, a double click or two server instances
          ask at the same moment, without letting a slow OpenAI call tie up the database. Most of
          this page is about that problem and the decisions around it.
        </p>
        <ul className="tags" aria-label="Stack used">
          {STACK_TAGS.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <Table
          head={["", "At a glance"]}
          rows={[
            ["Pages", <code key="p">/ /onboarding /dashboard /docs</code>],
            ["API", <code key="a">GET /api/me, PUT /api/me/movie, GET /api/fact</code>],
            ["Tests", "93, against a real Postgres and a mocked browser network"],
            ["Recorded decisions", `${DECISION_COUNT}, each with its options and reasons`],
          ]}
        />
      </Section>

      <Section id="why">
        <p>
          The brief asks for the base app plus one of two extensions. Variant A is about the
          backend: caching and correctness. Variant B is about the frontend: a typed API client, an
          optimistic inline edit and a client cache. I picked A as my answer and built B as an
          extra, labeled as such.
        </p>
        <blockquote>
          &quot;The goal is not feature volume, but correctness, clarity, and thoughtful
          tradeoffs.&quot; From the brief.
        </blockquote>
        <p>
          A won because the interesting failure lives there. Picture two browser tabs open on the
          dashboard. Both refresh at once, both land on different Vercel instances, both see no
          fresh fact, and both call OpenAI. You pay twice and the tabs disagree. Fixing that
          properly means thinking about locks, clocks, connection pools and what a waiting request
          should do, which is far more interesting than another form.
        </p>
        <p>
          B turned out to fit rather than compete. The browser keeps a fact for 30 seconds and the
          server keeps it for 60, so the browser answers first and the server makes sure repeat
          requests never reach OpenAI. Two cache layers, each with one job.
        </p>
      </Section>

      <Section id="architecture">
        <p>
          It&apos;s one Next.js App Router app on Vercel. The browser only ever talks to that app.
          Google, Postgres and OpenAI are reached from the server, so no secret ever reaches the
          client. Every module that reads a secret or touches the database starts with{" "}
          <code>import &quot;server-only&quot;</code>, and the build fails if client code imports
          one.
        </p>
        <DiagramFigure id="system-architecture" />
        <p>
          There&apos;s no middleware. Pages are server components that call{" "}
          <code>getCurrentUser()</code> and redirect before anything renders. API routes are wrapped
          in <code>withUser()</code>, which calls <code>requireUser()</code> first and turns every
          failure into the same JSON shape. Below that sit small modules with one job each:{" "}
          <code>lib/facts.ts</code> for the cache and lease, <code>lib/openai.ts</code> for the
          model call, <code>lib/db.ts</code> for the Prisma client on a <code>pg</code> pool with
          explicit 5 second timeouts.
        </p>
        <DiagramFigure id="request-path" />
        <p>
          Request bodies are validated exactly once, in <code>parseBody()</code>, against the same
          Zod schema the browser client uses. Services receive values that are already valid, so
          they never re-check. An <code>AppError</code> carries its own status and a message a
          person can act on. Anything else is logged on the server and the user sees a generic
          message, never a stack trace or an upstream error body.
        </p>
      </Section>

      <Section id="stack">
        <p>
          Every library is pinned to an exact version and was checked against its installed source,
          not my memory of it. That caught real things: npm&apos;s <code>latest</code> tag for
          Prisma pointed at a release candidate, Prisma 7.10 renamed its config file, and the model
          rejects a reasoning setting its own SDK types allow.
        </p>
        <Table
          head={["Layer", "Choice", "Why it earned its place"]}
          rows={[
            [
              "Framework",
              "Next.js 16.4, App Router",
              "Server components can redirect before rendering, and route handlers sit next to the pages. Pinned above 16.2.6 for the middleware bypass fix.",
            ],
            [
              "Auth",
              "Better Auth 1.7",
              "Maintained, keeps users and sessions in my own tables, and supports database sessions.",
            ],
            [
              "Database",
              "Postgres on Supabase",
              "Free tier, a pooler that suits serverless, and nothing else from Supabase is used.",
            ],
            [
              "ORM",
              "Prisma 7 with adapter-pg",
              "Typed queries, plus tagged-template raw SQL for the lease, which sends every value as a parameter.",
            ],
            [
              "AI",
              "OpenAI Responses API, gpt-5.4-mini",
              "Required by the brief. A small model with reasoning off keeps each fact fast and cheap.",
            ],
            [
              "Client data",
              "TanStack Query 5",
              "staleTime, refetch and the optimistic recipe are built in, which is exactly Variant B.",
            ],
            [
              "Validation",
              "Zod 4",
              "One schema per endpoint, imported by both the route and the browser client.",
            ],
            [
              "UI",
              "Tailwind 4, shadcn, two Cult UI components",
              "Design tokens become theme variables. Cult UI only where it didn't fight the design system.",
            ],
            [
              "Motion and toasts",
              "motion 14, notch-toast",
              "The ticket roll, the title entrance and the toasts. Both stop under reduced motion.",
            ],
            [
              "Tests",
              "Vitest 5, Docker Postgres, MSW 3, Testing Library",
              "The duplicate guard is SQL, so it's tested against real SQL.",
            ],
            [
              "Hosting",
              "Vercel",
              "Free tier, Git deploys, and function limits long enough for a 9 second wait.",
            ],
          ]}
        />
      </Section>

      <Section id="data">
        <p>
          Better Auth owns <code>user</code>, <code>session</code>, <code>account</code> and{" "}
          <code>verification</code>. I added three columns to <code>user</code> and one table of my
          own.
        </p>
        <DiagramFigure id="data-model" />
        <p>
          The favorite movie is a plain nullable column, because the brief allows exactly one. Null
          means the user hasn&apos;t finished onboarding, and that single fact drives all the
          routing. A favorites table would only make sense with several favorites or a history, and
          a shared movie table falls apart because &quot;the matrix&quot; and &quot;The Matrix
          (1999)&quot; are the same film typed differently.
        </p>
        <p>
          Facts are history. Each one is a new row with the title exactly as typed, a lowercased{" "}
          <code>movieKey</code>, the text and a <code>createdAt</code> set by Postgres. The newest
          row for a user and movie is the cache, older rows are the fallback, and the previous fact
          goes into the prompt so the next one is different. Changing the movie changes the key, so
          the old cache stops matching on its own. The key is a real column rather than a function
          index because Prisma can&apos;t express a functional index, and a plain column keeps the
          lookup to one index range scan on <code>(userId, movieKey, createdAt DESC)</code>.
        </p>
        <p>
          The two lease columns, <code>factLeaseUntil</code> and <code>factLeaseToken</code>, live
          on the user row because a user has one movie at a time, so one lease per user is enough.
          Every time comparison uses Postgres <code>now()</code>, never the app server&apos;s clock,
          so several Vercel instances always agree on what &quot;60 seconds&quot; means.
        </p>
        <p>
          Every table has row level security turned on with no policies. Prisma connects as the
          table owner, which bypasses RLS, so the app doesn&apos;t notice. Supabase&apos;s public
          API roles get zero rows, so session tokens and Google tokens can&apos;t leak through its
          Data API even if someone forgets the dashboard toggle. Deleting a user cascades to their
          facts, sessions and accounts.
        </p>
      </Section>

      <Section id="sign-in">
        <DiagramFigure id="sign-in" />
        <p>
          Sign-in is Better Auth&apos;s Google flow with <code>prompt: select_account</code>, so
          someone with several Google accounts gets to choose. The callback upserts the user,
          refreshes their name and photo, inserts a session row and sets an HttpOnly, SameSite=Lax
          cookie. The landing page then reads the session and sends you to onboarding or the
          dashboard based on one question: is a movie saved?
        </p>
        <p>
          Sessions live in the database and the cookie cache is off. That costs one indexed lookup
          per request, and buys a logout that actually works: deleting the row ends the session
          everywhere, and other open tabs fail their next request and go back to the landing page. A
          JWT would stay valid until it expired.
        </p>
        <p>
          The one rule is <code>requireUser()</code> in <code>lib/dal.ts</code>. It&apos;s the only
          place a request becomes a user. No endpoint accepts a user ID, so there&apos;s no way to
          name someone else&apos;s data and no ownership check to forget.
        </p>
        <Table
          head={["Page", "Signed out", "Signed in, no movie", "Signed in with a movie"]}
          rows={[
            [<code key="l">/</code>, "Landing", "Go to onboarding", "Go to dashboard"],
            [<code key="o">/onboarding</code>, "Go to /", "Show the form", "Go to dashboard"],
            [<code key="d">/dashboard</code>, "Go to /", "Go to onboarding", "Show the dashboard"],
            [<code key="x">/docs</code>, "This page", "This page", "This page"],
          ]}
        />
        <p>
          Google doesn&apos;t always send a name. When it doesn&apos;t, the profile shows the part
          of the email before the @. A missing or broken photo shows initials.
        </p>
      </Section>

      <Section id="facts">
        <p>
          Everything in Variant A runs through <code>getFact(userId)</code> in{" "}
          <code>lib/facts.ts</code>. Here is every path a request can take.
        </p>
        <DiagramFigure id="fact-flow" />
        <h3>The lease</h3>
        <p>
          The heart of it is one SQL statement. A request that finds no fresh fact tries to claim
          the user&apos;s lease:
        </p>
        <pre>
          <code>{`UPDATE "user"
SET "factLeaseUntil" = now() + make_interval(secs => 15),
    "factLeaseToken" = $token
WHERE "id" = $userId
  AND ("factLeaseUntil" IS NULL OR "factLeaseUntil" < now())
RETURNING "id"`}</code>
        </pre>
        <p>
          Postgres locks the row while it updates, so when several requests run this at once exactly
          one sees an empty or expired lease and gets a row back. Everyone else gets nothing. The
          winner checks once more for a fresh fact, because a parallel request might have finished
          between the first check and the claim. Then it checks the generation cap, calls OpenAI,
          stores the fact, and releases the lease in a <code>finally</code> block. The release only
          clears its own token, so a request that ran past its expiry can&apos;t wipe out a newer
          claim.
        </p>
        <DiagramFigure id="two-tabs" />
        <p>
          A request that loses waits. It polls the fresh check every 500 ms for up to 9 seconds and
          returns the winner&apos;s fact as <code>shared</code>. It holds no transaction and no
          connection while it sleeps. On every poll it also retries the claim, which fixes a case I
          only found by writing the test first: if you change your movie while a fact for the old
          one is generating, your request takes over the moment the old one finishes instead of
          waiting 9 seconds for a fact that will never come.
        </p>
        <h3>Why not something simpler</h3>
        <DiagramFigure id="lease-alternatives" />
        <p>
          I tried to break each alternative on paper first. An in-memory lock is fine on a laptop
          and useless on Vercel, where two requests can land on two instances that each hold their
          own lock. A unique constraint on a time window stops the second row but not the second
          OpenAI call, and its windows don&apos;t line up with &quot;60 seconds since the last
          fact&quot;. An advisory lock inside a transaction does stop the duplicate call, but it
          holds a pooled connection open for the whole OpenAI call, which can run to 8 seconds, past
          Prisma&apos;s 5 second transaction limit. The lease is a little more code for the losing
          request, and in exchange nothing is held during the slow part, it works through
          Supabase&apos;s transaction pooler, and a crashed holder heals itself when the lease
          expires.
        </p>
        <h3>Timing budget</h3>
        <Table
          head={["Value", "Setting", "Reason"]}
          rows={[
            ["Server cache window", "60 s", "The brief"],
            ["OpenAI timeout", "8 s, no retries", "The SDK default is 10 minutes with 2 retries"],
            ["Lease expiry", "15 s", "Longer than the timeout, so a live holder never loses it"],
            ["Waiter polling", "every 500 ms, up to 9 s", "Covers the 8 s call plus the insert"],
            ["Function limit", "15 s", "Lets a waiter finish; set as maxDuration on the route"],
            [
              "Generation cap",
              "20 per 10 min",
              "Twice what one movie refreshed every minute needs",
            ],
            ["Browser cache", "30 s", "Variant B"],
          ]}
        />
        <h3>The prompt</h3>
        <p>
          The instructions follow IMDb&apos;s trivia guidelines: one fact, two sentences at most,
          third person, no spoilers, only well-documented facts, and start with the title and the
          release year the model assumed. Naming the year matters more than it looks. When someone
          types &quot;Dune&quot;, you can see whether you got 1984 or 2021. The title goes in
          wrapped in quotes and labeled as data, with an instruction to ignore anything inside it
          that reads like a command. The previous fact goes in too, with a request for a different
          one. Output is capped at 150 tokens, reasoning is off so every token goes to the fact, and
          the text has to pass a Zod check (non-empty, at most 600 characters) before it&apos;s
          stored. An empty or incomplete response counts as a failure and is never saved.
        </p>
      </Section>

      <Section id="failures">
        <p>
          I wanted every failure to end in something a person can act on. Nothing here shows a stack
          trace, and nothing hangs.
        </p>
        <Table
          head={["What goes wrong", "What you see", "Why it works"]}
          rows={[
            [
              "OpenAI times out or errors",
              "Your last fact for this movie, with \"Couldn't get a fresh fact, so here's your last one.\"",
              "8 s timeout, then the fallback",
            ],
            [
              "OpenAI fails and there's no earlier fact",
              '"Couldn\'t load a fact" with a Try again button',
              "503 FACT_UNAVAILABLE",
            ],
            ["Two tabs refresh together", "The same fact in both", "The lease plus waiting"],
            [
              "A request crashes holding the lease",
              "The next request after 15 s generates normally",
              "Lease expiry",
            ],
            [
              "Switching movies in a loop",
              'Your last fact, or "You\'ve asked for a lot of facts"',
              "The generation cap",
            ],
            ["A movie save fails", "The old title comes back, with a toast", "Optimistic rollback"],
            [
              "Session expires mid-visit",
              "Back to the landing page with a notice",
              "401 on the next request",
            ],
            ["Database drops", "A generic error you can retry", "Explicit 5 s connect timeout"],
          ]}
        />
        <p>
          The generation cap came out of the security audit. The 60 second window is keyed by user
          and movie, so typing a new title skips it. A script that alternated titles could buy an
          OpenAI call every few seconds, per Google account. Now the winner of the lease counts that
          user&apos;s facts from the last 10 minutes, across all movies, before it calls OpenAI. At
          20 it serves the last fact instead, or a 429 if the movie has none yet. Normal use tops
          out at 10, so nobody reading trivia ever sees it. Because the count runs under the lease,
          parallel requests can&apos;t each see 19 and all generate.
        </p>
      </Section>

      <Section id="browser">
        <p>
          <code>lib/api.ts</code> is a typed client with three functions. Each one validates the
          response against the same Zod schema the route used. A non-2xx response, a network error
          and a response that breaks the contract all become one <code>ApiError</code> with a
          status, a code and a message, so components handle one error type. A 401 from any query or
          mutation sends you back to the landing page with a full page load, so the signed-out
          tab&apos;s cached data is gone.
        </p>
        <DiagramFigure id="cache-layers" />
        <p>
          TanStack Query keeps the fact for 30 seconds under{" "}
          <code>[&quot;fact&quot;, movieKey]</code>. Refocusing the tab or remounting the ticket in
          that time costs nothing. The New fact button calls <code>refetch()</code>, which skips the
          browser cache but still hits the server window, so it can&apos;t buy extra OpenAI calls.
        </p>
        <p>
          That raised a design problem. If New fact is clickable at second 20, it returns the same
          fact and looks broken. I made it count down instead. The server sends{" "}
          <code>secondsUntilRefresh</code>, computed from database time, and the browser counts it
          down from the moment the response arrived. A wrong clock on your laptop can&apos;t change
          it, and every click that&apos;s allowed produces something new.
        </p>
        <p>
          The dashboard&apos;s profile and movie are rendered on the server and handed to TanStack
          Query as initial data, so they appear at once. Only the fact loads in the browser, behind
          a ticket that rolls up like paper while it prints. OpenAI never holds up the page.
        </p>
        <DiagramFigure id="movie-edit" />
        <p>
          Editing the movie is optimistic, following TanStack&apos;s documented recipe: cancel
          in-flight queries, snapshot, write the new title, roll back on error. One extra step
          mattered. The fact query is keyed by movie, so while the save is in flight it pauses.
          Otherwise it would fetch a fact for the new key before the server knew about the new movie
          and get the old movie&apos;s fact back. Onboarding and inline edit share the same
          endpoint, so there&apos;s one validation rule and one set of tests.
        </p>
        <p>
          Toasts go through one small module. Messages that have to survive a full page load, like
          &quot;Signed in&quot;, travel as a <code>?toast=</code> key. Only keys on an allowlist
          show anything, so a crafted link can&apos;t put arbitrary text on screen, and the key is
          stripped from the URL after it shows so a reload doesn&apos;t repeat it.
        </p>
      </Section>

      <Section id="decisions">
        <p>
          I made every call below myself, usually after seeing two or three options with their
          costs. Each one is also in <code>dev-docs/design-decisions.md</code> in the repo, in more
          detail.
        </p>
        <DecisionLog />
      </Section>

      <Section id="security">
        <p>
          Before the first deploy I ran a full audit: every route, the data access layer, the fact
          service, every page guard, every client component that renders user or model data, Better
          Auth&apos;s own source for the defaults this app depends on, git history for secrets, and
          the dependency advisories. The full report is{" "}
          <a
            href={`${repoUrl}/blob/main/dev-docs/security-audit.md`}
            target="_blank"
            rel="noreferrer"
          >
            in the repo
          </a>
          .
        </p>
        <Table
          head={["Finding", "Severity", "Fix"]}
          rows={[
            ["Switching movies skipped the cost limit", "Medium", "The generation cap"],
            [
              "Session and Google tokens readable through Supabase's Data API, if it was on",
              "High if exposed",
              "RLS on every table, and the Data API off",
            ],
            ["Any site could frame the app", "Low", "frame-ancestors 'none' and X-Frame-Options"],
            ["The dev database listened on every network interface", "Low", "Bound to 127.0.0.1"],
            ["The CI token had no explicit scope", "Informational", "contents: read"],
          ]}
        />
        <p>
          The audit also checked things and found them sound. No route takes a user ID. Every raw
          query is a parameterized tagged template. Fact text, titles and names render as React text
          and nothing uses <code>dangerouslySetInnerHTML</code>. The sign-in callback URL is fixed.
          The session cookie is SameSite=Lax and the only state-changing route takes a JSON PUT,
          which a cross-site form can&apos;t send. Better Auth&apos;s update-user endpoint can only
          write the name and photo, so the movie and the lease can&apos;t be set through it.
        </p>
      </Section>

      <Section id="testing">
        <p>
          There are 93 tests, and every one runs in CI. OpenAI is mocked everywhere. Nothing else in
          the backend is.
        </p>
        <Table
          head={["Area", "Runs against", "What it proves"]}
          rows={[
            [
              "Cache window",
              "Docker Postgres",
              "A fact under 60 s returns with no OpenAI call; one backdated past 60 s generates",
            ],
            [
              "Concurrency",
              "Docker Postgres",
              "Five parallel requests make exactly one OpenAI call and all return the same text",
            ],
            [
              "Lease recovery",
              "Docker Postgres",
              "An expired lease is reclaimed; a stale token can't clear a newer lease",
            ],
            [
              "Movie change mid-generation",
              "Docker Postgres",
              "The new movie generates as soon as the old generation finishes",
            ],
            [
              "Failure",
              "Docker Postgres",
              "OpenAI errors return the last fact or FACT_UNAVAILABLE, and empty output is never stored",
            ],
            ["Generation cap", "Docker Postgres", "At 20 facts in 10 minutes OpenAI isn't called"],
            [
              "Authorization",
              "Docker Postgres",
              "Every endpoint returns 401 without a session; facts never cross users",
            ],
            ["Row level security", "Docker Postgres", "No table in public has RLS off"],
            [
              "API client",
              "MSW",
              "401, 500, network errors and contract breaks become the right ApiError",
            ],
            [
              "Edit flow",
              "MSW, Testing Library",
              "The new title shows at once, a failure restores it, success loads the new fact",
            ],
            [
              "Diagrams",
              "Static render",
              "The exported diagram files match the drawings on this page",
            ],
          ]}
        />
        <p>
          I wrote the concurrency test before the lease existed. It failed with several OpenAI
          calls, which is the only real proof that the guard does anything. A mocked database would
          have passed it either way, which is why the backend tests use real Postgres. There are no
          end-to-end tests through a real Google sign-in; that&apos;s first on the list below.
        </p>
      </Section>

      <Section id="design">
        <p>
          The app screens follow a sticker-book design system in <code>design/DESIGN.md</code>:
          pastel color bands, 1px black outlines, pill buttons, a heavy display face (Bowlby One)
          and a clean UI face (General Sans), with no shadows or gradients. The fact prints on a
          ticket with a tear-off stub and a barcode generated from the title. Error text stays black
          with an orange warning sticker, because orange text on white fails contrast.
        </p>
        <p>
          The landing page breaks those rules on purpose. It&apos;s a full-screen painting of a
          train platform at dusk, with the title animating in letter by letter. I wanted the first
          screen to feel like the start of a film rather than a form.
        </p>
        <p>
          The logo is an open carton seen from above, flaps up, with a sunset showing through a
          window on its front, like a screen. Its blues are sampled straight from the
          painting&apos;s sky: <code>#173A8C</code> at the top, <code>#2346A0</code> above the
          clouds and <code>#355BC2</code> lower down. The window runs from that blue through violet
          to the clouds&apos; pink. At 16 pixels the gradient turned to mud, so the browser tab uses
          a simpler drawing with thicker outlines and a solid yellow window.
        </p>
        <p>
          Every animation, from the title to the ticket roll to the countdown ring, stops under{" "}
          <code>prefers-reduced-motion</code>. Forms announce their errors, the ticket is a polite
          live region, and every control works from the keyboard with a visible focus ring.
        </p>
      </Section>

      <Section id="flags">
        <p>Things I know about and chose to leave, so you don&apos;t have to find them:</p>
        <ul>
          <li>
            The generation cap is per Google account. Someone with fifty accounts gets fifty times
            the ceiling. The OpenAI project&apos;s budget limit is the backstop.
          </li>
          <li>
            Better Auth&apos;s own rate limiter counts per server instance on Vercel. It only guards
            Google sign-in here, which has nothing to brute force, but it isn&apos;t global.
          </li>
          <li>
            There&apos;s no script Content Security Policy. Framing and MIME sniffing are blocked,
            but a script policy would need per-request nonces and dynamic rendering everywhere.
          </li>
          <li>
            Trivia can be wrong. The model is told to stick to documented facts, the ticket says
            &quot;AI-generated, may be inaccurate&quot;, and ambiguous titles are a guess the model
            names out loud.
          </li>
          <li>
            A waiting request sits in a Vercel function for up to 9 seconds. That&apos;s the price
            of two tabs agreeing.
          </li>
          <li>
            notch-toast is young: version 0.x with one maintainer. It&apos;s pinned exactly and
            wrapped in one module, so swapping it touches one file.
          </li>
          <li>
            Cache Components is off. Next 17 is expected to turn it on everywhere, which will mean
            moving the session reads behind Suspense.
          </li>
          <li>
            The landing painting carries the artist&apos;s &quot;WARMCORNER AI&quot; mark, which
            stays as their credit.
          </li>
        </ul>
      </Section>

      <Section id="next">
        <ul>
          <li>
            Playwright end-to-end tests with a seeded session, so something drives a real browser
            from sign-in to a printed ticket.
          </li>
          <li>
            A TMDB lookup for ambiguous titles, so you can pick the 2021 Dune instead of trusting
            the model&apos;s guess.
          </li>
          <li>
            A shared store for rate limits, such as Upstash Redis on its free tier, which would make
            Better Auth&apos;s limiter global and allow a per-IP limit in front of the per-account
            cap.
          </li>
          <li>A nonce-based script Content Security Policy.</li>
          <li>
            Streaming the fact as it&apos;s written, if facts ever get longer than two sentences.
          </li>
        </ul>
      </Section>
    </>
  );
}

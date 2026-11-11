# Walkthrough video script

About 4 minutes 30 seconds. Each segment lists what to show on screen, then what to say. Read the narration as a guide, not word for word.

**Before recording:**
- Sign out, so the demo starts on the landing page.
- Pick a movie with no stored facts, so the first fact is a real OpenAI call.
- Open the Supabase SQL editor in a second window with this query ready:
  ```sql
  select "movieTitle", left("text", 40), "createdAt" from fact order by "createdAt" desc limit 5;
  ```
- Open these files in the editor: `prisma/schema.prisma`, `lib/facts.ts`, `tests/backend/facts-lease.test.ts`, `lib/queries.ts`.

---

## 1. The app (0:00 to 0:45)

**Show:** the landing page. Sign in with Google, land on onboarding, try an empty title and then a 101 character one, save a real movie, and wait for the ticket to print.

**Say:**
> This is Pandoras Box. You sign in with Google, name your favorite movie, and get a piece of AI trivia about it.
>
> Onboarding checks the title on the server. Blank and overlong titles get a message, and accented or non-English titles are kept exactly as typed.
>
> The dashboard shows my Google profile, my movie, and the fact on a ticket. The ticket rolls while the fact prints, and the badge reminds you it's AI-generated.

## 2. The schema, and why facts are history (0:45 to 1:30)

**Show:** `prisma/schema.prisma`, the `User` additions and the `Fact` model. Then the SQL editor with the query above.

**Say:**
> Better Auth owns the user, session and account tables. I added three columns to `user`: the favorite movie, and two columns for a generation lease I'll get to in a second.
>
> Facts aren't one cached value. Every generated fact is a new row, with the title as typed, a lowercased key, and a timestamp the database sets.
>
> That history earns its keep three ways. The newest row is the cache. Older rows are the fallback when OpenAI fails. And the last fact goes into the prompt so the next one is different. Changing the movie changes the key, so the old cache stops matching on its own.

## 3. The lease, and the two tab test (1:30 to 2:45)

**Show:** `lib/facts.ts`: `findFreshFact`, `claimLease`, then the polling loop in `getFact`. Then two dashboard tabs side by side. Reload both at once, then rerun the SQL query.

**Say:**
> Variant A is about one rule: at most one fact a minute, even when requests race.
>
> First, a fresh check. Is there a fact under 60 seconds old? The age comes from Postgres `now()`, so every server agrees.
>
> If not, the request claims a lease with one conditional `UPDATE`. It sets a 15 second expiry and a random token, but only where no live lease exists. Postgres row locking means exactly one concurrent request wins.
>
> The winner calls OpenAI, stores the fact, and releases the lease in a `finally`, checking its own token so it can't clear someone else's claim. The losers poll every half second and return the winner's fact.
>
> Here are two tabs reloading at the same moment. Same fact in both, and one new row in the database.
>
> Why not something simpler? An in-memory lock breaks with two servers. A unique constraint stops the duplicate row, not the duplicate OpenAI call. An advisory lock holds a connection open for the whole call. The lease holds nothing during the slow part, so it works across Vercel instances and through Supabase's pooler.
>
> The test for this fires five parallel requests and asserts exactly one OpenAI call. It failed before the lease existed, which is how I know the guard does something.

## 4. When OpenAI fails (2:45 to 3:15)

**Show:** `lib/openai.ts` (the timeout and `maxRetries: 0`), then `generateAndStore` in `lib/facts.ts`. If you can, show the fallback notice on the ticket by temporarily setting a bad `OPENAI_API_KEY` locally.

**Say:**
> The OpenAI SDK defaults to a ten minute timeout with two retries. That would hang the dashboard, so it's 8 seconds and no retries. Your own click is the retry.
>
> If generation fails, you get your last fact with a notice saying so. With no earlier fact, you get a clear message and a Try again button. The real error goes to the server log, never to the browser.
>
> Switching movies skips the 60 second window, so there's also a cap: 20 new facts per 10 minutes per account. Past it, you get your last fact, or a message to try again later.

## 5. The browser side (3:15 to 4:00)

**Show:** `lib/queries.ts`: `useFact` with its 30 second `staleTime`, and `useSetMovie`. Then the dashboard: the countdown on New fact, then an inline edit to a new movie.

**Say:**
> Variant B is built as an extra. Every API response goes through the same Zod schema the server uses, and every failure becomes one typed error.
>
> TanStack Query keeps a fact for 30 seconds, keyed by movie, so switching tabs costs nothing. The server tells the browser how many seconds until a new fact is allowed, and the button counts that down.
>
> Editing the movie is optimistic. The new title shows at once and the fact query pauses. If the save works, the new movie's fact loads. If it fails, the old title comes back with a toast.

## 6. Tradeoffs and next steps (4:00 to 4:30)

**Show:** the README, scrolled to "Tradeoffs" and "With 2 more hours".

**Say:**
> A few tradeoffs. Session checks sit next to the data instead of in middleware, because of recent middleware bypass CVEs. Waiters sit in a function for a few seconds instead of failing fast, so two tabs agree.
>
> With two more hours, I'd add a TMDB lookup for ambiguous titles, Playwright tests through the real sign-in, and a shared store for rate limits.
>
> Thank you for giving me this opportunity to work on this excercise. I hope this helps you understand my skillset and what I bring to the table. I would love to move ahead in process and interview for the position. To know more aout me checkout vishalpatil.tech.
>
> Thanks for watching. 

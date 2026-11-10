# Learnings

Lessons from each feature cycle. Append only; past entries are never edited.

---

## 2026-11-10: Foundation (plan Tasks 1 and 2)

- **npm's `latest` tag can point at a prerelease.** For Prisma it points at `8.0.0-rc.33`. Read `npm view <pkg> dist-tags` before pinning, not just `version`.
- **The newest major isn't always usable.** TypeScript 7 and ESLint 10 are out, but typescript-eslint caps TypeScript below 6.1, and eslint-plugin-react (bundled in eslint-config-next) caps ESLint at 9. Check the peer ranges of the whole toolchain together.
- **Vitest 5 lists Vite as a peer dependency.** It has to be installed explicitly.
- **Vite 8 resolves tsconfig paths natively** (`resolve.tsconfigPaths: true`), so `vite-tsconfig-paths` isn't needed.
- **The Next 16.4 template uses `@tailwindcss/turbopack`, not PostCSS,** and turns on `cacheComponents` by default.
- **With `cacheComponents` on, reading cookies or headers outside `<Suspense>` is a build error.** Next's bundled guide (`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`) puts session reads behind a Suspense boundary and uses `use cache: private`. This changes how the architecture's page guards get written.
- **`create-next-app` refuses a non-empty folder.** Scaffold elsewhere and copy the files in.
- **`shadcn init` (v4) installs `cn`, its own class-merging package,** instead of `clsx` and `tailwind-merge`, and adds `shadcn` as a runtime dependency for `shadcn/tailwind.css`.
- **`tsc --noEmit` fails on Next's generated global types** (`LayoutProps`) unless `next typegen` runs first.
- **`cmd | tail` hides the exit code.** Use `set -o pipefail` when chaining checks.
- **Prettier on the whole repo reformats hand-written Markdown tables.** Markdown and design files are ignored.

---

## 2026-11-10: Data, auth and validation (plan Tasks 3 to 6)

- **Prisma 7.10 looks for `prisma7.config.ts`.** Earlier 7.x versions used `prisma.config.ts`. Both the Better Auth guide and Prisma's own package strings confirm it.
- **The Better Auth schema CLI is now the `auth` package** (`pnpm dlx auth@<version> generate`). It can't load a config that imports `server-only`.
- **pnpm 12 enforces a one-day minimum release age** and quietly adds exclusions to `pnpm-workspace.yaml` when you install something newer. Check `npm view <pkg> time` and prefer a release older than the window. Two better-auth patches came out on the same day we installed.
- **pnpm 12 blocks dependency install scripts until they're allowed.** Prisma needs `prisma` and `@prisma/engines`.
- **A lockfile that holds a too-new version fails the supply-chain check before any re-resolution.** Remove the package, then add the older version.
- **Better Auth's `mapProfileToUser` must return `image` as `string | undefined`,** never `null`.
- **Specs beat plans.** The plan reversed srs §5.1's order (control-character check before whitespace collapsing), which would have rejected pasted tabs. Writing the test first surfaced the conflict.
- **`next build` evaluates the auth route module,** so the Google and auth env vars must exist at build time (CI uses placeholders).

---

## 2026-11-10: Fact service and API (plan Tasks 7 to 11)

- **Check a model's accepted parameter values against its own model page.** `gpt-5.4-mini` takes `reasoning.effort` `none`, `low`, `medium`, `high` or `xhigh`, but not `minimal`, even though the SDK type includes `minimal` for other models.
- **The race was real before the guard existed.** The five-request test failed with several OpenAI calls before the lease went in. Writing the concurrency test first is what proves the guard does something.
- **A waiter that only polls can get stuck behind someone else's generation for a different movie.** Retrying the lease claim on every poll lets it take over the moment the old generation finishes.
- **`next/headers` throws outside a request scope.** To test a route's real auth path, stub `headers()` to return a request without a cookie, rather than mocking the data access layer.
- **Module-level memoized clients survive between tests.** Use `vi.resetModules()` and re-import the module to assert construction.
- **Example text inside a prompt leaks.** An example title such as "Inception (2010):" sits in the instructions the model reads. Use neutral placeholders.

---

## 2026-11-10: Client orchestration and app UI (plan Tasks 12 to 16)

- **Check a component library's source against the design system before adopting it.** Counting glow, gradient and shadow references in Cult UI's registry JSON showed most components would be rewritten, not restyled.
- **An optimistic edit that changes a query key can fetch stale data under the new key.** Pause the dependent query until the mutation settles.
- **MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`.** Vitest doesn't type-check, so the old option was silently ignored until `tsc` ran.
- **Tailwind can't generate classes built with template strings.** Put dynamic values in a CSS variable and reference it from literal classes.
- **jsdom won't let tests replace `window.location.assign`.** Route full-page navigations through a small module the tests can mock.
- **Vite 8 compiles TSX for Vitest on its own.** `@vitejs/plugin-react` wasn't needed.
- **A background `next start` can outlive its session and keep the port.** Kill by the port's listening PID, not by command name, before starting a new server.

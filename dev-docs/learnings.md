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

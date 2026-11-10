# Context

What exists, how it works, and what is locked in. Entries are appended per session and past entries are never edited.

---

## 2026-11-10: Planning, design and foundation

### What exists

- **Planning docs:** `dev-docs/epic.md`, `research.md`, `design-decisions.md` (D1 to D30, ADR-031), `architecture.md`, `srs.md`, `plan.md`.
- **Visual system:** `design/DESIGN.md`, plus clickable HTML mockups in `design/mocks/` and Rune icons in `design/icons/`.
- **A Next.js 16.4.6 app** that builds, with a placeholder home page. No auth, database or API code yet.
- **Tooling:**
  - pnpm 12.
  - TypeScript 6 strict.
  - ESLint 9 with Next's core web vitals and TypeScript rules.
  - Prettier with a 100-character line width. It skips Markdown, `design/` and `dev-docs/`.
  - Vitest 5 with `backend` (node) and `frontend` (jsdom) projects.
- **Local database:** `docker-compose.yml` runs `postgres:17` on port 5433.
- **CI:** GitHub Actions runs install, typecheck, lint, test and build on Node 24 with a Postgres service.

### How it works

- **Theme:** `app/globals.css` holds the DESIGN.md tokens as a Tailwind v4 `@theme`, with utilities like `bg-sky`, `text-carbon`, `rounded-pill` and `font-display`. shadcn's semantic variables (`primary`, `border`, `ring` and so on) point at the same tokens, so shadcn and Cult UI components pick up the brand without per-component overrides.
- **Fonts:** `app/layout.tsx` loads Bowlby One from Google Fonts through `next/font`, and General Sans 500 and 700 from `app/fonts/` (ITF Free Font License, which allows self-hosting; the license file is alongside).
- **Type check:** `pnpm typecheck` runs `next typegen` first, because types like `LayoutProps` only exist after Next generates them.

### Locked in

- Library versions are pinned exactly. The full table, including packages still to install, is under plan Task 1.
- TypeScript stays on 6.x until typescript-eslint supports 7. ESLint stays on 9.x until eslint-plugin-react supports 10.
- Prisma is pinned to 7.10.1, because npm's `latest` tag points at an 8.0 release candidate.
- `next.config.ts` keeps the template's `cacheComponents: true` and `partialPrefetching: true` for now. This affects how pages read the session (see learnings). The owner decides it before the auth work.
- The agent never commits or pushes. Each change ends with a commit message for the owner.

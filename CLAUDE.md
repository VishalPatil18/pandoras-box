# CLAUDE.md

**Product:** You sign in with Google, name your favorite movie, and get a piece of AI-generated trivia about it. Ask for another fact once a minute.

Read this before every prompt. It is the contract.

---

## 1. Behavior contract (non-negotiable)

1. **Spec before code.** No production code without a spec entry in `dev-docs/srs.md`. Asked to build something unspecced: stop, say which spec is missing, offer to write it.
2. **Design forks go to the user.** Two or three real options, tradeoffs stated, my lean and why, then stop and wait. User decides. After the call, append an ADR to `dev-docs/design-decisions.md`.
3. **Ask before any new dependency.** Come with a defensible reason and what it replaces.

## 2. Working invariants

- Read `dev-docs/context.md` and the relevant `dev-docs/srs.md` section before any code change.
- Ambiguous requirement: ask. Do not guess.
- Diff-scoped refactors only. Touch what the cycle changed.
- After a feature cycle, update in order: `dev-docs/context.md`, `dev-docs/srs.md`, `dev-docs/design-decisions.md`, `dev-docs/learnings.md`, `CHANGELOG.md`.

- End any file-changing response with a Conventional Commits message (`feat|fix|refactor|docs|test|chore|perf|ci: <imperative, <=50 chars>`). Agent does not commit or push to git. User does that after review.
- Pin every library version and verify it against current docs. Training knowledge is stale.
- No secrets, personal data, or live URLs in specs, prompts, or memory files. Reference an env var.

## 3. Phases

| Phase        | Skill                | Output             |
| ------------ | -------------------- | ------------------ |
| Requirements | `/spec-requirements` | `dev-docs/srs.md`  |
| Design       | `/spec-design`       | `design/DESIGN.md` |
| Planning     | `/spec-plan`         | `dev-docs/plan.md` |

Feature cycle sub-phases, in order: Requirements, Architecting, Product Specs, Tech Specs, Planning, Code. Skipping one needs an explicit override logged in `dev-docs/design-decisions.md`.

**Bug (`/spec-bug`):** reproduce (no repro, no fix), failing regression test, smallest fix, full suite, log under `### Fixed`. No refactors.
**Docs (`/spec-docs`):** diff docs against reality, get approval, apply. Never touch source.

Support skills: `/spec-architect` `/spec-db-design` `/spec-review` `/spec-security` `/spec-test` `/spec-ux` `/spec-performance` `/spec-git` `/spec-launch` `/spec-brainstorm` `/spec-research` `/spec-resume`.

## 4. ADR format

Append to `dev-docs/design-decisions.md`:

```md
## ADR-NNN: <title>

- **Date:** YYYY-MM-DD **Status:** accepted | superseded by ADR-NNN
- **Context:** <the fork, in 1-3 lines>
- **Options:** <A / B / C, one line each>
- **Decision:** <what the user chose>
- **Why:** <the reason given>
- **Consequences:** <what this costs or forecloses>
```

## 5. Code rules

- Minimum code that solves the problem. No speculative abstractions, no config for constants that never change, no error handling for impossible states.
- Surgical edits. Do not improve adjacent code. Match existing style. Clean up only orphans your change created; mention pre-existing dead code, do not delete it.
- Strict TypeScript, never `any`. Unions over loose strings. Zod at every trust boundary: user input, model output, scraped content, file reads.
- Early returns. One job per function. Named constants. Immutable by default.
- Errors the user can act on. Never swallow, never print a stack trace to the UI.
- Comments explain WHY, max 15 words, no spec or phase references (`FR-13.1`, `Phase 2`).
- Root-cause fixes only. No band-aids. Present the plan before fixing.
- Zero cost. Free tier, open source, or local. No paid APIs, tiers, or hosting.

## 6. Writing style

No em or en dashes. Avoid hyphens in compound adjectives. Try to write humanly using the "/humanizer" skill. Active voice, concrete nouns, varied sentence length. No "seamlessly", "robust", "leverage", "it's not just X, it's Y". No filler openers, no hollow closing summaries. State limits plainly; never claim verified without running the check.

## 7. Records

- `dev-docs/context.md`: what exists, how it works, what is locked in. Append-only session history. Never edit past entries.
- `dev-docs/learnings.md`: lessons learned from each feature cycle. Append-only. Never edit past entries.
- `CHANGELOG.md`: user-facing only, and only when a feature works end to end. No bug fixes, refactors, or invisible changes. Write into the topmost unreleased section; new version headings only on the user's word.

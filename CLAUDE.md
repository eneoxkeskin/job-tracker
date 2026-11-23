# CLAUDE.md

Job Application Tracker: GitHub sign-in, applications on a 4-stage Kanban board
(APPLIED → INTERVIEW → OFFER → REJECTED). Plan and decision rationale: `PLAN.md`.

## Environment

- Windows 11, Windows PowerShell 5.1: no `&&` in terminal commands (use `;` or `if ($?) { … }`).
  npm scripts may use `&&` (they run in cmd).
- Node 26 locally, Node 24.x on Vercel. Package manager: npm. Do not install anything globally
  or do anything hard to reverse without asking first.

## Commands

- `npm run dev`: dev server at http://localhost:3000
- `npm run check`: lint + typecheck + unit tests (must pass before every commit)
- `npm run build`: production build (must pass before every commit)
- `npm run test` / `npm run test:watch`: Vitest
- `npm run format`: Prettier (with the Tailwind class-sorting plugin)
- Prisma (from M2): `npx prisma migrate dev --name <name>`, `npx prisma generate`, `npx prisma studio`

## Stack (exact versions are pinned; see PLAN.md §0)

- Next.js 16 App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4
- Prisma 7 (`prisma.config.ts`, `@prisma/adapter-pg`, client generated to `src/generated/prisma`)
- Neon Postgres (Frankfurt): `DATABASE_URL` = pooled (app runtime), `DIRECT_URL` = direct (CLI/migrations)
  - Neon branch `dev` for local work, `production` for production
- Auth.js v5 (`next-auth@5.0.0-beta.32`), GitHub provider, Prisma adapter, database sessions
- zod 4 for validation; dnd-kit (core + sortable) for drag and drop; Vitest for unit tests
- Vercel, region `fra1`
- Do NOT bump to Prisma 8 RC or next-auth v4 (their npm `latest` tags are misleading)

## Architecture

- `src/app/`: thin routing layer (pages, `loading.tsx`, `error.tsx`, the Auth.js route handler)
- `src/features/applications/`: domain feature
  - `schema.ts` (zod), `ranking.ts`, `stats.ts`, `stages.ts`: pure, client-safe, unit-tested
  - `queries.ts` (server-only reads), `actions.ts` (`"use server"` mutations), `components/`
- `src/lib/db.ts`: PrismaClient singleton. `src/lib/session.ts`: `requireUserId()`. `src/auth.ts`: Auth.js config
- Mutations are Server Actions. The only route handler is `/api/auth/[...nextauth]`.
- Ordering: integer `rank` per stage. The client sends `{ id, toStage, toIndex }`, and the server
  renumbers the target column in a transaction. The pure `reorder()` is shared with the
  optimistic UI.
- No `proxy.ts`/middleware auth: auth is enforced in the data layer and in every action.

## Security rules (non-negotiable)

- Every query and mutation is scoped to the session user: `where: { id, userId }`. `userId`
  always comes from `requireUserId()`, never from client input.
- Use `updateMany`/`deleteMany` with `{ id, userId }` and check `count`. A record that isn't
  the user's → 404 (`notFound()`), never 403.
- Every Server Action starts with `requireUserId()`, then `schema.safeParse(input)`. Treat
  actions as public endpoints.
- Validate all input on the server with zod. URLs must be `http:`/`https:` only.
- Never return raw Prisma or internal error messages to the client. Log on the server and
  return a generic message.
- Import `server-only` in `db.ts`, `session.ts` and `queries.ts`.
- Secrets live only in `.env` (gitignored). Keep `.env.example` updated with empty values.
  Never ask the user to paste secrets into chat. Never use the `NEXT_PUBLIC_` prefix for secrets.

## Coding conventions

- All UI text, code, identifiers, comments, commits and README are in English.
- Prefer Server Components; add `"use client"` only for interactivity (forms, board, DnD).
- Next 16: `params`/`searchParams` are Promises; call `revalidatePath("/board")` after mutations.
- Action result type: `{ ok: true } | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string }`.
- Dates: `appliedAt` is `@db.Date`; parse and format in UTC.
- Accessibility: every input has a `<label>`; errors are linked with `aria-describedby` and
  `aria-invalid`; visible focus rings; text contrast ≥ 4.5:1; stage is never shown by color
  alone; everything is usable with the keyboard; works at 360 px width.
- Every feature has empty, loading and error states.
- Use native elements and Tailwind; no UI kit. No speculative abstractions. Keep it extensible
  but build only what the current milestone needs.
- Unit tests live next to the code (`*.test.ts`) and cover pure logic.

## Workflow

- Work milestone by milestone (PLAN.md §5). After each one: `npm run check` and
  `npm run build` pass → one Conventional Commit (`feat(scope): …`, `chore: …`, `docs: …`) →
  stop, summarize, and wait for the user's approval.
- Record new technical decisions with a short rationale in PLAN.md §2.

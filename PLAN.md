# Job Application Tracker — MVP Plan

A portfolio project: sign in with GitHub, track job applications on a Kanban board
(Applied → Interview → Offer → Rejected), drag cards between stages, see a per-stage summary.

Goal for tonight (~3–4 h): a deployed, working MVP where every line can be explained in an interview.

> **Status:** the MVP (M1–M10) is live. The v2 plan (try-without-account demo, follow-ups,
> metrics, search, archive, CI and end-to-end tests) is in [section 8](#8-v2-portfolio-polish).

---

## 0. Stack and pinned versions

Versions were checked on npm on 2026-11-23. They are pinned exactly, because two of the `latest` tags are traps (see Risks).

| Area            | Package                                          | Version                       | Note                                                            |
| --------------- | ------------------------------------------------ | ----------------------------- | --------------------------------------------------------------- |
| Framework       | `next`                                           | 16.4.6                        | App Router, Turbopack, React 19                                 |
| Language        | `typescript`                                     | (from create-next-app)        | `strict` + `noUncheckedIndexedAccess`                           |
| Styling         | `tailwindcss`                                    | 4.3.x                         | CSS-first config, no `tailwind.config.js`                       |
| ORM             | `prisma`, `@prisma/client`, `@prisma/adapter-pg` | **7.10.1**                    | `latest` on npm is currently `8.0.0-rc.35`, so we do not use it |
| Auth            | `next-auth`                                      | **5.0.0-beta.32**             | `latest` on npm is v4, so we pin v5 explicitly                  |
| Auth adapter    | `@auth/prisma-adapter`                           | 2.11.3                        |                                                                 |
| Validation      | `zod`                                            | 4.6.x                         |                                                                 |
| Drag and drop   | `@dnd-kit/core`, `@dnd-kit/sortable`             | 6.3.1 / 10.0.0                |                                                                 |
| Tests           | `vitest`                                         | 5.1.x                         | Unit tests for pure logic only                                  |
| Runtime         | Node                                             | local 26.x, Vercel 24.x (LTS) | Both satisfy the Next and Prisma engine ranges                  |
| Package manager | npm                                              | 11.x                          | No global installs needed                                       |

---

## 1. Scope

### Must ship tonight

- Sign in with GitHub and sign out (Auth.js, database sessions).
- Create, edit and delete an application. Fields: company, job title, posting URL, notes, applied date, optional salary range and currency, stage.
- Kanban board with 4 stages:
  - drag and drop between stages and within a stage (order is saved);
  - keyboard drag and drop through dnd-kit's keyboard sensor, with screen-reader announcements;
  - a "Move to…" control on every card as a reliable path for keyboard, touch and screen-reader users.
- A stage summary with the count per stage and the total.
- Server-side zod validation for every input. Every query and mutation is scoped to the session user.
- Empty, loading and error states: empty board, empty column, `loading.tsx` skeleton, `error.tsx`, pending submit buttons, inline field errors, rollback of a failed optimistic move.
- Responsive layout that works at 360 px width, plus accessibility basics (labels, focus rings, contrast, skip link).
- Vitest unit tests for the validation schema, the ordering logic and the stats.
- Deployed on Vercel (`fra1`) with Neon (Frankfurt). English README.

### If time permits (in priority order)

1. GitHub Actions CI: lint, typecheck, test on every push.
2. Authorization tests for the server actions (mocked session and Prisma, asserting that every write is scoped by `userId`).
3. Edit in a modal through intercepting routes, keeping the full-page route as the fallback.
4. Search and filter by company or title. Sort a column by date.
5. Toast notifications. Dark mode.
6. Do not store the GitHub OAuth access token, which we never use (adapter override).
7. A DB-level `CHECK (salary_min <= salary_max)` added by editing the migration SQL.
8. Playwright e2e smoke test.

### Explicitly out of scope

Multiple boards, teams or sharing, reminders or email, attachments, stage history or timeline, rate limiting, CSP hardening.

---

## 2. Key decisions (with rationale)

| Decision                  | Choice                                                                                                                                                      | Why                                                                                                                                                                                                                     | Alternative considered                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js rendering mode    | **Cache Components off** (`cacheComponents` and `partialPrefetching`, which create-next-app 16.4 enables by default, were removed)                          | Every page here is per-user and dynamic, so there's nothing to cache. Cache Components would require `<Suspense>` around every dynamic access (`auth()`, cookies) and adds a new mental model for no benefit tonight.   | Keep them on and build the boundaries. Worth revisiting once there are public or static pages.                                             |
| Theme                     | **Light only** for the MVP                                                                                                                                  | Contrast is verified against one palette. Dark mode is on the "if time permits" list.                                                                                                                                   |                                                                                                                                            |
| Mutations                 | **Server Actions**                                                                                                                                          | Typed end to end. Built-in Origin check against CSRF. Forms work before JS loads. No public API needed.                                                                                                                 | Route handlers. The only one we have is the Auth.js callback, which Auth.js requires.                                                      |
| Where auth is enforced    | **Data layer and every action**: `requireUserId()` at the top of each server function                                                                       | Server Actions are public POST endpoints. Layout checks don't run on every navigation, and middleware-only auth has been bypassed before (CVE-2025-29927). Defense in depth.                                            | `proxy.ts` (formerly middleware) redirect. Not used: it would only be UX, not security.                                                    |
| Ownership checks          | Ownership is part of the query: `where: { id, userId }` with `updateMany`/`deleteMany`, then check `count`                                                  | Atomic, with no check-then-act race. A record that isn't yours returns **404, not 403**, so we don't reveal that it exists.                                                                                             | Fetch the record and compare `userId`. Two round trips and easy to forget.                                                                 |
| Session strategy          | **Database sessions** (Prisma adapter default)                                                                                                              | Revocable on the server (delete the row = sign out everywhere). No JWT handling. We have no edge middleware that would need a stateless token. Cost: one indexed lookup per request, in the same region.                | JWT sessions: no DB hit, but can't be revoked before they expire.                                                                          |
| Prisma driver             | **`@prisma/adapter-pg`** (node-postgres over TCP)                                                                                                           | Prisma 7 requires a driver adapter. `pg` is the standard driver and behaves the same locally, in CI and on Vercel's Node runtime. Fluid compute reuses instances, so TCP connections get reused.                        | `@prisma/adapter-neon` (HTTP/WebSocket). It is best on the Edge runtime, which we don't use.                                               |
| Pooled vs direct URL      | App runtime uses `DATABASE_URL` (pooled, `-pooler` host). Prisma CLI uses `DIRECT_URL` (via `prisma.config.ts`).                                            | Serverless scales out to many short-lived connections, and PgBouncer multiplexes them. Migrations need a stable session for advisory locks and multi-statement DDL, which transaction-mode PgBouncer doesn't guarantee. |                                                                                                                                            |
| Dev/prod data             | Neon branch **`dev`** for local work, **`production`** (Neon's default branch) for production                                                               | Development can't damage production data. Branches are free and instant.                                                                                                                                                | One database for both.                                                                                                                     |
| Region                    | Vercel `fra1` and Neon `aws-eu-central-1`                                                                                                                   | A page makes sequential round trips (session, then data). In the same region each costs about 1–2 ms. Across regions it can be about 100 ms or more.                                                                    |                                                                                                                                            |
| Ordering                  | **Integer `rank`, renumber the target column on each move** (section 3)                                                                                     | Simplest correct approach, easy to test and explain. The cost is O(cards in one column), which is fine for a personal tracker.                                                                                          | Fractional indexing or float midpoints (section 3).                                                                                        |
| Drag and drop             | **dnd-kit core/sortable**                                                                                                                                   | Stable API. Keyboard sensor and screen-reader announcements are built in, which is the main reason. Widely used.                                                                                                        | `@dnd-kit/react` (0.5.x, pre-1.0). Pragmatic DnD (keyboard support needs to be built separately). Native HTML5 DnD (no touch or keyboard). |
| Forms                     | **Full pages** (`/applications/new`, `/applications/[id]/edit`), `useActionState`                                                                           | Deep-linkable, work without JS, no focus-trap code, simple on mobile.                                                                                                                                                   | Modal dialogs. Moved to "if time permits" with intercepting routes.                                                                        |
| UI components             | **Native elements + Tailwind**. Native `<dialog>` for delete confirmation.                                                                                  | Fewer dependencies, and every line is ours to explain. `<dialog>` handles focus and Escape.                                                                                                                             | shadcn/ui or Radix: faster, but it puts generated code in the repo that we didn't write.                                                   |
| Validation                | One zod schema per input in `schema.ts`, used by the server (authoritative) and the form (hints)                                                            | Single source of truth. FormData strings are coerced and empty strings become `undefined`.                                                                                                                              |                                                                                                                                            |
| URL safety                | `postingUrl` accepts only `http:`/`https:`                                                                                                                  | Stops `javascript:` URLs from becoming stored XSS when rendered as `href`.                                                                                                                                              |                                                                                                                                            |
| Dates                     | `appliedAt` is `@db.Date`, parsed and formatted in UTC                                                                                                      | A date-only value has no timezone, and it avoids off-by-one-day display bugs.                                                                                                                                           | `timestamptz`                                                                                                                              |
| Stage enum in shared code | `STAGES = [...] as const satisfies readonly Stage[]` with a **type-only** import of Prisma's `Stage`                                                        | Client components get the list without bundling the Prisma client. The compiler catches drift between the two.                                                                                                          | Import the Prisma enum at runtime in client code.                                                                                          |
| Stats                     | Derived from the already-loaded list with a pure `countByStage()`                                                                                           | No extra query, and easy to test.                                                                                                                                                                                       | A `groupBy` query, which becomes worth it if we add pagination.                                                                            |
| Tests                     | Vitest on pure modules (schema, ranking, stats) in the Node environment                                                                                     | That's where most of the logic is. No DB or browser needed, so they run fast.                                                                                                                                           | Integration tests against a Neon branch later.                                                                                             |
| Errors                    | Actions return `{ ok: true } \| { ok: false; fieldErrors?; formError? }`. Unexpected errors are logged on the server and the client gets a generic message. | Internal and Prisma details don't leak to the client. Forms can show field-level errors.                                                                                                                                | Throwing to `error.tsx` everywhere.                                                                                                        |

---

## 3. Data model

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"   // gitignored, generated on postinstall
}

datasource db {
  provider = "postgresql"                // URLs live in prisma.config.ts (Prisma 7)
}

// ---------- Auth.js (shape from the official Prisma adapter schema) ----------
model User {
  id            String        @id @default(cuid())
  name          String?
  email         String?       @unique  // GitHub users can hide their email, so nullable
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  applications  Application[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {   // unused by GitHub OAuth; kept so email sign-in can be added later
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

// ---------- Domain ----------
enum Stage {
  APPLIED
  INTERVIEW
  OFFER
  REJECTED
}

model Application {
  id             String   @id @default(cuid())
  userId         String
  company        String                 // length limits are enforced in zod
  jobTitle       String                 // not "position", to avoid confusion with card position
  postingUrl     String?
  notes          String?
  appliedAt      DateTime @db.Date
  salaryMin      Int?                   // yearly, whole currency units
  salaryMax      Int?
  salaryCurrency String?  @db.Char(3)   // ISO 4217; required by zod when a salary is set
  stage          Stage    @default(APPLIED)
  rank           Int                    // order within the stage column (ascending)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, stage, rank])
}
```

Notes:

- `onDelete: Cascade` means deleting a user removes their data, so there are no orphans.
- The index `(userId, stage, rank)` serves the board query (`WHERE userId ORDER BY stage, rank`) and the column lookups used during a move.
- Validation limits (company ≤ 100, title ≤ 120, URL ≤ 2048, notes ≤ 5000, salary 0–10,000,000, min ≤ max) live in zod. Postgres `text` and `varchar` perform the same, so the DB stays simple.

### Ordering within a column

**Chosen: dense integer `rank`, renumbered per move.**

- **Read:** `ORDER BY rank ASC, createdAt DESC`. The second key is a deterministic tie-breaker.
- **Create:** `rank = min(rank in that stage) - 1`, so the new card appears at the top. Negative values are fine.
- **Move** `moveApplication({ id, toStage, toIndex })`, inside one `prisma.$transaction`:
  1. Confirm ownership: `findFirst({ where: { id, userId } })`. If it's missing, return not found.
  2. Load the ids in the target column (`userId`, `toStage`, ordered), excluding the moved card.
  3. Run the pure `reorder(ids, movedId, toIndex)`: clamp the index, insert, return the new order.
  4. Run the pure `rankUpdates(newOrder, currentRanks)`: return only the rows whose rank or stage changed.
  5. Apply each update with `updateMany({ where: { id, userId }, ... })`.
     The source column keeps a gap, which is harmless because only relative order matters.
- **The client sends an index, never a rank.** The server computes ranks from DB state, so a client can't corrupt ordering. The client uses the same pure `reorder()` for its optimistic update, so the UI and the server agree.
- **Concurrency:** two simultaneous moves in one column (two tabs) can produce duplicate ranks. The tie-breaker keeps the order stable, and the next move in that column renumbers it. That's acceptable for a single-user board. The fix if needed is a `SELECT … FOR UPDATE` on the user row.

**Rejected tonight:**

- _Fractional indexing_ (lexicographic string keys, as in Figma). It needs one write per move, but:
  - Postgres' default locale collation does not sort base-62 keys in byte order, so it needs `COLLATE "C"` added by hand in the migration;
  - concurrent inserts can generate equal keys;
  - it's more to explain.
    Switch to it if columns grow to thousands of cards or the board becomes collaborative. Only `ranking.ts` and the move action would change.
- _Float midpoint:_ after about 50 inserts at the same spot, double precision runs out, so it needs rebalancing logic anyway.

---

## 4. Folder structure

```
.
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ prisma.config.ts               # Prisma 7 config: schema path, DIRECT_URL for the CLI
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               # html/body, header, skip link
│  │  ├─ page.tsx                 # landing + "Sign in with GitHub" (redirects to /board when signed in)
│  │  ├─ not-found.tsx
│  │  ├─ api/auth/[...nextauth]/route.ts   # Auth.js handlers (the only route handler)
│  │  ├─ board/
│  │  │  ├─ page.tsx              # server: requireUserId → listApplications → <Board/>
│  │  │  ├─ loading.tsx           # skeleton
│  │  │  └─ error.tsx             # client error boundary with retry
│  │  └─ applications/
│  │     ├─ new/page.tsx
│  │     └─ [id]/edit/page.tsx    # notFound() if the record isn't the user's
│  ├─ auth.ts                     # NextAuth({ adapter: PrismaAdapter, providers: [GitHub] })
│  ├─ lib/
│  │  ├─ db.ts                    # server-only PrismaClient singleton (adapter-pg, DATABASE_URL)
│  │  └─ session.ts               # server-only requireUserId(), getOptionalUser()
│  ├─ features/applications/
│  │  ├─ stages.ts                # STAGES, labels (shared, client-safe)
│  │  ├─ schema.ts  + schema.test.ts
│  │  ├─ ranking.ts + ranking.test.ts
│  │  ├─ stats.ts   + stats.test.ts
│  │  ├─ sample-data.ts           # fictional applications (seed for the v2 demo)
│  │  ├─ queries.ts               # server-only reads, always scoped by userId
│  │  ├─ actions.ts               # "use server": create / update / delete / move
│  │  └─ components/
│  │     ├─ board.tsx             # client: DndContext, useOptimistic, live region
│  │     ├─ column.tsx
│  │     ├─ application-card.tsx
│  │     ├─ move-to-menu.tsx
│  │     ├─ application-form.tsx  # client: useActionState, field errors
│  │     ├─ delete-application.tsx
│  │     └─ stage-summary.tsx
│  ├─ components/                 # app-wide: header, sign-in/out buttons, small UI bits
│  ├─ types/next-auth.d.ts        # session.user.id augmentation
│  └─ generated/prisma/           # gitignored
├─ .env.example                   # committed (no values)
├─ .gitattributes                 # eol=lf (Windows: avoid CRLF diffs)
├─ vercel.json                    # { "regions": ["fra1"] }
├─ vitest.config.ts
├─ eslint.config.mjs  ·  prettier config
├─ CLAUDE.md  ·  PLAN.md  ·  README.md
```

Why feature folders: everything about "applications" (schema, logic, data access, UI) is in one place, and `app/` stays a thin routing layer. Adding a feature later means adding a sibling folder.

---

## 5. Milestones (time-boxed)

The same check runs after **every** milestone: `npm run check` (lint + typecheck + test) **and** `npm run build` pass, then one Conventional Commit.
**Working rule:** after each milestone I stop, post a short summary (what was done, verification results, commit), and wait for approval before starting the next one.
Scripts: `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`, `check` = all three, `postinstall` = `prisma generate`.

| #   | Milestone                                                                                                                                                                                                                                                                                                              | Budget | Ends at | Done when (besides the check above)                                                                                                                                                                                           | Commit                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Scaffold and tooling**: rename `master` to `main`; `create-next-app@16.4.6` (TS, Tailwind, ESLint, App Router, `src/`, `@/*`); `noUncheckedIndexedAccess`; Prettier with the Tailwind plugin; Vitest with one smoke test; `.gitattributes`; `.env.example` + `!.env.example` in `.gitignore`; CLAUDE.md (≤100 lines) | 20 m   | T+0:20  | `npm run dev` serves the page. `git status` shows no `.env` file.                                                                                                                                                             | `docs: add project plan and CLAUDE.md`, `chore: scaffold Next.js app with strict TypeScript, Tailwind, ESLint, Prettier and Vitest` |
| M2  | **Database**: Prisma 7.10.1 + adapter-pg; schema from section 3; `prisma.config.ts` (DIRECT_URL); `lib/db.ts` singleton (DATABASE_URL); first migration on the Neon `dev` branch                                                                                                                                       | 25 m   | T+0:45  | `prisma migrate status` is up to date. The tables are visible in Neon. A one-off `prisma.user.count()` works through the pooled URL.                                                                                          | `feat(db): add Prisma schema for Auth.js and job applications`                                                                      |
| M3  | **Auth**: `next-auth@5.0.0-beta.32`, GitHub provider, Prisma adapter, database sessions, `session.user.id`; `requireUserId()`; sign-in/out buttons (server actions); `/board` placeholder protected                                                                                                                    | 25 m   | T+1:10  | Local GitHub login works. User, Account and Session rows exist. `/board` while signed out redirects to `/`. Sign-out deletes the session row.                                                                                 | `feat(auth): add GitHub sign-in with Auth.js database sessions`                                                                     |
| M3b | **Smoke deploy (≤ 15 m)**: push to GitHub (I'll ask before the first push); Vercel project from the repo; `vercel.json` with `fra1`; Node 24.x; production GitHub OAuth app; production env vars (Production scope only); `prisma migrate deploy` against the Neon `production` branch (run from your terminal)        | 15 m   | T+1:25  | The Vercel build succeeds (`prisma generate` included). GitHub sign-in works on the production URL. The function region is `fra1`. Anything not fixed in 15 minutes is written down and fixed in M9.                          | `chore(deploy): add Vercel config with fra1 region`                                                                                 |
| M4  | **Domain logic and tests**: `stages.ts`, `schema.ts` (create/update/move/delete inputs), `ranking.ts`, `stats.ts`                                                                                                                                                                                                      | 20 m   | T+1:45  | Tests cover: rejecting a `javascript:` URL, empty-string coercion, salary min > max, currency required with salary; reorder within and across columns, index clamping, empty column; counts include zero stages.              | `feat(applications): add validation, ordering and stats logic with unit tests`                                                      |
| M5  | **Create and read**: `queries.ts`, `createApplication` action, new-application page and form (pending state, field errors), static 4-column board, empty board and empty column states, `loading.tsx`, `error.tsx`                                                                                                     | 30 m   | T+2:15  | Valid input creates a card at the top of its column. Invalid input shows inline errors (and the server rejects it even if client checks are bypassed). An empty account shows the call to action.                             | `feat(board): list applications by stage and create new applications`                                                               |
| M6  | **Edit, delete, move**: edit page (`notFound()` for foreign ids), update and delete actions, `<dialog>` confirmation, `moveApplication` action + "Move to…" control                                                                                                                                                    | 25 m   | T+2:40  | Edit and delete work. **Cross-user check:** signed in as a second GitHub account (or with a changed id in the URL), opening someone else's edit URL returns 404, and calling the action directly with that id changes 0 rows. | `feat(applications): edit, delete and move applications between stages`                                                             |
| M7  | **Drag and drop**: DndContext (stable `id`), pointer (with activation distance), touch (long-press) and keyboard sensors; sortable columns; `useOptimistic` + rollback with a message; English screen-reader announcements                                                                                             | 35 m   | T+3:15  | Mouse, keyboard (Space, arrows, Space, Esc) and touch moves persist after a reload. A forced server failure reverts the card and announces the error. No hydration warnings.                                                  | `feat(board): add drag-and-drop reordering with keyboard support`                                                                   |
| M8  | **Stats, sample data, a11y/mobile pass**: `stage-summary.tsx`; `sample-data.ts`; focus rings, contrast, labels; 360 px layout (columns scroll horizontally with snap); `prefers-reduced-motion`                                                                                                                        | 20 m   | T+3:35  | The Lighthouse accessibility score is at least 95 on `/` and `/board`, and axe DevTools shows no serious issues. Every action is possible with the keyboard alone.                                                            | `feat(board): add stage summary, sample data and accessibility/mobile polish`                                                       |
| M9  | **Final deploy**: push; apply any new migrations to the Neon `production` branch; fix anything left over from M3b; full production smoke test                                                                                                                                                                          | 10 m   | T+3:45  | The production URL works: sign in, create, drag, edit, delete.                                                                                                                                                                | `chore(deploy): ...` (only if config changed)                                                                                       |
| M10 | **README**: what it is, live link, screenshot, stack, architecture and decisions (summarizing this plan), local setup on Windows/PowerShell, env vars, scripts, tests, roadmap                                                                                                                                         | 15 m   | T+4:00  | Someone new can run it locally by following the README alone.                                                                                                                                                                 | `docs: add README with setup, architecture and decisions`                                                                           |

### Cut rules (protect the deploy)

- **At T+2:45**, if M6 isn't finished: skip the extra M8 polish, but keep the stats.
- **At T+3:15**, if drag and drop isn't solid: ship moves between columns only (cards drop at the top) and leave in-column reordering for later. "Move to…" already covers the functionality.
- **At T+3:35, start the final deploy no matter what.** A deployed MVP beats a polished localhost. The M3b smoke deploy has already de-risked it.

---

## 6. What you set up yourself (secrets never go into the chat)

**Before M2: Neon**

1. Create a project in region **AWS Europe Central 1 (Frankfurt)**.
2. Create a branch named `dev` from the default `production` branch.
3. On the `dev` branch, open Connect and copy the **pooled** string into `DATABASE_URL`. Turn pooling off and copy the **direct** string into `DIRECT_URL`. Write both into your local `.env`.

**Before M3: GitHub OAuth App (dev)**

1. Go to GitHub, then Settings → Developer settings → **OAuth Apps** (not GitHub Apps) → New.
2. Set Homepage to `http://localhost:3000` and Callback to `http://localhost:3000/api/auth/callback/github`.
3. Put the Client ID in `AUTH_GITHUB_ID` and the generated client secret in `AUTH_GITHUB_SECRET`.
4. Generate `AUTH_SECRET` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

**Before M3b (smoke deploy):** an empty public GitHub repo, and a Vercel account connected to GitHub. The production OAuth App is created during M3b, once the Vercel URL is known.

`.env.example` (committed, no values):

```
DATABASE_URL=""        # Neon pooled (host contains -pooler) — app runtime
DIRECT_URL=""          # Neon direct — Prisma CLI / migrations only
AUTH_SECRET=""
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
```

---

## 7. Risks and pitfalls

### npm / versions

- **`npm i prisma` installs an RC today** (`latest` = `8.0.0-rc.35`). Pin `prisma`, `@prisma/client` and `@prisma/adapter-pg` to `7.10.1`.
- **`npm i next-auth` installs v4.** Pin `next-auth@5.0.0-beta.32`.
- **Auth.js status.** v5 never left beta, and the project is now in maintenance mode under the Better Auth team. We use it as required, pin it exactly, and isolate it in `src/auth.ts` + `src/lib/session.ts` so a later move to Better Auth only touches those files. This is a good thing to say in an interview.
- **Node version.** Local is 26.x. Set Vercel to 24.x (LTS) in Project Settings. Both are within the Next and Prisma engine ranges.

### Neon + Prisma 7

- **Prisma 7 changes:**
  - the datasource URL moves out of `schema.prisma` into `prisma.config.ts`;
  - a driver adapter is required;
  - the CLI **does not load `.env` automatically** (`import "dotenv/config"` in the config);
  - the client is generated to a path we choose, imported as `@/generated/prisma/client`.
    Older tutorials that use `url`/`directUrl` in the schema won't work.
- **Migrations must use the direct URL.** Through the pooler (transaction mode) advisory locks and session state fail, and the errors are confusing or migrations hang.
- **`prisma migrate dev` needs a shadow database.** Prisma creates a temporary one on the same server, and Neon's owner role normally allows this. If it fails, create a `shadow` branch and set `shadowDatabaseUrl` in the config.
- **`prisma generate` on Vercel.** Vercel caches `node_modules`, so `postinstall: prisma generate` is required, or the build uses a stale or missing client. **Verified in M2:** Prisma's `env("DIRECT_URL")` helper throws when the variable is missing (`PrismaConfigEnvError`), which would break the Vercel build. `prisma.config.ts` therefore sets `datasource` only when `DIRECT_URL` exists. `generate` works without it, and `migrate` still fails with a clear message.

### Decisions made during M8

- **The stage summary lives inside the client board** and is computed with `countByStage` from what's on screen, so the counts follow drags and optimistic moves. It's a `<dl>`, so every number has a programmatic label.
- **Sample data is a pure builder** (`sample-data.ts`): fictional companies, `example.com` links, dates relative to today. A unit test also runs every sample row through the app's own zod schema. The "Load sample data" button that used it was removed in V1; the builder is kept to seed the V2 demo.
- **Automated accessibility tests** (`components/a11y.test.tsx`): the real components are rendered with `react-dom/server` and scanned by axe-core against WCAG 2.2 A/AA in jsdom.
  - They cover the board (summary, columns, cards, handles, Move to), the empty board, the form and the delete dialog.
  - **Mutation-checked:** breaking a label makes the test fail ("select-name").
- **Contrast** (jsdom can't measure it) was computed from the Tailwind palette:

  | Pair                                     | Ratio       | Minimum |
  | ---------------------------------------- | ----------- | ------- |
  | slate-900 / white (text)                 | 17.85       | 4.5     |
  | slate-700 / white                        | 10.35       | 4.5     |
  | slate-700 / slate-100 (columns)          | 9.45        | 4.5     |
  | slate-600 / white (notes)                | 7.58        | 4.5     |
  | slate-500 / white (placeholder)          | 4.76        | 4.5     |
  | blue-700 / white (links)                 | 6.70        | 4.5     |
  | white / red-700 (danger button)          | 6.47        | 4.5     |
  | red-800 / red-50 (error banner)          | 7.60        | 4.5     |
  | slate-500 input borders                  | 4.76        | 3       |
  | blue-600 focus ring on white / slate-100 | 5.17 / 4.72 | 3       |

  Tailwind v4 defines the palette in OKLCH, so these hex-based values are close approximations.

- **Mobile, reviewed at 360 px in the code:**
  - every touch target is at least 44 px;
  - the summary uses 2 columns with Total spanning both;
  - columns are 85% wide with horizontal scroll and snapping;
  - forms are a single column, and the header hides the user's name.
  - **Still to do manually:** Lighthouse and a real-device check on the deployed URL.

### Decisions made during M7

- **Drag starts only from a handle** (a 44×44 button with `touch-none`), not from the whole card. Links and the "Move to" form inside the card keep working, swipes elsewhere scroll on touch devices, and keyboard users get one clear focus target (Space/Enter picks the card up, the arrow keys move it, Space/Enter drops it, Escape cancels).
- **Three layers of state.** The server's `columns`, then `useOptimistic` for moves still in flight, then a drag preview. A failed move needs no manual rollback: when the transition ends React discards the optimistic state and the card snaps back. An error appears in a `role="alert"` banner.
- **The client sends `{ id, toStage, toIndex }` and the server computes the ranks.** Both sides use the same pure `moveCard`/`reorder`, so the optimistic order matches what gets saved (unit-tested).
- **Custom screen-reader announcements** (`dnd-announcements.ts`, tested). dnd-kit's defaults read out raw ids. Ours say e.g. "Picked up Acme. Applied, position 1 of 3."
- **The drag overlay is decorative** (`aria-hidden`) and drop animation is off. `[data-sortable]` transitions are disabled under `prefers-reduced-motion`.
- **`DndContext id="board-dnd"`** keeps the generated `aria-describedby` ids stable between server and client (no hydration mismatch).
- **"Move to" stays.** It remains the simplest path on touch devices and for screen-reader users, and it works without JS.

### Decisions made during M6

- **Authorization integration tests** were pulled forward from "if time permits" (`npm run test:integration`, `actions.integration.test.ts`).
  - They call the real Server Actions against the Neon `dev` branch. Only the session and Next's `redirect`/`revalidatePath` are mocked.
  - They prove that another user can't read, update, move or delete a record, that an injected `userId` is ignored, and that malformed ids are rejected.
  - **Mutation-checked:** removing `userId` from the delete query makes the cross-user test fail.
  - They're kept out of `npm test` because they need a database. CI can run them against a throwaway Neon branch later.
- **Bound action arguments are treated as untrusted input.** `updateApplication.bind(null, id)` sends `id` to the browser unencrypted, so every action validates it with zod and scopes it by `userId`.
- **Delete is idempotent.** Deleting a foreign or already-deleted id deletes 0 rows and still redirects to the board, so it doesn't reveal anything and doesn't fail on a double submit.
- **Native `<dialog>` with `showModal()` for the delete confirmation.** The browser handles focus trapping, Escape, an inert background and returning focus. Cancel gets the initial focus, not the destructive button.
- **"Move to" is a plain form posting to a Server Action.** It works with keyboard, touch, screen readers and without JS, and moves the card to the top of the chosen stage. Drag and drop (M7) reuses the same `moveApplication`.

### Decisions made during M5

- **Queries resolve the user themselves** (`listApplications()` takes no `userId` and calls `requireUserId()`). A caller can't pass the wrong id. React `cache` dedupes the session lookup per request.
- **Optional fields become explicit `null` before they're written** (`toApplicationData`). On an update Prisma treats `undefined` as "leave unchanged", so clearing a field would otherwise silently keep the old value.
- **Failed submits echo the typed values back.** React 19 resets a form after its action finishes, and the inputs re-render from the returned values as `defaultValue`. Focus moves to the first invalid field.
- **Forms work without JS.** Verified over HTTP with a temporary dev session: an invalid post re-renders with errors and the typed values, a valid post returns 303 to `/board`, and an injected `userId` field is ignored.
- **The signed-out `/board` response is 200 with an in-stream redirect, not a 307.** `loading.tsx` makes Next start streaming before the page runs `requireUserId()`. No data is rendered, because the session check runs before the query. Pages without `loading.tsx` return a real 307.
- **Next 16.4 `error.tsx` receives `retry()`**, which re-fetches the segment. Older versions used `reset()`. Checked against the bundled docs.

### Decisions made during M3

- **The build fails fast without `DATABASE_URL`.** This was verified: `src/lib/db.ts` throws at import, and Next imports route modules while collecting page data. This is intentional, because a misconfigured environment can't produce a deployment that looks healthy but is broken. For CI builds a dummy URL is enough, since the build opens no connection.
- **`agentRules: false` in next.config.** `next dev` in 16.4 otherwise (re)creates an `AGENTS.md`. Agent instructions live in CLAUDE.md.
- **`pages: { signIn: "/", error: "/" }`.** Auth errors land on our landing page, which shows a generic message. The `?error=` code is user-controllable, so it isn't echoed back.

### Decisions made during M2

- **`overrides: { effect: "3.22.5" }`.** `@prisma/config@7.10.1` pins `effect@3.20.0`, which has a high-severity ReDoS advisory (GHSA-7589-6fvf-x4pw). It's only reachable through our own config file, but a clean audit is cheap: we override to the patched version in the same 3.x line. `npm audit fix --force` would downgrade to Prisma 6, which is wrong. Remove the override once Prisma ships with a patched version.
- **`allowScripts` for `prisma` and `@prisma/engines`.** npm 11 blocks install scripts unless they are approved. Prisma's scripts install the engine binaries the CLI needs. They're approved per exact version, so an upgrade has to be re-approved on purpose.
- **No `engines` field in package.json.** Local is Node 26 and Vercel is 24, so `"24.x"` warned on every install. The Vercel Node version is set in Project Settings instead (M3b).
- **`sslmode=verify-full` in the connection strings.** `pg` warns that in v9 `require` will drop to libpq semantics (no certificate verification). Writing `verify-full` keeps today's stronger behavior explicitly.
- **Dev hot reload creates a new PrismaClient on every reload** and exhausts connections. Use a `globalThis` singleton in `lib/db.ts`.
- **Neon scale-to-zero.** The first request after the compute has been idle has a cold start of a few hundred ms. This is expected, and the README mentions it.
- **`@auth/prisma-adapter` types vs the new Prisma generator.** The adapter types come from `@prisma/client`, while our client is generated elsewhere, so a type mismatch is possible. If it happens, we use a narrowly scoped cast with a comment explaining it.

### Auth.js

- **One callback URL per GitHub OAuth App.** That means separate dev and prod apps, and **login doesn't work on Vercel Preview URLs**. This is accepted for the MVP.
- **Environment variable names follow the v5 convention** (`AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, which are inferred automatically). `AUTH_TRUST_HOST` and `AUTH_URL` aren't needed on Vercel.
- **GitHub email can be null** (private email), which is why `User.email` is optional. Never enable `allowDangerousEmailAccountLinking`.
- **Use an OAuth App, not a GitHub App.** GitHub Apps return extra token fields such as `refresh_token_expires_in`, which the default Account schema rejects.
- **`session.user.id`** requires a `session` callback plus module augmentation (`types/next-auth.d.ts`).
- **GitHub avatars through `next/image`** need `avatars.githubusercontent.com` in `images.remotePatterns`.

### Vercel

- **Environment variables apply at build time and are captured into the deployment.** After you change them, **redeploy**.
- **Scope DB and auth variables to Production only.** Otherwise Preview deployments would write to the production DB.
- **No `NEXT_PUBLIC_` prefix on any secret.** That prefix inlines the value into the client bundle.
- **Region.** `vercel.json` `regions: ["fra1"]`. Check the function region in the deployment details.
- **Migrations aren't run in the build.** Tonight you run `prisma migrate deploy` from your own VS Code terminal against the `production` branch's direct URL. It's explicit, done once, and keeps the secret out of the chat. Later this moves to a GitHub Actions job. Migrations should stay backward compatible (expand, then contract).

### Next.js 16

- **`params` and `searchParams` are Promises** and must be awaited.
- **`next lint` was removed.** We use the ESLint CLI with flat config.
- **`middleware.ts` is now `proxy.ts`.** We don't use it (see the "Where auth is enforced" decision).
- **After a mutation, call `revalidatePath("/board")`**, otherwise the cached server render shows stale data.

### dnd-kit and UI

- **Hydration mismatch** from auto-generated `aria-describedby` ids. Pass a stable `id` to `DndContext`.
- **Touch vs scroll.** Use a long-press activation delay so swipes still scroll. "Move to…" is the main path on touch devices.
- **Optimistic state** must revert when the action fails (`useOptimistic` resets when the transition ends). Show the error in an `aria-live` region.
- **`@dnd-kit/core`'s last release was December 2024.** It's mature and works with React 19, but it isn't actively developed. Section 2 lists the alternatives.

### Data and security

- **`javascript:` URLs.** Only `http`/`https` are allowed (see "URL safety").
- **Off-by-one dates.** `@db.Date` with UTC formatting everywhere.
- **Leaking internals.** Never return Prisma error messages to the client.
- **Never accept `userId` from the client.** It always comes from the session.
- **We store GitHub's access token without using it.** This is noted, and removing it is under "if time permits".

### Windows / tooling

- **Windows PowerShell 5.1 has no `&&`.** Use `;` or `if ($?) { … }` in terminal commands. npm scripts are fine because they run in `cmd`.
- **CRLF line endings** cause diff noise. `.gitattributes` with `* text=auto eol=lf`.
- **The create-next-app `.gitignore` contains `.env*`.** That pattern also ignores `.env.example`, so add `!.env.example`.

### Time

- Four hours is tight for this scope. The plan depends on doing the section 6 setup in parallel while I scaffold, and on following the cut rules strictly.

---

## 8. v2: portfolio polish

The MVP is live. v2 makes it a stronger portfolio piece: a reviewer can try it **without an
account**, and it gains the features a real job search needs (follow-ups, history, metrics,
search, archive), plus CI and end-to-end tests.

### Working rules

- Phases run in order. Each phase ends with lint, typecheck, unit tests, integration tests
  (Neon `dev` branch), and build passing → one Conventional Commit → a short report.
- **No push** until the owner approves it. **No command ever runs against the production
  database.** Every new migration is listed in its phase report with the command the owner
  runs, and a phase with a migration isn't pushed before that migration is applied.
- Migrations are expand-only (new tables, new nullable or defaulted columns), so the code
  that is still live keeps working once they're applied.
- Authorization stays as it is: every query is scoped by `userId` from the session. **Every new
  feature gets a cross-user access test.**
- Cut rule: if a phase isn't solid, it's cut, the reason is written here, and the next phase
  starts. Phases V2 and V3 matter most; V4 and V5 are the first to go if time runs out.

### Phases

| #   | Phase                   | Scope                                                                                                                                                                                                                                                                      | Migration                                    |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| V1  | Cleanup and CI          | Remove "Load sample data" (action, button, tests, docs). Keep the pure sample builder for the demo. GitHub Actions on every push and PR: lint, typecheck, unit tests, integration tests against a Postgres service container, build (Node 24). Status badge in the README. | none                                         |
| V2  | Try demo                | "Try demo" on the landing page creates a private, temporary demo user with realistic fictional data. One-hour hard session lifetime, lower quota, rate limits, daily cleanup cron protected by `CRON_SECRET`. Security review at the end.                                  | `User.isDemo`, `User.demoIpHash`             |
| V3  | Follow-ups and metrics  | `followUpAt` (optional date), "no response for N days" (Applied and Interview, 14 days), overdue follow-up warning, `ApplicationEvent` stage history on the edit page, Applied → Interview rate and average days to first response derived from events.                    | `Application.followUpAt`, `ApplicationEvent` |
| V4  | Search, filter, archive | Search by company or job title, filter by stage, archive and restore. Archived cards leave the board and the metrics and have their own page. Drag and drop and "Move to" keep working with a filter active.                                                               | `Application.archivedAt`                     |
| V5  | End-to-end and quality  | Playwright: demo sign-in → add → edit → move → delete, in a separate CI job. README GIF placeholder and v2 decisions. Full security review, security headers other than CSP.                                                                                               | none                                         |

### v2 decisions

| Decision                        | Choice                                                                                                                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                             | Alternative considered                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| "Load sample data"              | **Removed** (V1). The pure sample builder is kept and becomes the demo seed.                                                                                                                                               | It mixed demo rows into a real account. "Try demo" shows the same thing without an account, and real boards stay real.                                                                                                                                                                                                                                                          |                                                                                                                           |
| CI database                     | **Postgres service container** in GitHub Actions, migrated with `prisma migrate deploy`                                                                                                                                    | Integration tests need a real Postgres. A container is free, isolated per run and needs no secret. Neon-specific behavior (pooler, TLS) is covered by the live deployment, not by CI.                                                                                                                                                                                           | A throwaway Neon branch per run: closer to production, but it needs a Neon API key in GitHub secrets and network access.  |
| How a demo visitor is signed in | **A Server Action creates the demo user and an Auth.js `Session` row with Prisma and sets Auth.js' session cookie itself.** From then on Auth.js reads it exactly like a GitHub session.                                   | Auth.js v5 issues only JWT cookies for the Credentials provider, while this app uses database sessions. The documented workaround overrides `jwt.encode` for every sign-in, which changes code that real sign-ins depend on. Creating the row ourselves touches no Auth.js code path, the token is 256 random bits, and the demo is still a normal, revocable database session. | Credentials provider plus the `jwt.encode` override. Switching everything to JWT sessions (loses server-side revocation). |
| Demo session lifetime           | **Hard one hour**: `Session.expires = now + 1 h`, and the adapter's `updateSession` never extends a demo session. `getCurrentUser()` re-checks the demo age as a second guard.                                             | Verified in `@auth/core@0.41.3` (`lib/actions/session.js`): on a read, Auth.js extends a session to `maxAge` (30 days) once `expires - maxAge + updateAge` has passed. For a one-hour session that is immediately true, so without the wrapper the first page view would turn a demo into a 30-day session.                                                                     | A shorter global `maxAge` (would also sign real users out after an hour).                                                 |
| Demo users and OAuth            | **`linkAccount` refuses demo users** (adapter wrapper), and "Sign in with GitHub" ends a demo session before redirecting.                                                                                                  | Verified in `lib/actions/callback/handle-login.js`: when someone is signed in and signs in with a new OAuth account, Auth.js links that account to the **current** user. Without the guard a GitHub account could be attached to a demo user and deleted with it an hour later. A demo user never has an `Account` row.                                                         |                                                                                                                           |
| Demo rate limits                | **In Postgres:** at most 5 demos per IP per hour and 100 in total per hour, counted from demo `User` rows, serialized with a transaction-level advisory lock. The IP is stored only as an HMAC (keyed with `AUTH_SECRET`). | No new service or secret, and exact counts. The lock makes count-then-insert race-free, and demo creation is rare enough to serialize. On Vercel, `x-forwarded-for` is set by the platform. Self-hosted it can be spoofed, which is why the global cap exists.                                                                                                                  | Upstash Redis or Vercel KV: a new account and secret for one counter.                                                     |
| Exiting the demo                | **Signing out wipes the demo's applications and sessions immediately.** The bare user row (no personal data, only the IP hash) stays until cleanup.                                                                        | What a visitor typed into the demo is gone when they leave. Keeping the row means exiting doesn't reset the rate limit.                                                                                                                                                                                                                                                         | Deleting the whole user (would make the rate limit bypassable).                                                           |
| Quotas                          | **30 applications for a demo user, 1,000 for a GitHub user**, checked under a row lock on the user                                                                                                                         | Bounds what an anonymous visitor can store. The lock makes the count exact under concurrent submits.                                                                                                                                                                                                                                                                            |                                                                                                                           |
| Demo cleanup                    | **Daily Vercel Cron** → `GET /api/cron/cleanup-demo`, `Authorization: Bearer $CRON_SECRET` compared in constant time, fails closed when the secret is missing. Starting a demo also deletes expired demo users.            | Vercel Hobby allows one cron run per day. The lazy cleanup keeps the table bounded between runs. Deleting a user cascades to its sessions and applications.                                                                                                                                                                                                                     | A GitHub Actions schedule (needs the production database URL in GitHub).                                                  |
| Stage history                   | **`ApplicationEvent` (from, to, at)**, written in the same transaction as the create or the stage change. Reordering inside a column is not an event.                                                                      | Metrics need facts about when a card changed stage. One row per change is easy to query and to explain.                                                                                                                                                                                                                                                                         | Storing only `stageChangedAt` on the card (loses history).                                                                |
| Metrics on existing cards       | **No backfill.** Cards created before V3 have no history and are left out of the event-based metrics.                                                                                                                      | We can't know when an old card changed stage, and invented events would make the metrics wrong.                                                                                                                                                                                                                                                                                 |                                                                                                                           |
| Search and filter               | **URL parameters** (`?q=&stage=`), submitted by a GET form; the loaded board is filtered on the client. Drag and drop maps the visible position to the full column (pure, tested), so hidden cards keep their order.       | Shareable, survives a reload, works without JavaScript. One user's board is small, so filtering in memory is instant.                                                                                                                                                                                                                                                           | Filtering in SQL (the drop position couldn't be mapped back to the full column). Disabling drag and drop while filtering. |
| Archive                         | **`archivedAt` timestamp.** Archived cards are excluded from the board, from column renumbering and from metrics. Restoring puts the card on top of its stage.                                                             | One nullable column. The timestamp also tells when it was archived.                                                                                                                                                                                                                                                                                                             | An `ARCHIVED` stage (it's not a stage: a rejected card can be archived too).                                              |
| End-to-end tests                | **Playwright, Chromium only**, against `next start`, in a separate CI job. Locally the browser is installed inside `node_modules` (`PLAYWRIGHT_BROWSERS_PATH=0`), not globally.                                            | One browser keeps CI fast. The demo is also the e2e sign-in, so no OAuth mocking is needed.                                                                                                                                                                                                                                                                                     |                                                                                                                           |

### v2 risks

- **The demo cookie must match Auth.js' naming.** Auth.js prefixes the cookie with `__Secure-`
  on https and decides that from `AUTH_URL` or `x-forwarded-proto`. The helper mirrors that
  logic; the e2e test covers http, and production (https) is checked by hand after the deploy.
- **Auth.js internals.** The demo relies on how `updateSession` and `linkAccount` are called
  in the pinned `next-auth@5.0.0-beta.32` / `@auth/core@0.41.3`. Integration tests cover both
  wrappers, so an upgrade that changes this fails loudly.
- **Storage on the Neon free tier.** Bounded by the caps: at most 100 demos per hour, 30
  applications each, all deleted within about a day.
- **Privacy.** IP addresses are never stored in clear, and the hash lives at most about a day.
- **Migrations go first.** Each one is applied to production by the owner before the phase is
  pushed.
- **Flaky end-to-end tests** (cold database in CI): one retry in CI, trace on failure.

### V1 notes (done)

- The CI workflow can't run locally (no Docker); it is validated on the first push.
- `docs/screenshot.png` is referenced by the README but isn't committed yet (owner's file).

### V2 notes (done)

- **Verified, not assumed.** Both Auth.js behaviors behind the adapter guards were read in the
  installed `@auth/core@0.41.3` source, and the integration tests run Auth.js' real session
  handler. A control test shows that a regular session with the same one-hour expiry _is_
  extended to 30 days, which proves the premise of the guard.
- **Mutation-checked:** removing the `updateSession` guard, the `linkAccount` guard, or the
  advisory lock each makes a test fail. (Unlike the old sample-data lock test, the 8-way burst
  reliably overshoots the limit without the lock.)
- **Checked over real HTTP** (dev server, no JavaScript): the "Try demo" form returns 303 to
  `/board` with a one-hour `HttpOnly; SameSite=lax` cookie; the board shows the demo data;
  after two page loads the session's expiry is unchanged; a forged cookie renders no data;
  "Exit demo" clears the cookie and deletes the demo's applications and sessions.
- **`auth.config.ts`** holds the Auth.js config so tests can pass it to Auth.js' `Auth()`
  handler directly. `auth.ts` only calls `NextAuth(authConfig)`.
- **The demo quota lives with the demo rules** (`features/demo/config.ts`), and
  `createApplication` reads `isDemo` from the database under the row lock, not from the
  session.
- **Unknown IP:** when no `x-forwarded-for`/`x-real-ip` is present (local development), only the
  global limit applies. On Vercel the header is always set by the platform.
- **The sample builder moved** to `features/demo/sample-data.ts`.

#### Security review (V2, manual)

| Area                 | Finding                                                                                                                                                                                                           | Status     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `startDemo` (public) | Takes no input. It can only create a new demo user. Next's Server Action Origin check blocks cross-site posts (login CSRF). It refuses to replace an existing session (no session swapping for a signed-in user). | OK         |
| Session token        | 32 bytes from `crypto.randomBytes`, base64url. Stored in plain text like Auth.js' own tokens: a database leak would expose live sessions, but demo sessions last at most one hour.                                | Accepted   |
| Cookie               | Same name and options as Auth.js (`__Secure-` prefix, `Secure` on https, `HttpOnly`, `SameSite=Lax`, `Path=/`), `Expires` = session expiry.                                                                       | OK         |
| Lifetime             | Session row expiry is never extended for demo users (adapter guard). `getCurrentUser()` independently rejects a demo older than one hour (fails closed on a missing value).                                       | OK, tested |
| OAuth linking        | `linkAccount` refuses demo users. "Sign in with GitHub" from the demo signs out first.                                                                                                                            | OK, tested |
| Data isolation       | No query changed its `userId` scoping. Demo → real, real → demo and demo → demo access was tested on read, list, update, move and delete.                                                                         | OK, tested |
| Cron endpoint        | Bearer `CRON_SECRET`, constant-time comparison of SHA-256 digests, 401 when missing, wrong or not configured (min. 16 characters). Returns only counts. Can only delete expired demo users and expired sessions.  | OK, tested |
| Abuse / storage      | 100 demos per hour globally, 5 per IP, 30 applications per demo, rows deleted within about 25 hours. Stage history is capped too (V3: 300 events per demo).                                                       | OK         |
| IP spoofing          | `x-forwarded-for` can be forged when self-hosted without a proxy. On Vercel the platform sets it. The global cap bounds the damage either way.                                                                    | Accepted   |
| Privacy              | Raw IPs are never stored; the HMAC is deleted with the demo user. Demo data is deleted on exit.                                                                                                                   | OK         |
| Error messages       | Rate-limit and quota messages contain only the limits. Unexpected errors are logged and the client gets a generic message.                                                                                        | OK         |
| Residual             | Rotating `AUTH_SECRET` changes IP hashes, which resets the per-IP counts for at most an hour. Demo users can call Auth.js endpoints like `/api/auth/session`, which only ever return their own session.           | Accepted   |

### V3 notes (done)

- **Existing cards have no history.** No backfill (see decisions). They show no "entered stage"
  date (Interview cards fall back to the applied date for "no response"), their edit page says
  that history starts with this release, and the insights ignore them. Only applications
  created in Applied from now on count.
- **Metric definitions** (`history.ts`, unit-tested):
  - _Applied → Interview:_ of the applications created in Applied, the share that later reached
    Interview or Offer. Going straight to Offer counts, because an offer implies the interview
    process happened.
  - _Average time to first response:_ days from the applied date to the first stage change
    out of Applied (Interview, Offer or Rejected; a rejection is a response). Negative values,
    from an applied date entered after the fact, are clamped to 0.
  - Each needs at least 3 data points (`MIN_SAMPLE`), otherwise the panel explains what's
    missing instead of showing a misleading percentage.
- **"No response for N days"**: Applied counts from the applied date; Interview from when the
  card entered Interview (its latest event), falling back to the applied date. Threshold 14 days.
- **"Today" is decided once on the server** (UTC) and passed to the board as a string, so the
  server render and the hydrated client always agree, even around midnight.
- **The overdue warning doesn't rely on color:** its text says "Follow-up overdue by N days",
  with a warning icon and a thicker left border as extra cues. Contrast: red-800 on red-50
  (7.6:1), amber-900 on amber-50 (about 9:1).
- **History cap:** 300 events per demo user, 20,000 per GitHub user. Past it, stage changes
  still work but aren't recorded, so a script moving cards back and forth can't grow the
  table. Creation events need no cap: they're bounded by the application quota.
- **`ApplicationEvent.userId` is denormalized** so every event query can be scoped by owner
  like everything else. It is always the acting user, and the action has already proven that
  the card belongs to them in the same transaction.
- **The demo seed includes backdated history and follow-ups**, so a visitor immediately sees
  insights (38%, 6.8 days), two stale cards and all three follow-up states.
- **Cold-start bug found and fixed in V4:** a demo start is often the first query after Neon
  scaled to zero, and opening the connection inside the transaction exceeded Prisma's default
  `maxWait` (2 s), so the first demo after idle failed with "Couldn't start the demo". The
  integration test caught it on a cold run. `createDemo` now waits up to 10 s. Other
  transactions run after `requireUserId()`, whose session lookup has already opened the
  connection.
- `formatAppliedDate` was renamed `formatDate`, since it now also formats follow-ups and history.

### V4 notes (done)

- **Filtering happens on the client**, on the cards the board already loaded. The server page
  parses `?q=&stage=` with `parseBoardFilter`, which ignores anything unexpected (unknown stage,
  repeated params, queries over 100 characters) instead of failing.
- **Drag and drop with a filter:** dnd-kit works on the visible cards only. On drop,
  `visibleToFullIndex` places the card right before the visible card that now follows it (or
  right after the one before it), in the full column. Unit tests cover the cases and prove that
  without a filter it is the identity, so unfiltered behavior is unchanged. "Move to" needed no
  change: it always moves to the top of the stage.
- **A stage filter shows only that column**, full width. The summary keeps counting every card
  on the board, and a `role="status"` line says "Showing X of Y applications".
- **`next/form`** for the search: a plain GET form without JavaScript, client navigation with
  it.
- **Archive rules:** `archivedAt IS NULL` is part of the board query, the insights query, the
  move (an archived card can't be moved: it isn't on the board) and the column renumbering, so
  an archived card keeps its rank and never shifts others. Restore puts it on top of its
  stage. Archiving and restoring are idempotent and scoped by `userId` like every other write.
  Archived cards still count toward the quota (they are stored data).
- **Archive UI:** "Archive" / "Restore" on the edit page, an `/archive` page with restore
  buttons (plus loading and error states), and an "Archive (n)" link on the board.

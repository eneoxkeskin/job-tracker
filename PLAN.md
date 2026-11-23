# Job Application Tracker — MVP Plan

A portfolio project: sign in with GitHub, track job applications on a Kanban board
(Applied → Interview → Offer → Rejected), drag cards between stages, see a per-stage summary.

Goal for tonight (~3–4 h): a deployed, working MVP where every line can be explained in an interview.

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
- A "Load sample data" button in the empty-board state, so a reviewer sees a populated board right away. It inserts a fixed set of about 8 applications for the current user, and only when that user has no applications, which prevents duplicates.
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
│  │  ├─ sample-data.ts           # fixed demo applications for "Load sample data"
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

| #   | Milestone                                                                                                                                                                                                                                                                                                              | Budget | Ends at | Done when (besides the check above)                                                                                                                                                                                                                 | Commit                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Scaffold and tooling**: rename `master` to `main`; `create-next-app@16.4.6` (TS, Tailwind, ESLint, App Router, `src/`, `@/*`); `noUncheckedIndexedAccess`; Prettier with the Tailwind plugin; Vitest with one smoke test; `.gitattributes`; `.env.example` + `!.env.example` in `.gitignore`; CLAUDE.md (≤100 lines) | 20 m   | T+0:20  | `npm run dev` serves the page. `git status` shows no `.env` file.                                                                                                                                                                                   | `docs: add project plan and CLAUDE.md`, `chore: scaffold Next.js app with strict TypeScript, Tailwind, ESLint, Prettier and Vitest` |
| M2  | **Database**: Prisma 7.10.1 + adapter-pg; schema from section 3; `prisma.config.ts` (DIRECT_URL); `lib/db.ts` singleton (DATABASE_URL); first migration on the Neon `dev` branch                                                                                                                                       | 25 m   | T+0:45  | `prisma migrate status` is up to date. The tables are visible in Neon. A one-off `prisma.user.count()` works through the pooled URL.                                                                                                                | `feat(db): add Prisma schema for Auth.js and job applications`                                                                      |
| M3  | **Auth**: `next-auth@5.0.0-beta.32`, GitHub provider, Prisma adapter, database sessions, `session.user.id`; `requireUserId()`; sign-in/out buttons (server actions); `/board` placeholder protected                                                                                                                    | 25 m   | T+1:10  | Local GitHub login works. User, Account and Session rows exist. `/board` while signed out redirects to `/`. Sign-out deletes the session row.                                                                                                       | `feat(auth): add GitHub sign-in with Auth.js database sessions`                                                                     |
| M3b | **Smoke deploy (≤ 15 m)**: push to GitHub (I'll ask before the first push); Vercel project from the repo; `vercel.json` with `fra1`; Node 24.x; production GitHub OAuth app; production env vars (Production scope only); `prisma migrate deploy` against the Neon `production` branch (run from your terminal)        | 15 m   | T+1:25  | The Vercel build succeeds (`prisma generate` included). GitHub sign-in works on the production URL. The function region is `fra1`. Anything not fixed in 15 minutes is written down and fixed in M9.                                                | `chore(deploy): add Vercel config with fra1 region`                                                                                 |
| M4  | **Domain logic and tests**: `stages.ts`, `schema.ts` (create/update/move/delete inputs), `ranking.ts`, `stats.ts`                                                                                                                                                                                                      | 20 m   | T+1:45  | Tests cover: rejecting a `javascript:` URL, empty-string coercion, salary min > max, currency required with salary; reorder within and across columns, index clamping, empty column; counts include zero stages.                                    | `feat(applications): add validation, ordering and stats logic with unit tests`                                                      |
| M5  | **Create and read**: `queries.ts`, `createApplication` action, new-application page and form (pending state, field errors), static 4-column board, empty board and empty column states, `loading.tsx`, `error.tsx`                                                                                                     | 30 m   | T+2:15  | Valid input creates a card at the top of its column. Invalid input shows inline errors (and the server rejects it even if client checks are bypassed). An empty account shows the call to action.                                                   | `feat(board): list applications by stage and create new applications`                                                               |
| M6  | **Edit, delete, move**: edit page (`notFound()` for foreign ids), update and delete actions, `<dialog>` confirmation, `moveApplication` action + "Move to…" control                                                                                                                                                    | 25 m   | T+2:40  | Edit and delete work. **Cross-user check:** signed in as a second GitHub account (or with a changed id in the URL), opening someone else's edit URL returns 404, and calling the action directly with that id changes 0 rows.                       | `feat(applications): edit, delete and move applications between stages`                                                             |
| M7  | **Drag and drop**: DndContext (stable `id`), pointer (with activation distance), touch (long-press) and keyboard sensors; sortable columns; `useOptimistic` + rollback with a message; English screen-reader announcements                                                                                             | 35 m   | T+3:15  | Mouse, keyboard (Space, arrows, Space, Esc) and touch moves persist after a reload. A forced server failure reverts the card and announces the error. No hydration warnings.                                                                        | `feat(board): add drag-and-drop reordering with keyboard support`                                                                   |
| M8  | **Stats, sample data, a11y/mobile pass**: `stage-summary.tsx`; `sample-data.ts` + `loadSampleData` action (only when the user has 0 applications) shown in the empty state; focus rings, contrast, labels; 360 px layout (columns scroll horizontally with snap); `prefers-reduced-motion`                             | 20 m   | T+3:35  | "Load sample data" fills an empty board once, and a second call inserts nothing. The Lighthouse accessibility score is at least 95 on `/` and `/board`, and axe DevTools shows no serious issues. Every action is possible with the keyboard alone. | `feat(board): add stage summary, sample data and accessibility/mobile polish`                                                       |
| M9  | **Final deploy**: push; apply any new migrations to the Neon `production` branch; fix anything left over from M3b; full production smoke test                                                                                                                                                                          | 10 m   | T+3:45  | The production URL works: sign in, load sample data, create, drag, edit, delete.                                                                                                                                                                    | `chore(deploy): ...` (only if config changed)                                                                                       |
| M10 | **README**: what it is, live link, screenshot, stack, architecture and decisions (summarizing this plan), local setup on Windows/PowerShell, env vars, scripts, tests, roadmap                                                                                                                                         | 15 m   | T+4:00  | Someone new can run it locally by following the README alone.                                                                                                                                                                                       | `docs: add README with setup, architecture and decisions`                                                                           |

### Cut rules (protect the deploy)

- **At T+2:45**, if M6 isn't finished: skip the extra M8 polish, but keep the stats and the sample data.
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

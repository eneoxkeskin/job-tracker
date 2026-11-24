// Archive and restore (PLAN.md §8, V4) against a real database. Mocked: only the session and
// Next's redirect / revalidatePath, as in actions.integration.test.ts.
import "dotenv/config";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const session = vi.hoisted(() => ({ userId: "" }));

class RedirectSignal extends Error {}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new RedirectSignal();
  },
}));
vi.mock("@/lib/session", () => ({
  requireUserId: async () => session.userId,
}));

const { db } = await import("@/lib/db");
const actions = await import("./actions");
const queries = await import("./queries");

const TAG = `itest-archive-${Date.now()}`;
let alice = "";
let bob = "";

async function seed(
  company: string,
  stage: "APPLIED" | "INTERVIEW" = "APPLIED",
  rank = 0,
  userId = alice,
) {
  return db.application.create({
    data: {
      userId,
      company,
      jobTitle: "Dev",
      appliedAt: new Date("2026-11-01"),
      stage,
      rank,
    },
  });
}

async function archive(id: string) {
  await expect(actions.archiveApplication(id)).rejects.toThrow(RedirectSignal);
}

async function boardCompanies(stage: "APPLIED" | "INTERVIEW") {
  return (await queries.listApplications())
    .filter((a) => a.stage === stage)
    .sort((a, b) => a.rank - b.rank)
    .map((a) => a.company);
}

beforeAll(async () => {
  alice = (await db.user.create({ data: { name: `${TAG}-alice` } })).id;
  bob = (await db.user.create({ data: { name: `${TAG}-bob` } })).id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.$disconnect();
});

beforeEach(async () => {
  await db.application.deleteMany({ where: { userId: { in: [alice, bob] } } });
  session.userId = alice;
});

describe("archive", () => {
  it("moves an application off the board into the archive, keeping its data", async () => {
    const app = await seed("old");
    await seed("kept", "APPLIED", 1);

    await archive(app.id);

    expect(await boardCompanies("APPLIED")).toEqual(["kept"]);
    expect(
      (await queries.listArchivedApplications()).map((a) => a.company),
    ).toEqual(["old"]);
    expect(await queries.countArchivedApplications()).toBe(1);
    // Still reachable for editing.
    expect((await queries.getApplication(app.id))?.archivedAt).toBeInstanceOf(
      Date,
    );
  });

  it("archived applications don't count in the insights", async () => {
    for (const company of ["a", "b", "c"]) {
      await expect(
        actions.createApplication(
          { status: "idle" },
          (() => {
            const fd = new FormData();
            fd.set("company", company);
            fd.set("jobTitle", "Dev");
            fd.set("appliedAt", "2026-11-01");
            fd.set("stage", "APPLIED");
            return fd;
          })(),
        ),
      ).rejects.toThrow(RedirectSignal);
    }
    expect((await queries.getInsights()).tracked).toBe(3);

    const a = await db.application.findFirstOrThrow({
      where: { userId: alice, company: "a" },
    });
    await archive(a.id);
    expect((await queries.getInsights()).tracked).toBe(2);
  });

  it("an archived card can't be moved, and column renumbering leaves it alone", async () => {
    const archived = await seed("archived", "APPLIED", 1);
    const a = await seed("a", "APPLIED", 0);
    await seed("b", "APPLIED", 2);
    await archive(archived.id);

    expect(
      await actions.moveApplication({
        id: archived.id,
        toStage: "INTERVIEW",
        toIndex: 0,
      }),
    ).toEqual({ ok: false, error: "This application no longer exists." });

    expect(
      await actions.moveApplication({
        id: a.id,
        toStage: "APPLIED",
        toIndex: 1,
      }),
    ).toEqual({ ok: true });
    expect(await boardCompanies("APPLIED")).toEqual(["b", "a"]);
    const after = await db.application.findUniqueOrThrow({
      where: { id: archived.id },
    });
    expect(after).toMatchObject({ rank: 1, stage: "APPLIED" });
  });

  it("restore puts the card back on top of its stage", async () => {
    const app = await seed("back", "INTERVIEW", 5);
    await seed("i1", "INTERVIEW", 0);
    await archive(app.id);

    await actions.restoreApplication(app.id);

    expect(await boardCompanies("INTERVIEW")).toEqual(["back", "i1"]);
    expect(await queries.countArchivedApplications()).toBe(0);
  });

  it("archiving twice or restoring an active card changes nothing", async () => {
    const app = await seed("once");
    await archive(app.id);
    const first = await db.application.findUniqueOrThrow({
      where: { id: app.id },
    });
    await archive(app.id);
    expect(
      await db.application.findUniqueOrThrow({ where: { id: app.id } }),
    ).toEqual(first);

    const active = await seed("active", "APPLIED", 3);
    await actions.restoreApplication(active.id);
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: active.id } }))
        .rank,
    ).toBe(3);
  });
});

describe("archive is private", () => {
  it("another user can't archive, restore or list someone else's applications", async () => {
    const live = await seed("live");
    const archived = await seed("archived", "APPLIED", 1);
    await archive(archived.id);
    const before = await db.application.findMany({
      where: { userId: alice },
      orderBy: { id: "asc" },
    });

    session.userId = bob;
    await archive(live.id);
    await actions.restoreApplication(archived.id);
    expect(await queries.listArchivedApplications()).toEqual([]);
    expect(await queries.countArchivedApplications()).toBe(0);
    expect(await queries.getApplication(archived.id)).toBeNull();

    expect(
      await db.application.findMany({
        where: { userId: alice },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
  });

  it("malformed ids are ignored", async () => {
    await archive("' OR 1=1 --");
    await actions.restoreApplication("not-a-cuid");
    expect(
      await db.application.count({
        where: { archivedAt: { not: null }, userId: alice },
      }),
    ).toBe(0);
  });
});

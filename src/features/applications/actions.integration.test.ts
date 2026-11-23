// Authorization and persistence tests for the Server Actions against a real database.
// Only the framework edges are mocked: the session (which user is "signed in"), and Next's
// redirect / revalidatePath. Everything else — zod, Prisma, SQL — runs for real.
// Run with `npm run test:integration` (uses DATABASE_URL from .env: the Neon dev branch).
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

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectSignal(url);
  },
}));
vi.mock("@/lib/session", () => ({
  requireUserId: async () => session.userId,
}));

const { db } = await import("@/lib/db");
const actions = await import("./actions");
const { getApplication, listApplications } = await import("./queries");

const TAG = `itest-${Date.now()}`;
let alice = "";
let bob = "";

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    company: `${TAG} Co`,
    jobTitle: "Engineer",
    postingUrl: "https://example.com/job",
    notes: "note",
    appliedAt: "2026-11-01",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "",
    stage: "APPLIED",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const IDLE = { status: "idle" } as const;

async function seed(
  userId: string,
  company: string,
  stage: "APPLIED" | "INTERVIEW",
  rank: number,
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

async function columnIds(userId: string, stage: "APPLIED" | "INTERVIEW") {
  const rows = await db.application.findMany({
    where: { userId, stage },
    orderBy: [{ rank: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    select: { company: true },
  });
  return rows.map((r) => r.company);
}

beforeAll(async () => {
  alice = (await db.user.create({ data: { name: `${TAG}-alice` } })).id;
  bob = (await db.user.create({ data: { name: `${TAG}-bob` } })).id;
});

afterAll(async () => {
  // Cascades to applications.
  await db.user.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.$disconnect();
});

beforeEach(async () => {
  await db.application.deleteMany({ where: { userId: { in: [alice, bob] } } });
  session.userId = alice;
});

describe("cross-user access is impossible", () => {
  it("bob can't read, update, move or delete alice's application", async () => {
    const target = await seed(alice, "A1", "APPLIED", 0);
    const before = await db.application.findUniqueOrThrow({
      where: { id: target.id },
    });
    session.userId = bob;

    expect(await getApplication(target.id)).toBeNull();
    expect(await listApplications()).toEqual([]);

    const update = await actions.updateApplication(
      target.id,
      IDLE,
      form({ company: "pwned" }),
    );
    expect(update).toMatchObject({
      status: "error",
      formError: "This application no longer exists.",
    });

    expect(
      await actions.moveApplication({
        id: target.id,
        toStage: "OFFER",
        toIndex: 0,
      }),
    ).toEqual({
      ok: false,
      error: "This application no longer exists.",
    });

    await expect(actions.deleteApplication(target.id)).rejects.toThrow(
      RedirectSignal,
    );

    const after = await db.application.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(after).toEqual(before);
  });

  it("a userId injected into the form is ignored on create", async () => {
    session.userId = bob;
    const fd = form({ company: `${TAG} injected` });
    fd.set("userId", alice);

    await expect(actions.createApplication(IDLE, fd)).rejects.toThrow(
      RedirectSignal,
    );

    const row = await db.application.findFirstOrThrow({
      where: { company: `${TAG} injected` },
    });
    expect(row.userId).toBe(bob);
  });

  it("a malformed id is rejected without touching the database", async () => {
    await expect(actions.deleteApplication("' OR 1=1 --")).rejects.toThrow(
      RedirectSignal,
    );
    expect(await getApplication("not-a-cuid")).toBeNull();
    expect(
      await actions.moveApplication({
        id: "' OR 1=1 --",
        toStage: "OFFER",
        toIndex: 0,
      }),
    ).toEqual({ ok: false, error: "Invalid move." });
  });
});

describe("create / update / delete", () => {
  it("creates new cards on top of their column", async () => {
    await seed(alice, "existing", "APPLIED", 0);
    await expect(
      actions.createApplication(IDLE, form({ company: "newest" })),
    ).rejects.toThrow(RedirectSignal);
    expect(await columnIds(alice, "APPLIED")).toEqual(["newest", "existing"]);
  });

  it("returns field errors and saves nothing for invalid input", async () => {
    const result = await actions.createApplication(
      IDLE,
      form({ company: "", postingUrl: "javascript:alert(1)" }),
    );
    expect(result).toMatchObject({ status: "error" });
    if (result.status === "error") {
      expect(result.fieldErrors.company).toBeDefined();
      expect(result.fieldErrors.postingUrl).toBeDefined();
      expect(result.values.postingUrl).toBe("javascript:alert(1)"); // echoed back for the form
    }
    expect(await db.application.count({ where: { userId: alice } })).toBe(0);
  });

  it("clears optional fields that were emptied (null, not 'unchanged')", async () => {
    const app = await seed(alice, "A1", "APPLIED", 0);
    await db.application.update({
      where: { id: app.id },
      data: { postingUrl: "https://old.example.com", notes: "old" },
    });

    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "A1", postingUrl: "", notes: "" }),
      ),
    ).rejects.toThrow(RedirectSignal);

    const after = await db.application.findUniqueOrThrow({
      where: { id: app.id },
    });
    expect(after.postingUrl).toBeNull();
    expect(after.notes).toBeNull();
  });

  it("a stage change from the edit form puts the card on top of the new column", async () => {
    const app = await seed(alice, "mover", "APPLIED", 0);
    await seed(alice, "I1", "INTERVIEW", 0);

    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "mover", stage: "INTERVIEW" }),
      ),
    ).rejects.toThrow(RedirectSignal);

    expect(await columnIds(alice, "INTERVIEW")).toEqual(["mover", "I1"]);
  });

  it("deletes the owner's application", async () => {
    const app = await seed(alice, "A1", "APPLIED", 0);
    await expect(actions.deleteApplication(app.id)).rejects.toThrow(
      RedirectSignal,
    );
    expect(
      await db.application.findUnique({ where: { id: app.id } }),
    ).toBeNull();
  });
});

describe("loadSampleData", () => {
  it("fills an empty board once; a second call adds nothing", async () => {
    await actions.loadSampleData();
    const first = await db.application.count({ where: { userId: alice } });
    expect(first).toBe(8);
    expect(await columnIds(alice, "APPLIED")).toEqual([
      "Northwind Labs",
      "Bluefin Analytics",
      "Copperleaf Health",
    ]);

    await actions.loadSampleData();
    expect(await db.application.count({ where: { userId: alice } })).toBe(
      first,
    );
  });

  it("never mixes demo data into a board that already has applications", async () => {
    await seed(alice, "real one", "APPLIED", 0);
    await actions.loadSampleData();
    expect(await columnIds(alice, "APPLIED")).toEqual(["real one"]);
  });

  // Smoke test only: it passes with the row lock, but the race window is timing-dependent and
  // did not reproduce locally even without the lock, so it does not *prove* the lock works.
  // The lock is justified by reasoning (count-then-insert under READ COMMITTED); see PLAN.md.
  it("concurrent calls (double click, two tabs) still insert only one set", async () => {
    await Promise.all(
      Array.from({ length: 10 }, () => actions.loadSampleData()),
    );
    expect(await db.application.count({ where: { userId: alice } })).toBe(8);
  });

  it("only affects the signed-in user", async () => {
    await actions.loadSampleData();
    expect(await db.application.count({ where: { userId: bob } })).toBe(0);
  });
});

describe("moveApplication", () => {
  it("reorders within a column and renumbers ranks densely", async () => {
    const a = await seed(alice, "a", "APPLIED", 0);
    await seed(alice, "b", "APPLIED", 1);
    await seed(alice, "c", "APPLIED", 2);

    expect(
      await actions.moveApplication({
        id: a.id,
        toStage: "APPLIED",
        toIndex: 2,
      }),
    ).toEqual({ ok: true });

    expect(await columnIds(alice, "APPLIED")).toEqual(["b", "c", "a"]);
    const ranks = await db.application.findMany({
      where: { userId: alice, stage: "APPLIED" },
      orderBy: { rank: "asc" },
      select: { rank: true },
    });
    expect(ranks.map((r) => r.rank)).toEqual([0, 1, 2]);
  });

  it("moves across columns to the requested position and clamps large indexes", async () => {
    const a = await seed(alice, "a", "APPLIED", 0);
    const b = await seed(alice, "b", "APPLIED", 1);
    await seed(alice, "i1", "INTERVIEW", 0);
    await seed(alice, "i2", "INTERVIEW", 1);

    expect(
      await actions.moveApplication({
        id: a.id,
        toStage: "INTERVIEW",
        toIndex: 1,
      }),
    ).toEqual({ ok: true });
    expect(await columnIds(alice, "INTERVIEW")).toEqual(["i1", "a", "i2"]);

    expect(
      await actions.moveApplication({
        id: b.id,
        toStage: "INTERVIEW",
        toIndex: 999,
      }),
    ).toEqual({ ok: true });
    expect(await columnIds(alice, "INTERVIEW")).toEqual(["i1", "a", "i2", "b"]);
    expect(await columnIds(alice, "APPLIED")).toEqual([]);
  });

  it("the 'Move to' form moves the card to the top of the chosen stage", async () => {
    const a = await seed(alice, "a", "APPLIED", 0);
    await seed(alice, "i1", "INTERVIEW", 0);
    const fd = new FormData();
    fd.set("id", a.id);
    fd.set("toStage", "INTERVIEW");

    await actions.moveApplicationFromForm(fd);

    expect(await columnIds(alice, "INTERVIEW")).toEqual(["a", "i1"]);
  });

  it("the 'Move to' form is a no-op when the chosen stage is the current one", async () => {
    await seed(alice, "i0", "INTERVIEW", 0);
    const i1 = await seed(alice, "i1", "INTERVIEW", 1);
    const before = await db.application.findMany({
      where: { userId: alice },
      orderBy: { id: "asc" },
    });
    const fd = new FormData();
    fd.set("id", i1.id);
    fd.set("toStage", "INTERVIEW");
    fd.set("currentStage", "INTERVIEW");

    await actions.moveApplicationFromForm(fd);

    // Not even moved to the top of its own column.
    expect(
      await db.application.findMany({
        where: { userId: alice },
        orderBy: { id: "asc" },
      }),
    ).toEqual(before);
  });
});

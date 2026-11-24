// Stage history, follow-ups and metrics (PLAN.md §8, V3) against a real database. Mocked: only
// the session and Next's redirect / revalidatePath, as in actions.integration.test.ts.
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
const { getApplication, getInsights, listApplications } =
  await import("./queries");
const { createDemo } = await import("@/features/demo/server");
const { STAGE_EVENT_QUOTA } = await import("@/features/demo/config");

const TAG = `itest-history-${Date.now()}`;
const IDLE = { status: "idle" } as const;
let alice = "";
let bob = "";

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    company: `${TAG} Co`,
    jobTitle: "Engineer",
    appliedAt: "2026-11-01",
    stage: "APPLIED",
    ...overrides,
  }))
    fd.set(k, v);
  return fd;
}

/** Creates through the real action, so the creation event is recorded too. */
async function create(company: string, stage = "APPLIED") {
  await expect(
    actions.createApplication(IDLE, form({ company, stage })),
  ).rejects.toThrow(RedirectSignal);
  return db.application.findFirstOrThrow({
    where: { userId: session.userId, company },
  });
}

async function eventsOf(applicationId: string) {
  return db.applicationEvent.findMany({
    where: { applicationId },
    orderBy: [{ at: "asc" }, { id: "asc" }],
    select: { fromStage: true, toStage: true, userId: true },
  });
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

describe("stage events", () => {
  it("records the creation with the owner's id", async () => {
    const app = await create("created", "INTERVIEW");
    expect(await eventsOf(app.id)).toEqual([
      { fromStage: null, toStage: "INTERVIEW", userId: alice },
    ]);
  });

  it("records a stage change from the edit form, but not an edit that keeps the stage", async () => {
    const app = await create("edited");
    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "edited", notes: "x" }),
      ),
    ).rejects.toThrow(RedirectSignal);
    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "edited", stage: "REJECTED" }),
      ),
    ).rejects.toThrow(RedirectSignal);

    expect(await eventsOf(app.id)).toEqual([
      { fromStage: null, toStage: "APPLIED", userId: alice },
      { fromStage: "APPLIED", toStage: "REJECTED", userId: alice },
    ]);
  });

  it("records moves between columns, not reorders within one", async () => {
    const a = await create("a");
    await create("b");
    expect(
      await actions.moveApplication({
        id: a.id,
        toStage: "APPLIED",
        toIndex: 1,
      }),
    ).toEqual({ ok: true });
    expect(
      await actions.moveApplication({
        id: a.id,
        toStage: "INTERVIEW",
        toIndex: 0,
      }),
    ).toEqual({ ok: true });

    expect(await eventsOf(a.id)).toEqual([
      { fromStage: null, toStage: "APPLIED", userId: alice },
      { fromStage: "APPLIED", toStage: "INTERVIEW", userId: alice },
    ]);
  });

  it("are deleted with their application", async () => {
    const app = await create("deleted");
    await expect(actions.deleteApplication(app.id)).rejects.toThrow(
      RedirectSignal,
    );
    expect(
      await db.applicationEvent.count({ where: { applicationId: app.id } }),
    ).toBe(0);
  });

  it("past the history limit, moves still work but aren't recorded", async () => {
    const demo = await db.user.create({
      data: { name: `${TAG}-demo`, isDemo: true },
    });
    session.userId = demo.id;
    const app = await create("busy");
    await db.applicationEvent.createMany({
      data: Array.from({ length: STAGE_EVENT_QUOTA.demo }, () => ({
        applicationId: app.id,
        userId: demo.id,
        toStage: "APPLIED" as const,
      })),
    });

    expect(
      await actions.moveApplication({
        id: app.id,
        toStage: "OFFER",
        toIndex: 0,
      }),
    ).toEqual({ ok: true });
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app.id } })).stage,
    ).toBe("OFFER");
    expect(
      await db.applicationEvent.count({ where: { userId: demo.id } }),
    ).toBe(
      STAGE_EVENT_QUOTA.demo + 1, // the creation event + the pre-filled ones
    );
  });
});

describe("follow-ups", () => {
  it("are saved, shown on the board, and can be cleared", async () => {
    const app = await create("follow");
    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "follow", followUpAt: "2026-12-01" }),
      ),
    ).rejects.toThrow(RedirectSignal);
    const [card] = await listApplications();
    expect(card?.followUpAt).toEqual(new Date("2026-12-01T00:00:00.000Z"));

    await expect(
      actions.updateApplication(
        app.id,
        IDLE,
        form({ company: "follow", followUpAt: "" }),
      ),
    ).rejects.toThrow(RedirectSignal);
    expect(
      (await db.application.findUniqueOrThrow({ where: { id: app.id } }))
        .followUpAt,
    ).toBeNull();
  });

  it("the board knows when a card entered its current stage", async () => {
    const app = await create("entered");
    await actions.moveApplication({
      id: app.id,
      toStage: "INTERVIEW",
      toIndex: 0,
    });
    const move = await db.applicationEvent.findFirstOrThrow({
      where: { applicationId: app.id, toStage: "INTERVIEW" },
    });
    const [card] = await listApplications();
    expect(card?.stageEnteredAt).toEqual(move.at);
  });

  it("cards without history fall back to null", async () => {
    await db.application.create({
      data: {
        userId: alice,
        company: "legacy",
        jobTitle: "Dev",
        appliedAt: new Date("2026-10-01"),
        stage: "INTERVIEW",
        rank: 0,
      },
    });
    const [card] = await listApplications();
    expect(card?.stageEnteredAt).toBeNull();
  });
});

describe("history and metrics are private", () => {
  it("another user can't see an application's history", async () => {
    const app = await create("secret");
    session.userId = bob;
    expect(await getApplication(app.id)).toBeNull();
  });

  it("the owner sees the history in order", async () => {
    const app = await create("mine");
    await actions.moveApplication({ id: app.id, toStage: "OFFER", toIndex: 0 });
    const result = await getApplication(app.id);
    expect(result?.events.map((e) => [e.fromStage, e.toStage])).toEqual([
      [null, "APPLIED"],
      ["APPLIED", "OFFER"],
    ]);
  });

  it("a failed cross-user move records no event for anyone", async () => {
    const app = await create("target");
    session.userId = bob;
    expect(
      await actions.moveApplication({
        id: app.id,
        toStage: "OFFER",
        toIndex: 0,
      }),
    ).toMatchObject({ ok: false });
    expect(await eventsOf(app.id)).toHaveLength(1);
    expect(await db.applicationEvent.count({ where: { userId: bob } })).toBe(0);
  });

  it("metrics only count the signed-in user's applications", async () => {
    session.userId = bob;
    for (const company of ["b1", "b2", "b3"]) {
      const app = await create(company);
      await actions.moveApplication({
        id: app.id,
        toStage: "INTERVIEW",
        toIndex: 0,
      });
    }
    expect((await getInsights()).interviewRate).toEqual({
      reached: 3,
      of: 3,
      percent: 100,
    });

    session.userId = alice;
    expect(await getInsights()).toEqual({
      tracked: 0,
      interviewRate: null,
      averageDaysToResponse: null,
    });
  });
});

describe("demo seed", () => {
  it("comes with history, so the demo's insights aren't empty", async () => {
    const demo = await createDemo({ ipHash: null, now: new Date() });
    if (!demo.ok) throw new Error("demo not created");
    try {
      session.userId = demo.userId;
      const insights = await getInsights();
      expect(insights.interviewRate?.percent).toBe(38);
      expect(insights.averageDaysToResponse?.responses).toBe(5);
      expect(
        await db.applicationEvent.count({
          where: {
            userId: demo.userId,
            NOT: { application: { userId: demo.userId } },
          },
        }),
      ).toBe(0);
    } finally {
      await db.user.delete({ where: { id: demo.userId } });
    }
  });
});

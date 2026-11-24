// "Try demo" against a real database (PLAN.md §8). Mocked: only Next's request APIs
// (headers, cookies, redirect, revalidatePath) and `auth()`, so the test decides who is signed
// in. Everything else runs for real, including Auth.js' own session handler in the
// "Auth.js accepts the demo session" tests.
import "dotenv/config";

import { Auth } from "@auth/core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: [] as { name: string; value: string; options: unknown }[],
  // What the mocked auth() returns: who is signed in.
  user: null as null | {
    id: string;
    isDemo: boolean;
    demoExpiresAt: string | null;
  },
}));

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
vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) =>
      request.cookies.push({ name, value, options }),
  }),
}));
vi.mock("@/auth", () => ({
  auth: async () => (request.user ? { user: request.user } : null),
}));

const { db } = await import("@/lib/db");
const { authConfig } = await import("@/auth.config");
const { createAuthAdapter } = await import("@/lib/auth-adapter");
const { getCurrentUser } = await import("@/lib/session");
const { startDemo } = await import("./actions");
const { createDemo, deleteExpiredDemoUsers, wipeDemoData } =
  await import("./server");
const { GET: cleanupRoute } = await import("@/app/api/cron/cleanup-demo/route");
const applications = await import("@/features/applications/actions");
const { getApplication, listApplications } =
  await import("@/features/applications/queries");
const { APPLICATION_QUOTA, DEMO_RATE_LIMITS, DEMO_TTL_MS } =
  await import("./config");

const TAG = `itest-demo-${Date.now()}`;
const HOUR = 60 * 60 * 1000;
const createdUserIds: string[] = [];

/**
 * A moment far from "now" for tests that count demo users per hour, so other demo users in
 * the dev database (or other tests) can't fall into the same window. Rows created at these
 * times are deleted in afterAll. (createDemo's lazy cleanup then also removes the dev
 * database's current demo users, which is harmless: they're disposable by definition.)
 */
let isolatedHour = 0;
function isolatedNow() {
  isolatedHour += 3;
  return new Date(Date.UTC(2100, 0, 1) + isolatedHour * HOUR);
}

async function regularUser(name: string) {
  const user = await db.user.create({ data: { name: `${TAG}-${name}` } });
  createdUserIds.push(user.id);
  return user;
}

async function demoUser(createdAt = new Date()) {
  const user = await db.user.create({
    data: { name: `${TAG}-demo`, isDemo: true, createdAt },
  });
  createdUserIds.push(user.id);
  return user;
}

function signInAs(user: { id: string; isDemo: boolean; createdAt: Date }) {
  request.user = {
    id: user.id,
    isDemo: user.isDemo,
    demoExpiresAt: user.isDemo
      ? new Date(user.createdAt.getTime() + DEMO_TTL_MS).toISOString()
      : null,
  };
}

function form(company: string) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    company,
    jobTitle: "Engineer",
    appliedAt: "2026-11-01",
    stage: "APPLIED",
  }))
    fd.set(k, v);
  return fd;
}

const IDLE = { status: "idle" } as const;

/** Calls Auth.js' real session endpoint with a session cookie, as a browser would. */
async function readSession(origin: string, cookie: string) {
  const response = await Auth(
    new Request(`${origin}/api/auth/session`, { headers: { cookie } }),
    {
      ...authConfig,
      secret: process.env.AUTH_SECRET ?? "test-secret-test-secret",
      trustHost: true,
      basePath: "/api/auth",
    },
  );
  return (await response.json()) as null | {
    user: { id: string; isDemo: boolean };
  };
}

beforeAll(() => {
  process.env.AUTH_SECRET ??= "test-secret-test-secret";
});

beforeEach(() => {
  request.headers = new Headers({ "x-forwarded-for": `${TAG}-ip` });
  request.cookies = [];
  request.user = null;
});

afterAll(async () => {
  await db.user.deleteMany({
    where: {
      OR: [
        { id: { in: createdUserIds } },
        { name: { startsWith: TAG } },
        // createDemo() names its users "Demo user"; the isolated ones are dated in 2100.
        { isDemo: true, createdAt: { gte: new Date(Date.UTC(2100, 0, 1)) } },
      ],
    },
  });
  await db.$disconnect();
});

describe("startDemo", () => {
  it("creates a private demo user with sample data and a one-hour session cookie", async () => {
    request.headers.set("x-forwarded-proto", "http");
    const before = Date.now();

    await expect(startDemo()).rejects.toThrow(RedirectSignal);

    expect(request.cookies).toHaveLength(1);
    const [cookie] = request.cookies;
    expect(cookie?.name).toBe("authjs.session-token");
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: false,
    });

    const session = await db.session.findUniqueOrThrow({
      where: { sessionToken: cookie!.value },
      include: { user: true },
    });
    createdUserIds.push(session.userId);
    expect(session.user.isDemo).toBe(true);
    expect(session.user.demoIpHash).toBeTruthy();
    expect(session.user.demoIpHash).not.toContain(TAG);
    expect(session.expires.getTime() - before).toBeGreaterThan(HOUR - 60_000);
    expect(session.expires.getTime() - before).toBeLessThanOrEqual(
      HOUR + 60_000,
    );
    expect(cookie?.value.length).toBeGreaterThanOrEqual(43); // 32 random bytes
    expect(
      await db.application.count({ where: { userId: session.userId } }),
    ).toBe(8);
    expect(await db.account.count({ where: { userId: session.userId } })).toBe(
      0,
    );
  });

  it("uses the __Secure- cookie on https", async () => {
    request.headers.set("x-forwarded-proto", "https");
    await expect(startDemo()).rejects.toThrow(RedirectSignal);
    expect(request.cookies[0]?.name).toBe("__Secure-authjs.session-token");
    expect(request.cookies[0]?.options).toMatchObject({ secure: true });
    const session = await db.session.findUniqueOrThrow({
      where: { sessionToken: request.cookies[0]!.value },
    });
    createdUserIds.push(session.userId);
  });

  it("doesn't replace an existing session", async () => {
    const real = await regularUser("signed-in");
    signInAs(real);
    const demosBefore = await db.user.count({ where: { isDemo: true } });

    const error = await startDemo().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RedirectSignal);
    expect((error as RedirectSignal).url).toBe("/board");
    expect(request.cookies).toEqual([]);
    expect(await db.user.count({ where: { isDemo: true } })).toBe(demosBefore);
  });
});

describe("rate limits", () => {
  it("allows at most the per-IP limit per hour, then other IPs still work", async () => {
    const now = isolatedNow();
    for (let i = 0; i < DEMO_RATE_LIMITS.perIp; i++) {
      expect(await createDemo({ ipHash: "ip-a", now })).toMatchObject({
        ok: true,
      });
    }
    expect(await createDemo({ ipHash: "ip-a", now })).toEqual({
      ok: false,
      reason: "ip",
    });
    expect(await createDemo({ ipHash: "ip-b", now })).toMatchObject({
      ok: true,
    });
    // An hour later the window has moved on.
    expect(
      await createDemo({
        ipHash: "ip-a",
        now: new Date(now.getTime() + HOUR + 1000),
      }),
    ).toMatchObject({ ok: true });
  });

  it("stops everyone at the global limit", async () => {
    const now = isolatedNow();
    await db.user.createMany({
      data: Array.from({ length: DEMO_RATE_LIMITS.global }, (_, i) => ({
        name: `${TAG}-flood`,
        isDemo: true,
        demoIpHash: `flood-${i}`,
        createdAt: new Date(now.getTime() - 1000),
      })),
    });
    expect(await createDemo({ ipHash: "fresh-ip", now })).toEqual({
      ok: false,
      reason: "global",
    });
    expect(await createDemo({ ipHash: null, now })).toEqual({
      ok: false,
      reason: "global",
    });
  });

  it("concurrent starts from one IP can't overshoot the limit (advisory lock)", async () => {
    const now = isolatedNow();
    const results = await Promise.all(
      Array.from({ length: DEMO_RATE_LIMITS.perIp + 3 }, () =>
        createDemo({ ipHash: "burst-ip", now }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(DEMO_RATE_LIMITS.perIp);
    expect(
      await db.user.count({ where: { isDemo: true, demoIpHash: "burst-ip" } }),
    ).toBe(DEMO_RATE_LIMITS.perIp);
  });

  it("exiting the demo doesn't reset the limit", async () => {
    const now = isolatedNow();
    for (let i = 0; i < DEMO_RATE_LIMITS.perIp; i++) {
      const demo = await createDemo({ ipHash: "exit-ip", now });
      if (demo.ok) await wipeDemoData(demo.userId);
    }
    expect(await createDemo({ ipHash: "exit-ip", now })).toEqual({
      ok: false,
      reason: "ip",
    });
  });
});

describe("Auth.js accepts the demo session (real session handler)", () => {
  it("reads a demo cookie on http and https and never extends its expiry", async () => {
    for (const [origin, cookieName] of [
      ["http://localhost:3000", "authjs.session-token"],
      ["https://tracker.example.com", "__Secure-authjs.session-token"],
    ] as const) {
      const demo = await createDemo({ ipHash: null, now: new Date() });
      if (!demo.ok) throw new Error("demo not created");
      createdUserIds.push(demo.userId);

      const session = await readSession(
        origin,
        `${cookieName}=${demo.sessionToken}`,
      );
      expect(session?.user).toMatchObject({ id: demo.userId, isDemo: true });

      const row = await db.session.findUniqueOrThrow({
        where: { sessionToken: demo.sessionToken },
      });
      expect(row.expires).toEqual(demo.expires);
    }
  });

  it("control: a regular session with the same expiry IS extended by Auth.js", async () => {
    // Proves the premise of the adapter guard: without it, the demo would get 30 days.
    const user = await regularUser("sliding");
    const expires = new Date(Date.now() + HOUR);
    await db.session.create({
      data: { sessionToken: `${TAG}-regular`, userId: user.id, expires },
    });

    const session = await readSession(
      "http://localhost:3000",
      `authjs.session-token=${TAG}-regular`,
    );
    expect(session?.user).toMatchObject({ id: user.id, isDemo: false });

    const row = await db.session.findUniqueOrThrow({
      where: { sessionToken: `${TAG}-regular` },
    });
    expect(row.expires.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * HOUR);
  });

  it("rejects an expired demo session and an unknown token", async () => {
    const demo = await demoUser(new Date(Date.now() - 2 * HOUR));
    await db.session.create({
      data: {
        sessionToken: `${TAG}-expired`,
        userId: demo.id,
        expires: new Date(Date.now() - HOUR),
      },
    });
    expect(
      await readSession(
        "http://localhost:3000",
        `authjs.session-token=${TAG}-expired`,
      ),
    ).toBeNull();
    expect(
      await readSession(
        "http://localhost:3000",
        "authjs.session-token=forged-token",
      ),
    ).toBeNull();
  });
});

describe("demo users and OAuth", () => {
  it("an OAuth account can't be linked to a demo user", async () => {
    const adapter = createAuthAdapter(db);
    const demo = await demoUser();
    await expect(
      adapter.linkAccount!({
        userId: demo.id,
        type: "oauth",
        provider: "github",
        providerAccountId: `${TAG}-gh-demo`,
      }),
    ).rejects.toThrow(/demo/);
    expect(await db.account.count({ where: { userId: demo.id } })).toBe(0);
  });

  it("linking still works for a regular user", async () => {
    const adapter = createAuthAdapter(db);
    const user = await regularUser("linker");
    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: `${TAG}-gh-regular`,
    });
    expect(await db.account.count({ where: { userId: user.id } })).toBe(1);
  });
});

describe("getCurrentUser", () => {
  it("treats a demo past its one-hour lifetime as signed out (second guard)", async () => {
    const demo = await demoUser(new Date(Date.now() - 2 * HOUR));
    signInAs(demo);
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns a live demo user", async () => {
    const demo = await demoUser();
    signInAs(demo);
    expect(await getCurrentUser()).toMatchObject({ id: demo.id, isDemo: true });
  });
});

describe("quota", () => {
  it(`a demo user can store at most ${APPLICATION_QUOTA.demo} applications`, async () => {
    const demo = await demoUser();
    await db.application.createMany({
      data: Array.from({ length: APPLICATION_QUOTA.demo }, (_, i) => ({
        userId: demo.id,
        company: `${TAG} ${i}`,
        jobTitle: "Dev",
        appliedAt: new Date("2026-11-01"),
        rank: i,
      })),
    });
    signInAs(demo);

    const result = await applications.createApplication(IDLE, form("one more"));
    expect(result).toMatchObject({
      status: "error",
      formError: expect.stringContaining(`${APPLICATION_QUOTA.demo}`),
    });
    expect(await db.application.count({ where: { userId: demo.id } })).toBe(
      APPLICATION_QUOTA.demo,
    );
  });

  it("a regular user isn't limited by the demo quota", async () => {
    const user = await regularUser("heavy");
    await db.application.createMany({
      data: Array.from({ length: APPLICATION_QUOTA.demo }, (_, i) => ({
        userId: user.id,
        company: `${TAG} ${i}`,
        jobTitle: "Dev",
        appliedAt: new Date("2026-11-01"),
        rank: i,
      })),
    });
    signInAs(user);
    await expect(
      applications.createApplication(IDLE, form("one more")),
    ).rejects.toThrow(RedirectSignal);
    expect(await db.application.count({ where: { userId: user.id } })).toBe(
      APPLICATION_QUOTA.demo + 1,
    );
  });
});

describe("demo and real users can't reach each other's data", () => {
  async function appOf(userId: string, company: string) {
    return db.application.create({
      data: {
        userId,
        company,
        jobTitle: "Dev",
        appliedAt: new Date("2026-11-01"),
        rank: 0,
      },
    });
  }

  it("in both directions, and between two demo users", async () => {
    const real = await regularUser("victim");
    const demoA = await demoUser();
    const demoB = await demoUser();
    const pairs = [
      [demoA, await appOf(real.id, "real's")],
      [real, await appOf(demoA.id, "demo A's")],
      [demoB, await appOf(demoA.id, "demo A's other")],
    ] as const;

    for (const [attacker, target] of pairs) {
      const before = await db.application.findUniqueOrThrow({
        where: { id: target.id },
      });
      signInAs(attacker);

      expect(await getApplication(target.id)).toBeNull();
      expect((await listApplications()).some((a) => a.id === target.id)).toBe(
        false,
      );
      expect(
        await applications.updateApplication(target.id, IDLE, form("pwned")),
      ).toMatchObject({ status: "error" });
      expect(
        await applications.moveApplication({
          id: target.id,
          toStage: "OFFER",
          toIndex: 0,
        }),
      ).toMatchObject({ ok: false });
      await expect(applications.deleteApplication(target.id)).rejects.toThrow(
        RedirectSignal,
      );

      expect(
        await db.application.findUniqueOrThrow({ where: { id: target.id } }),
      ).toEqual(before);
    }
  });
});

describe("exiting and cleanup", () => {
  it("exiting wipes the demo's applications and sessions, keeping the bare user row", async () => {
    const demo = await createDemo({ ipHash: null, now: new Date() });
    if (!demo.ok) throw new Error("demo not created");
    createdUserIds.push(demo.userId);

    await wipeDemoData(demo.userId);

    expect(await db.application.count({ where: { userId: demo.userId } })).toBe(
      0,
    );
    expect(await db.session.count({ where: { userId: demo.userId } })).toBe(0);
    expect(await db.user.count({ where: { id: demo.userId } })).toBe(1);
  });

  it("wipeDemoData never touches a regular user", async () => {
    const user = await regularUser("safe");
    await appOf(user.id);
    await db.session.create({
      data: {
        sessionToken: `${TAG}-safe`,
        userId: user.id,
        expires: new Date(Date.now() + HOUR),
      },
    });
    await wipeDemoData(user.id);
    expect(await db.application.count({ where: { userId: user.id } })).toBe(1);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);

    async function appOf(userId: string) {
      return db.application.create({
        data: {
          userId,
          company: "kept",
          jobTitle: "Dev",
          appliedAt: new Date("2026-11-01"),
          rank: 0,
        },
      });
    }
  });

  it("deletes expired demo users with their data, keeps fresh demos and old regular users", async () => {
    // Real time here: cleanup also deletes every expired session, and a far-future "now" would
    // sign the developer out of their local dev session.
    const now = new Date();
    const expired = await demoUser(new Date(now.getTime() - HOUR - 1000));
    const fresh = await demoUser(new Date(now.getTime() - HOUR + 60_000));
    const oldRegular = await db.user.create({
      data: { name: `${TAG}-old`, createdAt: new Date("2020-01-01") },
    });
    createdUserIds.push(oldRegular.id);
    await db.application.create({
      data: {
        userId: expired.id,
        company: "gone",
        jobTitle: "Dev",
        appliedAt: new Date("2026-11-01"),
        rank: 0,
      },
    });
    await db.session.create({
      data: {
        sessionToken: `${TAG}-old-session`,
        userId: oldRegular.id,
        expires: new Date(now.getTime() - 1000),
      },
    });

    const result = await deleteExpiredDemoUsers(now);

    expect(result.deletedDemoUsers).toBeGreaterThanOrEqual(1);
    expect(await db.user.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await db.application.count({ where: { userId: expired.id } })).toBe(
      0,
    );
    expect(
      await db.user.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
    expect(
      await db.user.findUnique({ where: { id: oldRegular.id } }),
    ).not.toBeNull();
    expect(
      await db.session.findUnique({
        where: { sessionToken: `${TAG}-old-session` },
      }),
    ).toBeNull();
  });
});

describe("cleanup cron route", () => {
  const SECRET = "integration-test-cron-secret";

  it("rejects requests without the right bearer token", async () => {
    process.env.CRON_SECRET = SECRET;
    for (const authorization of [null, "Bearer wrong-secret-value", SECRET]) {
      const response = await cleanupRoute(
        new Request("http://localhost/api/cron/cleanup-demo", {
          headers: authorization ? { authorization } : {},
        }),
      );
      expect(response.status).toBe(401);
    }
  });

  it("fails closed when CRON_SECRET isn't configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await cleanupRoute(
      new Request("http://localhost/api/cron/cleanup-demo", {
        headers: { authorization: "Bearer undefined" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("runs the cleanup with the right token", async () => {
    process.env.CRON_SECRET = SECRET;
    const expired = await demoUser(new Date(Date.now() - 2 * HOUR));
    const response = await cleanupRoute(
      new Request("http://localhost/api/cron/cleanup-demo", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      deletedDemoUsers: expect.any(Number),
    });
    expect(await db.user.findUnique({ where: { id: expired.id } })).toBeNull();
  });
});

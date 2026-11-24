import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";

import {
  DEMO_TTL_MS,
  demoCutoff,
  type DemoRateLimitVerdict,
  demoRateLimitVerdict,
} from "./config";
import { buildSampleApplications } from "./sample-data";

export type CreateDemoResult =
  | { ok: true; userId: string; sessionToken: string; expires: Date }
  | { ok: false; reason: Exclude<DemoRateLimitVerdict, "ok"> };

/**
 * Creates a demo user with sample applications and a one-hour database session, in one
 * transaction. The caller sets the session cookie.
 *
 * Demo starts are serialized with a transaction-level advisory lock, so the rate-limit count
 * and the insert can't race (demo starts are rare; waiting a few ms is fine). The lock is
 * released at commit, which also works through Neon's transaction-mode pooler.
 */
export async function createDemo({
  ipHash,
  now,
}: {
  ipHash: string | null;
  now: Date;
}): Promise<CreateDemoResult> {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('job-tracker:demo-start'))`;

      const cutoff = demoCutoff(now);
      // Lazy cleanup: the daily cron is the main one, this keeps the table small between runs.
      await tx.user.deleteMany({
        where: { isDemo: true, createdAt: { lt: cutoff } },
      });

      const recent = { isDemo: true, createdAt: { gte: cutoff } } as const;
      const verdict = demoRateLimitVerdict({
        total: await tx.user.count({ where: recent }),
        fromIp:
          ipHash === null
            ? null
            : await tx.user.count({ where: { ...recent, demoIpHash: ipHash } }),
      });
      if (verdict !== "ok") return { ok: false, reason: verdict };

      const user = await tx.user.create({
        data: {
          name: "Demo user",
          isDemo: true,
          demoIpHash: ipHash,
          createdAt: now,
        },
        select: { id: true },
      });
      await tx.application.createMany({
        data: buildSampleApplications(now).map((row) => ({
          ...row,
          userId: user.id,
        })),
      });

      // 256 random bits, like any session token (Auth.js' own default is a UUID v4).
      const sessionToken = randomBytes(32).toString("base64url");
      const expires = new Date(now.getTime() + DEMO_TTL_MS);
      await tx.session.create({
        data: { sessionToken, userId: user.id, expires },
      });

      return { ok: true, userId: user.id, sessionToken, expires };
    },
    { timeout: 15_000 },
  );
}

/**
 * Called when a demo user signs out: what they typed is deleted right away. The bare user row
 * (no personal data) stays until the cleanup, so exiting doesn't reset the rate limit.
 * Does nothing for a regular user.
 */
export async function wipeDemoData(userId: string): Promise<void> {
  const demoOwned = { userId, user: { isDemo: true } } as const;
  await db.$transaction([
    db.application.deleteMany({ where: demoOwned }),
    db.session.deleteMany({ where: demoOwned }),
  ]);
}

/**
 * Deletes expired demo users (cascading to their sessions and applications) and expired
 * sessions of any user. Run daily by the Vercel Cron job. Regular users are never deleted.
 */
export async function deleteExpiredDemoUsers(now: Date) {
  const users = await db.user.deleteMany({
    where: { isDemo: true, createdAt: { lt: demoCutoff(now) } },
  });
  const sessions = await db.session.deleteMany({
    where: { expires: { lt: now } },
  });
  return { deletedDemoUsers: users.count, deletedSessions: sessions.count };
}

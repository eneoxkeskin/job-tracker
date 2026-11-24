import "server-only";

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";

import type { PrismaClient } from "@/generated/prisma/client";

/**
 * The Prisma adapter with two guards for demo users (PLAN.md §8). Both close gaps that were
 * verified in the pinned @auth/core@0.41.3 source:
 *
 * - updateSession: on every read Auth.js extends a session to `maxAge` (30 days) once
 *   `expires - maxAge + updateAge` has passed, which for a one-hour demo session is at once.
 *   Demo sessions are therefore never extended: their one-hour lifetime is hard.
 * - linkAccount: when someone is signed in and signs in with an OAuth account that isn't linked
 *   yet, Auth.js links it to the *current* user. A GitHub account must never end up on a
 *   temporary demo user (it would be deleted with it), so demo users can't link accounts.
 */
export function createAuthAdapter(db: PrismaClient): Adapter {
  const base = PrismaAdapter(db);
  return {
    ...base,
    async updateSession({ sessionToken, ...data }) {
      // One conditional write instead of read-then-write. Auth.js ignores the return value.
      await db.session.updateMany({
        where: { sessionToken, user: { isDemo: false } },
        data,
      });
      return null;
    },
    async linkAccount(account) {
      const owner = await db.user.findUnique({
        where: { id: account.userId },
        select: { isDemo: true },
      });
      if (!owner || owner.isDemo) {
        throw new Error("Refusing to link an account to a demo user.");
      }
      await base.linkAccount!(account);
    },
  };
}

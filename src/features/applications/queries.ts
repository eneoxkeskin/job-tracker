import "server-only";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

import { applicationIdSchema } from "./schema";

// Reads resolve the user themselves instead of taking a userId parameter, so a caller can't
// accidentally (or maliciously) read another user's data.

const applicationSelect = {
  id: true,
  company: true,
  jobTitle: true,
  postingUrl: true,
  notes: true,
  appliedAt: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  stage: true,
  rank: true,
  createdAt: true,
} as const;

/** All applications of the signed-in user, in board order. */
export async function listApplications() {
  const userId = await requireUserId();
  return db.application.findMany({
    where: { userId },
    select: applicationSelect,
    orderBy: [{ stage: "asc" }, { rank: "asc" }, { createdAt: "desc" }],
  });
}

export type ApplicationListItem = Awaited<
  ReturnType<typeof listApplications>
>[number];

/**
 * One application of the signed-in user, or null if it doesn't exist *or belongs to someone
 * else*. Callers turn null into a 404, so a foreign id is indistinguishable from a missing one.
 */
export async function getApplication(id: string) {
  const userId = await requireUserId();
  const parsedId = applicationIdSchema.safeParse(id);
  if (!parsedId.success) return null;
  return db.application.findFirst({
    where: { id: parsedId.data, userId },
    select: applicationSelect,
  });
}

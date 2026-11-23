import "server-only";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

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

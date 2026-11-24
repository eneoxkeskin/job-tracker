import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

import { computeInsights, stageEnteredAt } from "./history";
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
  followUpAt: true,
  createdAt: true,
} as const;

const eventSelect = { fromStage: true, toStage: true, at: true } as const;
const eventOrder: Prisma.ApplicationEventOrderByWithRelationInput[] = [
  { at: "asc" },
  { id: "asc" },
];

/** All applications of the signed-in user, in board order. */
export async function listApplications() {
  const userId = await requireUserId();
  const rows = await db.application.findMany({
    where: { userId },
    select: {
      ...applicationSelect,
      // Only the latest event is needed: when the card entered its current stage.
      events: {
        select: eventSelect,
        orderBy: [{ at: "desc" }, { id: "desc" }],
        take: 1,
      },
    },
    orderBy: [{ stage: "asc" }, { rank: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(({ events, ...card }) => ({
    ...card,
    stageEnteredAt: stageEnteredAt(card.stage, events),
  }));
}

export type ApplicationListItem = Awaited<
  ReturnType<typeof listApplications>
>[number];

/** Interview rate and response time of the signed-in user, derived from stage events. */
export async function getInsights() {
  const userId = await requireUserId();
  const rows = await db.application.findMany({
    where: { userId },
    select: {
      appliedAt: true,
      // Scoped by userId too (defense in depth; events always belong to the card's owner).
      events: { where: { userId }, select: eventSelect, orderBy: eventOrder },
    },
  });
  return computeInsights(rows);
}

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
    select: {
      ...applicationSelect,
      events: {
        where: { userId },
        select: { id: true, ...eventSelect },
        orderBy: eventOrder,
      },
    },
  });
}

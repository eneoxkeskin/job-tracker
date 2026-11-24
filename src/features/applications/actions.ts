"use server";

// Server Actions are public HTTP endpoints. Every action: 1) resolves the user from the
// session, 2) validates the raw input with zod, 3) scopes every query by that user
// (`where: { id, userId }`), so another user's id simply matches nothing.
//
// Note: arguments bound with `.bind(null, id)` travel to the browser and back *unencrypted*
// and can be tampered with, so bound ids are validated and ownership-checked like any input.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { applicationQuota, stageEventQuota } from "@/features/demo/config";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

import {
  type ApplicationFormState,
  readApplicationForm,
  toApplicationData,
} from "./form";
import { planRankUpdates, rankForNewCard, reorder } from "./ranking";
import {
  applicationIdSchema,
  applicationInputSchema,
  type MoveInput,
  moveInputSchema,
} from "./schema";

const SAVE_FAILED = "Couldn't save the application. Please try again.";
const NOT_FOUND = "This application no longer exists.";

export type MoveResult = { ok: true } | { ok: false; error: string };

class ApplicationNotFoundError extends Error {}

/** Its message is safe to show: it contains only the limit. */
class QuotaExceededError extends Error {
  constructor(limit: number, isDemo: boolean) {
    super(
      `You've reached the limit of ${limit} applications${isDemo ? " in the demo" : ""}. Delete one to add another.`,
    );
  }
}

/**
 * Records a stage change in the history (PLAN.md §8, V3), inside the caller's transaction.
 * Past the account's history limit the change still happens but isn't recorded.
 */
async function recordStageChange(
  tx: Prisma.TransactionClient,
  userId: string,
  applicationId: string,
  fromStage: MoveInput["toStage"],
  toStage: MoveInput["toStage"],
) {
  const owner = await tx.user.findUnique({
    where: { id: userId },
    select: { isDemo: true },
  });
  if (!owner) return;
  const recorded = await tx.applicationEvent.count({ where: { userId } });
  if (recorded >= stageEventQuota(owner.isDemo)) return;
  await tx.applicationEvent.create({
    data: { applicationId, userId, fromStage, toStage },
  });
}

/** Rank that puts a card on top of `stage` on this user's board (archived cards don't count). */
async function topRank(
  tx: Prisma.TransactionClient,
  userId: string,
  stage: MoveInput["toStage"],
) {
  const { _min } = await tx.application.aggregate({
    where: { userId, stage, archivedAt: null },
    _min: { rank: true },
  });
  return rankForNewCard(_min.rank);
}

export async function createApplication(
  _previous: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const userId = await requireUserId();
  const values = readApplicationForm(formData);
  const parsed = applicationInputSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const data = toApplicationData(parsed.data);
  try {
    await db.$transaction(async (tx) => {
      // Lock the user's row so concurrent submits (double click, two tabs) are counted one
      // after the other and can't overshoot the quota.
      const [owner] = await tx.$queryRaw<{ isDemo: boolean }[]>`
        SELECT "isDemo" FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (!owner) throw new ApplicationNotFoundError();
      const quota = applicationQuota(owner.isDemo);
      if ((await tx.application.count({ where: { userId } })) >= quota) {
        throw new QuotaExceededError(quota, owner.isDemo);
      }

      // New cards go on top of their column.
      const rank = await topRank(tx, userId, data.stage);
      const created = await tx.application.create({
        data: { ...data, userId, rank },
        select: { id: true },
      });
      // Creation events are bounded by the application quota, so no history check here.
      await tx.applicationEvent.create({
        data: {
          applicationId: created.id,
          userId,
          fromStage: null,
          toStage: data.stage,
        },
      });
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return {
        status: "error",
        fieldErrors: {},
        formError: error.message,
        values,
      };
    }
    console.error("createApplication failed", error);
    return { status: "error", fieldErrors: {}, formError: SAVE_FAILED, values };
  }

  revalidatePath("/board");
  redirect("/board");
}

export async function updateApplication(
  id: string,
  _previous: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const userId = await requireUserId();
  const values = readApplicationForm(formData);
  const parsedId = applicationIdSchema.safeParse(id);
  const parsed = applicationInputSchema.safeParse(values);
  if (!parsedId.success) {
    return { status: "error", fieldErrors: {}, formError: NOT_FOUND, values };
  }
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const data = toApplicationData(parsed.data);
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.application.findFirst({
        where: { id: parsedId.data, userId },
        select: { stage: true },
      });
      if (!existing) throw new ApplicationNotFoundError();

      // A stage change from the form puts the card on top of its new column.
      const rank =
        existing.stage === data.stage
          ? undefined
          : await topRank(tx, userId, data.stage);
      await tx.application.updateMany({
        where: { id: parsedId.data, userId },
        data: { ...data, ...(rank === undefined ? {} : { rank }) },
      });
      if (existing.stage !== data.stage) {
        await recordStageChange(
          tx,
          userId,
          parsedId.data,
          existing.stage,
          data.stage,
        );
      }
    });
  } catch (error) {
    if (error instanceof ApplicationNotFoundError) {
      return { status: "error", fieldErrors: {}, formError: NOT_FOUND, values };
    }
    console.error("updateApplication failed", error);
    return { status: "error", fieldErrors: {}, formError: SAVE_FAILED, values };
  }

  revalidatePath("/board");
  redirect("/board");
}

export async function deleteApplication(id: string): Promise<void> {
  const userId = await requireUserId();
  const parsedId = applicationIdSchema.safeParse(id);
  if (parsedId.success) {
    // Scoped by userId: a foreign or already-deleted id deletes nothing. Idempotent by design,
    // so a double submit or a stale tab isn't an error.
    await db.application.deleteMany({ where: { id: parsedId.data, userId } });
  }
  revalidatePath("/board");
  redirect("/board");
}

/**
 * Archives an application: it leaves the board and the insights but keeps its data and
 * history. Scoped by userId like every write; a foreign or already archived id changes nothing.
 */
export async function archiveApplication(id: string): Promise<void> {
  const userId = await requireUserId();
  const parsedId = applicationIdSchema.safeParse(id);
  if (parsedId.success) {
    await db.application.updateMany({
      where: { id: parsedId.data, userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  }
  revalidatePath("/board");
  revalidatePath("/archive");
  redirect("/board");
}

/** Puts an archived application back on the board, on top of its stage. */
export async function restoreApplication(id: string): Promise<void> {
  const userId = await requireUserId();
  const parsedId = applicationIdSchema.safeParse(id);
  if (parsedId.success) {
    await db.$transaction(async (tx) => {
      const card = await tx.application.findFirst({
        where: { id: parsedId.data, userId, archivedAt: { not: null } },
        select: { stage: true },
      });
      if (!card) return;
      await tx.application.updateMany({
        where: { id: parsedId.data, userId },
        data: { archivedAt: null, rank: await topRank(tx, userId, card.stage) },
      });
    });
  }
  revalidatePath("/board");
  revalidatePath("/archive");
}

/**
 * Moves a card to `toStage` at position `toIndex` (0 = top) and renumbers that column.
 * See PLAN.md §3. Used by drag and drop (M7) and by the "Move to" form.
 */
export async function moveApplication(input: unknown): Promise<MoveResult> {
  const userId = await requireUserId();
  const parsed = moveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid move." };
  const { id, toStage, toIndex } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      // Archived cards aren't on the board, so they can't be moved (restore them first).
      const card = await tx.application.findFirst({
        where: { id, userId, archivedAt: null },
        select: { stage: true, rank: true },
      });
      if (!card) throw new ApplicationNotFoundError();

      // Same order as compareCards() in ranking.ts.
      const column = await tx.application.findMany({
        where: { userId, stage: toStage, archivedAt: null },
        select: { id: true, stage: true, rank: true },
        orderBy: [{ rank: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      });
      const current = new Map(
        column.map((c) => [c.id, { stage: c.stage, rank: c.rank }]),
      );
      current.set(id, card);

      const order = reorder(
        column.map((c) => c.id),
        id,
        toIndex,
      );
      for (const update of planRankUpdates(order, toStage, current)) {
        await tx.application.updateMany({
          where: { id: update.id, userId },
          data: { stage: update.stage, rank: update.rank },
        });
      }
      if (card.stage !== toStage) {
        await recordStageChange(tx, userId, id, card.stage, toStage);
      }
    });
  } catch (error) {
    if (error instanceof ApplicationNotFoundError)
      return { ok: false, error: NOT_FOUND };
    console.error("moveApplication failed", error);
    return {
      ok: false,
      error: "Couldn't move the application. Please try again.",
    };
  }

  revalidatePath("/board");
  return { ok: true };
}

/** "Move to" form (works without JavaScript): moves the card to the top of the chosen stage. */
export async function moveApplicationFromForm(
  formData: FormData,
): Promise<void> {
  // "Move to the stage it's already in" is a no-op. With JS the button is disabled in that
  // case; this covers no-JS submits. `currentStage` comes from the client, but trusting it is
  // harmless: the worst a forged value can do is skip moving the user's own card.
  if (formData.get("toStage") === formData.get("currentStage")) return;

  const result = await moveApplication({
    id: formData.get("id"),
    toStage: formData.get("toStage"),
    toIndex: 0,
  });
  if (!result.ok) {
    // Surfaces in the board's error boundary; the board re-renders from the database.
    throw new Error(result.error);
  }
}

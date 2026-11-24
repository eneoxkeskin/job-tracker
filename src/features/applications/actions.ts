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

/** Rank that puts a card on top of `stage` for this user. */
async function topRank(
  tx: Prisma.TransactionClient,
  userId: string,
  stage: MoveInput["toStage"],
) {
  const { _min } = await tx.application.aggregate({
    where: { userId, stage },
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
      // New cards go on top of their column.
      const rank = await topRank(tx, userId, data.stage);
      await tx.application.create({ data: { ...data, userId, rank } });
    });
  } catch (error) {
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
      const card = await tx.application.findFirst({
        where: { id, userId },
        select: { stage: true, rank: true },
      });
      if (!card) throw new ApplicationNotFoundError();

      // Same order as compareCards() in ranking.ts.
      const column = await tx.application.findMany({
        where: { userId, stage: toStage },
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

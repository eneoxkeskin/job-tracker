"use server";

// Server Actions are public HTTP endpoints. Every action: 1) resolves the user from the
// session, 2) validates the raw input with zod, 3) scopes every query by that user.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

import {
  type ApplicationFormState,
  readApplicationForm,
  toApplicationData,
} from "./form";
import { rankForNewCard } from "./ranking";
import { applicationInputSchema } from "./schema";

const SAVE_FAILED = "Couldn't save the application. Please try again.";

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
      const { _min } = await tx.application.aggregate({
        where: { userId, stage: data.stage },
        _min: { rank: true },
      });
      await tx.application.create({
        data: { ...data, userId, rank: rankForNewCard(_min.rank) },
      });
    });
  } catch (error) {
    console.error("createApplication failed", error);
    return { status: "error", fieldErrors: {}, formError: SAVE_FAILED, values };
  }

  revalidatePath("/board");
  redirect("/board");
}

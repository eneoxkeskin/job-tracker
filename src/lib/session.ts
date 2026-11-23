import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";

/** The signed-in user, or null. Cached per request, so calling it in several places is cheap. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

/**
 * The id of the signed-in user; redirects to the landing page otherwise.
 * Call this at the top of every page, query and Server Action that touches user data:
 * it is the single source of `userId` (never trust a userId sent by the client).
 */
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect("/");
  }
  return user.id;
}

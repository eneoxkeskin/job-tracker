"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser, setSessionCookie } from "@/lib/session";

import { DEMO_RATE_LIMITS } from "./config";
import { clientIp, hashIp } from "./ip";
import { createDemo } from "./server";

export type StartDemoState = { error: string | null };

const MESSAGES = {
  ip: `You've started ${DEMO_RATE_LIMITS.perIp} demos in the last hour. Please try again later.`,
  global:
    "The demo is busy right now. Please try again in a few minutes, or sign in with GitHub.",
  failed: "Couldn't start the demo. Please try again.",
} as const;

/**
 * "Try demo": signs the visitor in as a new, private demo user with sample data.
 * Public endpoint by nature; it is rate-limited, takes no input, and can only ever create a
 * new demo user, so it can't reach anyone else's data.
 * Used with useActionState, which also passes (previousState, formData); neither is needed.
 */
export async function startDemo(): Promise<StartDemoState> {
  // Already signed in (demo or GitHub): don't replace that session, just go to the board.
  if (await getCurrentUser()) redirect("/board");

  const ip = clientIp(await headers());
  let result;
  try {
    result = await createDemo({
      ipHash: ip === null ? null : hashIp(ip, process.env.AUTH_SECRET ?? ""),
      now: new Date(),
    });
  } catch (error) {
    console.error("startDemo failed", error);
    return { error: MESSAGES.failed };
  }
  if (!result.ok) return { error: MESSAGES[result.reason] };

  await setSessionCookie(result.sessionToken, result.expires);
  redirect("/board");
}

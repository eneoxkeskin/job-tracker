import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import { isDemoExpired } from "@/features/demo/config";

import { sessionCookie, usesSecureCookies } from "./auth-cookie";

/** The signed-in user, or null. Cached per request, so calling it in several places is cheap. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  // Second guard for the demo's hard one-hour lifetime. The first is the session row's own
  // expiry, which Auth.js checks and which is never extended for demo users (auth-adapter.ts).
  if (user.isDemo && isDemoExpired(user.demoExpiresAt, new Date())) {
    return null;
  }
  return user;
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

/**
 * Sets Auth.js' session cookie for a session row created outside Auth.js (the demo).
 * Only call it from a Server Action or a Route Handler.
 */
export async function setSessionCookie(sessionToken: string, expires: Date) {
  const secure = usesSecureCookies({
    authUrl: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL,
    forwardedProto: (await headers()).get("x-forwarded-proto"),
  });
  const { name, options } = sessionCookie(secure);
  (await cookies()).set(name, sessionToken, { ...options, expires });
}

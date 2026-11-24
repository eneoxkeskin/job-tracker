// Auth.js' session cookie, for the one place that creates a session without Auth.js: the demo
// (PLAN.md §8). Pure, so it's unit-tested; an integration test also feeds a cookie built here
// back into Auth.js to prove it accepts it.
//
// Mirrors @auth/core@0.41.3:
// - lib/utils/cookie.js `defaultCookies()`: name and options;
// - lib/utils/env.js `createActionURL()`: how `auth()` decides between http and https
//   (AUTH_URL / NEXTAUTH_URL if set, otherwise x-forwarded-proto, otherwise https).
// Re-check both when upgrading next-auth.

export type SessionCookie = {
  name: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secure: boolean;
  };
};

export function sessionCookie(secure: boolean): SessionCookie {
  return {
    name: `${secure ? "__Secure-" : ""}authjs.session-token`,
    options: { httpOnly: true, sameSite: "lax", path: "/", secure },
  };
}

/** Whether Auth.js uses secure (`__Secure-`) cookies for this request. */
export function usesSecureCookies({
  authUrl,
  forwardedProto,
}: {
  authUrl: string | undefined;
  forwardedProto: string | null;
}): boolean {
  if (authUrl) return new URL(authUrl).protocol === "https:";
  const protocol = forwardedProto ?? "https";
  return protocol.replace(/:$/, "") === "https";
}

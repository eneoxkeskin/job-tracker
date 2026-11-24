import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

// Auth.js v5. GitHub credentials are read from AUTH_GITHUB_ID / AUTH_GITHUB_SECRET and the
// signing secret from AUTH_SECRET automatically. All Auth.js usage is isolated here, in
// auth.config.ts and in src/lib (session.ts, auth-adapter.ts, auth-cookie.ts), so swapping the
// auth library later touches only these files.
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

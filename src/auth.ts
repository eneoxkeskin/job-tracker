import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

import { db } from "@/lib/db";

// Auth.js v5. GitHub credentials are read from AUTH_GITHUB_ID / AUTH_GITHUB_SECRET and the
// signing secret from AUTH_SECRET automatically. All Auth.js usage is isolated here and in
// src/lib/session.ts, so swapping the auth library later touches only these files.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [GitHub],
  // Database sessions: revocable server-side (deleting the row signs the user out).
  session: { strategy: "database" },
  // Errors and sign-in prompts land on our own landing page instead of Auth.js' default pages.
  pages: { signIn: "/", error: "/" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

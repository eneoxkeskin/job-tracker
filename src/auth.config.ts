import "server-only";

import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

import { demoExpiresAt } from "@/features/demo/config";
import { wipeDemoData } from "@/features/demo/server";
import { createAuthAdapter } from "@/lib/auth-adapter";
import { db } from "@/lib/db";

// The Auth.js configuration, separate from the NextAuth() call in auth.ts so integration tests
// can run it through Auth.js' own request handler.
export const authConfig = {
  adapter: createAuthAdapter(db),
  providers: [GitHub],
  // Database sessions: revocable server-side (deleting the row signs the user out).
  session: { strategy: "database" },
  // Errors and sign-in prompts land on our own landing page instead of Auth.js' default pages.
  pages: { signIn: "/", error: "/" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.isDemo = user.isDemo === true;
      session.user.demoExpiresAt =
        user.isDemo === true && user.createdAt
          ? demoExpiresAt(user.createdAt).toISOString()
          : null;
      return session;
    },
  },
  events: {
    // Signing out of the demo deletes what the visitor typed right away.
    async signOut(message) {
      if ("session" in message && message.session) {
        await wipeDemoData(message.session.userId);
      }
    },
  },
} satisfies NextAuthConfig;

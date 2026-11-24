import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isDemo: boolean;
      /** ISO timestamp for demo users, null otherwise. */
      demoExpiresAt: string | null;
    } & DefaultSession["user"];
  }
}

// The Prisma adapter returns the whole User row; these are the extra columns we read.
declare module "@auth/core/adapters" {
  interface AdapterUser {
    isDemo?: boolean;
    createdAt?: Date;
  }
}

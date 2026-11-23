// Prisma CLI configuration (migrate, studio, generate).
// The CLI does not load .env by itself in Prisma 7, hence dotenv.
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Direct (non-pooled) connection: migrations need a stable session for advisory locks, which
// PgBouncer in transaction mode does not guarantee. The app itself uses DATABASE_URL (pooled).
//
// Optional on purpose: `prisma generate` runs in Vercel's build (postinstall) and needs no
// database. Prisma's `env()` helper throws when the variable is missing, so it is not used here.
// Commands that do need a database (migrate, studio) still fail with a clear error.
const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(directUrl ? { datasource: { url: directUrl } } : {}),
});

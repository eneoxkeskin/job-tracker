import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are intentionally off for the MVP: every page here is
  // per-user and dynamic, so they would add Suspense boundaries without a caching benefit.
  // See PLAN.md, section 2.
  // Don't let `next dev` write AGENTS.md; agent instructions live in CLAUDE.md.
  agentRules: false,
  images: {
    // GitHub profile pictures shown in the header
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

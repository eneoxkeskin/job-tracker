import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are intentionally off for the MVP: every page here is
  // per-user and dynamic, so they would add Suspense boundaries without a caching benefit.
  // See PLAN.md, section 2.
  // Don't let `next dev` write AGENTS.md; agent instructions live in CLAUDE.md.
  agentRules: false,
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Security headers on every response (PLAN.md §8, V5). A Content-Security-Policy is out of
  // scope for now: with Next's inline scripts it needs per-request nonces.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Never guess a content type (stops MIME sniffing).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No framing at all: prevents clickjacking of the forms and buttons.
          { key: "X-Frame-Options", value: "DENY" },
          // Full URLs (with search queries) stay on this site; other sites only see the origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browser features the app never uses.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // Our own browsing context group; GitHub sign-in is a redirect, not a popup.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // HTTPS only for two years (browsers ignore it on plain-http localhost).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
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

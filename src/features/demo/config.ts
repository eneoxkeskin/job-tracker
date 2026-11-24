// "Try demo" rules (PLAN.md §8). Pure and client-safe, so they are unit-tested and the UI can
// show the same numbers the server enforces.

const HOUR_MS = 60 * 60 * 1000;

/** Hard lifetime of a demo user and its session, counted from the user's creation. */
export const DEMO_TTL_MS = HOUR_MS;

/** Demo sign-ups allowed per rolling hour. */
export const DEMO_RATE_LIMITS = {
  perIp: 5,
  global: 100,
} as const;

/** Maximum number of applications one account can store. */
export const APPLICATION_QUOTA = {
  demo: 30,
  regular: 1000,
} as const;

export function applicationQuota(isDemo: boolean): number {
  return isDemo ? APPLICATION_QUOTA.demo : APPLICATION_QUOTA.regular;
}

export function demoExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + DEMO_TTL_MS);
}

/** Demo users created before this moment have expired. */
export function demoCutoff(now: Date): Date {
  return new Date(now.getTime() - DEMO_TTL_MS);
}

/**
 * True when a demo's expiry is in the past, or missing or unreadable: an expiry we can't
 * read is treated as expired (fail closed).
 */
export function isDemoExpired(
  expiresAt: string | Date | null | undefined,
  now: Date,
): boolean {
  if (expiresAt === null || expiresAt === undefined) return true;
  const time = new Date(expiresAt).getTime();
  return !(time > now.getTime());
}

export type DemoRateLimitVerdict = "ok" | "ip" | "global";

/**
 * Decides whether one more demo may start, given how many started in the last hour from
 * this IP (null when the IP is unknown: only the global limit applies) and in total.
 */
export function demoRateLimitVerdict(counts: {
  fromIp: number | null;
  total: number;
}): DemoRateLimitVerdict {
  if (counts.total >= DEMO_RATE_LIMITS.global) return "global";
  if (counts.fromIp !== null && counts.fromIp >= DEMO_RATE_LIMITS.perIp)
    return "ip";
  return "ok";
}

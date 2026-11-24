import { describe, expect, it } from "vitest";

import {
  APPLICATION_QUOTA,
  applicationQuota,
  DEMO_RATE_LIMITS,
  DEMO_TTL_MS,
  demoCutoff,
  demoExpiresAt,
  demoRateLimitVerdict,
  isDemoExpired,
} from "./config";

const NOW = new Date("2026-11-24T12:00:00Z");

describe("demo lifetime", () => {
  it("lasts exactly one hour from creation", () => {
    expect(DEMO_TTL_MS).toBe(60 * 60 * 1000);
    expect(demoExpiresAt(NOW).toISOString()).toBe("2026-11-24T13:00:00.000Z");
    expect(demoCutoff(NOW).toISOString()).toBe("2026-11-24T11:00:00.000Z");
  });

  it("is expired at and after the expiry, not before", () => {
    expect(isDemoExpired("2026-11-24T12:00:01Z", NOW)).toBe(false);
    expect(isDemoExpired(new Date("2026-11-24T12:00:00Z"), NOW)).toBe(true);
    expect(isDemoExpired("2026-11-24T11:59:59Z", NOW)).toBe(true);
  });

  it("fails closed when the expiry is missing or unreadable", () => {
    expect(isDemoExpired(null, NOW)).toBe(true);
    expect(isDemoExpired(undefined, NOW)).toBe(true);
    expect(isDemoExpired("not a date", NOW)).toBe(true);
  });
});

describe("demoRateLimitVerdict", () => {
  it("allows a demo below both limits", () => {
    expect(demoRateLimitVerdict({ fromIp: 0, total: 0 })).toBe("ok");
    expect(
      demoRateLimitVerdict({
        fromIp: DEMO_RATE_LIMITS.perIp - 1,
        total: DEMO_RATE_LIMITS.global - 1,
      }),
    ).toBe("ok");
  });

  it("blocks an IP that reached its limit", () => {
    expect(
      demoRateLimitVerdict({ fromIp: DEMO_RATE_LIMITS.perIp, total: 10 }),
    ).toBe("ip");
  });

  it("blocks everyone once the global limit is reached", () => {
    expect(
      demoRateLimitVerdict({ fromIp: 0, total: DEMO_RATE_LIMITS.global }),
    ).toBe("global");
    expect(
      demoRateLimitVerdict({ fromIp: null, total: DEMO_RATE_LIMITS.global }),
    ).toBe("global");
  });

  it("applies only the global limit when the IP is unknown", () => {
    expect(demoRateLimitVerdict({ fromIp: null, total: 0 })).toBe("ok");
  });
});

describe("applicationQuota", () => {
  it("is lower for demo users", () => {
    expect(applicationQuota(true)).toBe(APPLICATION_QUOTA.demo);
    expect(applicationQuota(false)).toBe(APPLICATION_QUOTA.regular);
    expect(APPLICATION_QUOTA.demo).toBeLessThan(APPLICATION_QUOTA.regular);
  });
});

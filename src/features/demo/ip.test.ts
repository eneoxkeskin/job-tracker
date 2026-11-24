import { describe, expect, it } from "vitest";

import { clientIp, hashIp } from "./ip";

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry (the client)", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.8" }))).toBe(
      "203.0.113.8",
    );
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": " , " }))).toBeNull();
  });
});

describe("hashIp", () => {
  it("is stable for the same IP and secret and never contains the IP", () => {
    const a = hashIp("203.0.113.7", "secret-1");
    expect(a).toBe(hashIp("203.0.113.7", "secret-1"));
    expect(a).not.toContain("203.0.113.7");
  });

  it("differs per IP and per secret", () => {
    expect(hashIp("203.0.113.7", "secret-1")).not.toBe(
      hashIp("203.0.113.8", "secret-1"),
    );
    expect(hashIp("203.0.113.7", "secret-1")).not.toBe(
      hashIp("203.0.113.7", "secret-2"),
    );
  });

  it("refuses to hash without a secret", () => {
    expect(() => hashIp("203.0.113.7", "")).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { sessionCookie, usesSecureCookies } from "./auth-cookie";

describe("sessionCookie", () => {
  it("uses the __Secure- prefix and the secure flag on https", () => {
    expect(sessionCookie(true)).toEqual({
      name: "__Secure-authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
    });
  });

  it("has no prefix on plain http (local development)", () => {
    expect(sessionCookie(false).name).toBe("authjs.session-token");
    expect(sessionCookie(false).options.secure).toBe(false);
  });
});

describe("usesSecureCookies", () => {
  it("follows AUTH_URL when it is set", () => {
    expect(
      usesSecureCookies({
        authUrl: "http://localhost:3000",
        forwardedProto: "https",
      }),
    ).toBe(false);
    expect(
      usesSecureCookies({
        authUrl: "https://example.com",
        forwardedProto: null,
      }),
    ).toBe(true);
  });

  it("otherwise follows x-forwarded-proto", () => {
    expect(
      usesSecureCookies({ authUrl: undefined, forwardedProto: "http" }),
    ).toBe(false);
    expect(
      usesSecureCookies({ authUrl: undefined, forwardedProto: "https" }),
    ).toBe(true);
    expect(
      usesSecureCookies({ authUrl: undefined, forwardedProto: "https:" }),
    ).toBe(true);
  });

  it("defaults to https like Auth.js", () => {
    expect(
      usesSecureCookies({ authUrl: undefined, forwardedProto: null }),
    ).toBe(true);
  });
});

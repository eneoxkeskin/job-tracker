import { createHmac } from "node:crypto";

/**
 * The visitor's IP for the demo rate limit, or null if unknown. On Vercel the platform sets
 * `x-forwarded-for` (the client's own value is overwritten). Self-hosted it could be spoofed,
 * which is why a global limit exists as well.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * Keyed hash of an IP: the raw address is never stored, and without the secret the stored
 * value can't be matched against a list of IPs.
 */
export function hashIp(ip: string, secret: string): string {
  if (!secret) throw new Error("A secret is required to hash IP addresses.");
  return createHmac("sha256", secret)
    .update(`demo-ip:${ip}`)
    .digest("base64url");
}

import { createHash, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 16;

/**
 * Checks the `Authorization: Bearer <CRON_SECRET>` header that Vercel Cron sends.
 * Fails closed: a missing or too-short secret rejects every request. The comparison is
 * constant-time (both sides are hashed first, so their lengths always match).
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !authorization) {
    return false;
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

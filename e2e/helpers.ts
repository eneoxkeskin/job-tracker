import { expect, type Page } from "@playwright/test";

/**
 * Starts a fresh demo from the landing page. Each call uses a new fake client IP, so repeated
 * runs don't hit the per-IP demo limit (5 per hour). `next start` keeps a client-sent
 * x-forwarded-for; on Vercel the platform overwrites it, so this can't bypass the limit there.
 */
export async function startDemo(page: Page) {
  const ip = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await page.goto("/");
  await page.getByRole("button", { name: "Try demo" }).click();
  // Generous: the first demo after idle may wake the database (Neon scale-to-zero).
  await expect(page).toHaveURL(/\/board$/, { timeout: 30_000 });
  // The board is server-rendered; wait until it is hydrated and interactive.
  await page.waitForLoadState("networkidle");
}

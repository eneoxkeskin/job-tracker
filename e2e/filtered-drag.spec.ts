import { expect, type Page, test } from "@playwright/test";

import { startDemo } from "./helpers";

// Keyboard drag and drop while a search filter hides a card (PLAN.md §8, V4). The demo's
// Applied column is Northwind, Bluefin, Copperleaf. Searching "c" hides Northwind (at the top).
// Moving Copperleaf above Bluefin must give Northwind, Copperleaf, Bluefin: the hidden card
// keeps its place. A naive "visible index = full index" would put Copperleaf first.

function appliedCompanies(page: Page) {
  return page
    .locator('section[aria-labelledby="column-APPLIED"]')
    .getByRole("heading", { level: 3 })
    .allTextContents();
}

test("keyboard reorder with a filter keeps hidden cards in place", async ({
  page,
}) => {
  await startDemo(page);
  await expect
    .poll(() => appliedCompanies(page))
    .toEqual(["Northwind Labs", "Bluefin Analytics", "Copperleaf Health"]);

  await page.goto("/board?q=c");
  await page.waitForLoadState("networkidle"); // hydrated, so the keyboard sensor is live
  await expect
    .poll(() => appliedCompanies(page))
    .toEqual(["Bluefin Analytics", "Copperleaf Health"]);

  // dnd-kit keyboard sensor: Space picks up, arrows move, Space drops. Its live region (our
  // announcement texts) confirms each step.
  const liveRegion = page.locator("#DndLiveRegion-0");
  await page.getByRole("button", { name: "Drag Copperleaf Health" }).focus();
  await page.keyboard.press("Space");
  await expect(liveRegion).toContainText(
    "Copperleaf Health moved. Applied, position 2 of 2.",
  );
  // dnd-kit measures the drop targets in an effect right after the pick-up; an arrow key
  // before that has no target yet. Retry until the move is announced (pressing ArrowUp at the
  // top again is harmless).
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(liveRegion).toContainText("Applied, position 1 of 2", {
      timeout: 500,
    });
  }).toPass({ timeout: 10_000 });

  // Drop, and wait for the Server Action (a POST) to finish before reloading.
  const saved = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.keyboard.press("Space");
  expect((await saved).ok()).toBe(true);
  await expect
    .poll(() => appliedCompanies(page))
    .toEqual(["Copperleaf Health", "Bluefin Analytics"]);

  // Saved on the server, with the hidden card still on top.
  await page.goto("/board");
  await expect
    .poll(() => appliedCompanies(page))
    .toEqual(["Northwind Labs", "Copperleaf Health", "Bluefin Analytics"]);

  await page.getByRole("button", { name: "Exit demo" }).click();
});

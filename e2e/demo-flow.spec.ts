import { expect, type Page, test } from "@playwright/test";

import { startDemo } from "./helpers";

// The main user journey, in a real browser against a production build:
// try the demo → add → edit → move → delete → exit.

const company = `E2E Corp ${Date.now()}`;

function column(page: Page, stage: string) {
  return page.locator(`section[aria-labelledby="column-${stage}"]`);
}

test("demo sign-in, add, edit, move, delete, exit", async ({ page }) => {
  // Try demo: a private board with sample data, no account.
  await startDemo(page);
  await expect(page.getByText("You're using the demo.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your applications" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();

  // Add. Role queries use the accessible name, which leaves out the aria-hidden "*".
  await page.getByRole("link", { name: "Add application" }).click();
  await page
    .getByRole("textbox", { name: "Company", exact: true })
    .fill(company);
  await page
    .getByRole("textbox", { name: "Job title", exact: true })
    .fill("QA Engineer");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(
    column(page, "APPLIED").getByRole("heading", { name: company }),
  ).toBeVisible();

  // Search finds it.
  await page.getByLabel("Search company or job title").fill(company);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Showing" }),
  ).toHaveText(/Showing 1 of \d+ applications\./);
  await page.getByRole("link", { name: "Clear filters" }).click();

  // Edit, including a follow-up date in the past.
  await page.getByRole("link", { name: `Edit ${company}` }).click();
  await page
    .getByRole("textbox", { name: "Job title", exact: true })
    .fill("Senior QA Engineer");
  await page.getByLabel("Follow up on").fill("2026-01-05");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/board$/);
  const card = page.locator("article").filter({ hasText: company });
  await expect(card.getByText("Senior QA Engineer")).toBeVisible();
  await expect(card.getByText(/Follow-up overdue by/)).toBeVisible();

  // Move to Interview with the accessible "Move to" control.
  await card.getByLabel(`Move to (for ${company})`).selectOption("INTERVIEW");
  await card.getByRole("button", { name: `Move ${company}` }).click();
  await expect(
    column(page, "INTERVIEW").getByRole("heading", { name: company }),
  ).toBeVisible();
  await expect(
    column(page, "APPLIED").getByRole("heading", { name: company }),
  ).toHaveCount(0);

  // The move is in the stage history.
  await page.getByRole("link", { name: `Edit ${company}` }).click();
  const history = page.getByRole("region", { name: "Stage history" });
  await expect(history.getByText("Added in Applied")).toBeVisible();
  await expect(
    history.getByText(/Applied\s*→?\s*to\s*Interview/),
  ).toBeVisible();

  // Delete, with the confirmation dialog.
  await page.getByRole("button", { name: "Delete application" }).click();
  const dialog = page.getByRole("dialog", { name: `Delete ${company}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { name: company })).toHaveCount(0);

  // Exit: back on the landing page, signed out.
  await page.getByRole("button", { name: "Exit demo" }).click();
  await expect(page.getByRole("button", { name: "Try demo" })).toBeVisible();
  await page.goto("/board");
  await expect(page).toHaveURL(/\/$/);
});

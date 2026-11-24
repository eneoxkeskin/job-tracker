import { expect, type Page, test } from "@playwright/test";

// axe-core in a real browser, so unlike the jsdom tests this also checks color contrast with
// the real CSS. Covers the landing page and every signed-in page, using a demo account.

// Playwright loads specs as CommonJS, so require.resolve is available.
const axePath = require.resolve("axe-core");

async function violations(page: Page) {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: object,
          ) => Promise<{
            violations: { id: string; help: string; nodes: unknown[] }[];
          }>;
        };
      }
    ).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
    );
  });
}

test("every page passes axe (WCAG 2.2 A/AA, including contrast)", async ({
  page,
}) => {
  await page.goto("/");
  expect(await violations(page), "landing").toEqual([]);

  await page.getByRole("button", { name: "Try demo" }).click();
  await expect(page).toHaveURL(/\/board$/);
  expect(await violations(page), "board").toEqual([]);

  await page.goto("/board?stage=INTERVIEW&q=zzz");
  expect(await violations(page), "filtered board").toEqual([]);

  await page.goto("/applications/new");
  expect(await violations(page), "new application").toEqual([]);

  await page.goto("/board");
  await page
    .getByRole("link", { name: /^Edit / })
    .first()
    .click();
  expect(await violations(page), "edit").toEqual([]);

  await page.goto("/archive");
  expect(await violations(page), "archive").toEqual([]);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/board");
  expect(await violations(page), "board at 360 px").toEqual([]);
  // No horizontal page scroll at 360 px (the columns scroll inside their own container).
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Exit demo" }).click();
});

import { describe, expect, it } from "vitest";

import {
  formatAppliedDate,
  formatSalaryRange,
  toDateInputValue,
} from "./format";

describe("formatAppliedDate", () => {
  it("formats the stored UTC calendar date without shifting the day", () => {
    expect(formatAppliedDate(new Date("2026-11-20T00:00:00.000Z"))).toBe(
      "Nov 20, 2026",
    );
  });
});

describe("toDateInputValue", () => {
  it("returns YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date("2026-01-05T00:00:00.000Z"))).toBe(
      "2026-01-05",
    );
  });
});

describe("formatSalaryRange", () => {
  it.each([
    [50000, 65000, "EUR", "€50,000 – €65,000"],
    [50000, 50000, "USD", "$50,000"],
    [50000, null, "GBP", "from £50,000"],
    [null, 65000, "EUR", "up to €65,000"],
    [null, null, "EUR", null],
    [50000, null, null, null],
  ] as const)("(%s, %s, %s) -> %s", (min, max, currency, expected) => {
    expect(formatSalaryRange(min, max, currency)).toBe(expected);
  });
});

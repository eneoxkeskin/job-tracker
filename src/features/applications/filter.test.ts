import { describe, expect, it } from "vitest";

import {
  filterColumns,
  isFilterActive,
  matchesFilter,
  MAX_QUERY_LENGTH,
  NO_FILTER,
  parseBoardFilter,
} from "./filter";
import { groupByStage, moveCard, reorder, visibleToFullIndex } from "./ranking";
import type { StageId } from "./stages";

describe("parseBoardFilter", () => {
  it("reads a query and a stage", () => {
    expect(parseBoardFilter({ q: "  acme ", stage: "OFFER" })).toEqual({
      q: "acme",
      stage: "OFFER",
    });
  });

  it("ignores unknown stages, repeated params and overlong queries", () => {
    expect(parseBoardFilter({ stage: "ARCHIVED" })).toEqual(NO_FILTER);
    expect(
      parseBoardFilter({ q: ["a", "b"], stage: ["INTERVIEW", "x"] }),
    ).toEqual({
      q: "a",
      stage: "INTERVIEW",
    });
    expect(parseBoardFilter({ q: "x".repeat(500) }).q).toHaveLength(
      MAX_QUERY_LENGTH,
    );
    expect(parseBoardFilter({})).toEqual(NO_FILTER);
  });

  it("knows when a filter is active", () => {
    expect(isFilterActive(NO_FILTER)).toBe(false);
    expect(isFilterActive({ q: "a", stage: null })).toBe(true);
    expect(isFilterActive({ q: "", stage: "OFFER" })).toBe(true);
  });
});

describe("matchesFilter", () => {
  const card = {
    company: "Zürich Dynamics",
    jobTitle: "Frontend Engineer",
    stage: "APPLIED" as const,
  };

  it("matches company or job title, ignoring case and accents", () => {
    expect(matchesFilter(card, { q: "zurich", stage: null })).toBe(true);
    expect(matchesFilter(card, { q: "FRONTEND", stage: null })).toBe(true);
    expect(matchesFilter(card, { q: "backend", stage: null })).toBe(false);
  });

  it("combines the query with the stage", () => {
    expect(matchesFilter(card, { q: "zurich", stage: "APPLIED" })).toBe(true);
    expect(matchesFilter(card, { q: "zurich", stage: "OFFER" })).toBe(false);
    expect(matchesFilter(card, { q: "", stage: "OFFER" })).toBe(false);
  });
});

const card = (id: string, stage: StageId, rank: number, company = id) => ({
  id,
  stage,
  rank,
  company,
  jobTitle: "Dev",
  createdAt: new Date("2026-11-01T00:00:00Z"),
});

describe("filterColumns", () => {
  const columns = groupByStage([
    card("a", "APPLIED", 0, "Acme"),
    card("b", "APPLIED", 1, "Beta"),
    card("c", "OFFER", 0, "Acme Two"),
  ]);

  it("returns the same object without a filter", () => {
    expect(filterColumns(columns, NO_FILTER)).toBe(columns);
  });

  it("keeps matching cards in order and every stage present", () => {
    const result = filterColumns(columns, { q: "acme", stage: null });
    expect(result.APPLIED.map((c) => c.id)).toEqual(["a"]);
    expect(result.OFFER.map((c) => c.id)).toEqual(["c"]);
    expect(result.INTERVIEW).toEqual([]);
  });
});

describe("visibleToFullIndex", () => {
  // Full column: a b c d e; the filter shows only b and d.
  const full = ["a", "b", "c", "d", "e"];

  it("places the card before the visible card that now follows it", () => {
    // d dragged above b in the filtered view: [d, b] → before b in the full column.
    expect(visibleToFullIndex(full, ["d", "b"], "d")).toBe(1);
    expect(reorder(full, "d", 1)).toEqual(["a", "d", "b", "c", "e"]);
  });

  it("places the card after the visible card that precedes it, at the end of the view", () => {
    // b dragged below d: [d, b] → right after d, before the hidden e.
    expect(visibleToFullIndex(full, ["d", "b"], "b")).toBe(3);
    expect(reorder(full, "b", 3)).toEqual(["a", "c", "d", "b", "e"]);
  });

  it("puts a card from another column on top when nothing else is visible there", () => {
    expect(visibleToFullIndex(["x", "y"], ["moved"], "moved")).toBe(0);
    expect(visibleToFullIndex([], ["moved"], "moved")).toBe(0);
  });

  it("handles a card coming from another column between visible cards", () => {
    // Target column x y z, visible x z; dropped between them → before z.
    expect(visibleToFullIndex(["x", "y", "z"], ["x", "new", "z"], "new")).toBe(
      2,
    );
  });

  it("is the identity without a filter (every position, same and cross column)", () => {
    const ids = ["a", "b", "c", "d"];
    for (const moved of ids) {
      for (let to = 0; to < ids.length; to++) {
        const visible = reorder(ids, moved, to);
        expect(visibleToFullIndex(ids, visible, moved)).toBe(to);
      }
    }
    for (let to = 0; to <= ids.length; to++) {
      const visible = reorder(ids, "new", to);
      expect(visibleToFullIndex(ids, visible, "new")).toBe(to);
    }
  });

  it("keeps the visible order the user dropped (round trip through moveCard)", () => {
    const columns = groupByStage([
      card("a", "APPLIED", 0, "Hidden 1"),
      card("b", "APPLIED", 1, "Match B"),
      card("c", "APPLIED", 2, "Hidden 2"),
      card("d", "APPLIED", 3, "Match D"),
    ]);
    const filter = { q: "match", stage: null };
    // The user drags D above B in the filtered view.
    const dropped = ["d", "b"];
    const index = visibleToFullIndex(
      columns.APPLIED.map((c) => c.id),
      dropped,
      "d",
    );
    const after = moveCard(columns, "d", "APPLIED", index);
    expect(filterColumns(after, filter).APPLIED.map((c) => c.id)).toEqual(
      dropped,
    );
    // Hidden cards keep their relative order.
    expect(
      after.APPLIED.map((c) => c.id).filter((id) => id === "a" || id === "c"),
    ).toEqual(["a", "c"]);
  });
});

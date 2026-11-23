import { describe, expect, it } from "vitest";

import {
  type Columns,
  groupByStage,
  moveCard,
  planRankUpdates,
  rankForNewCard,
  reorder,
} from "./ranking";
import type { StageId } from "./stages";

describe("reorder", () => {
  it("moves a card down within the same column", () => {
    expect(reorder(["a", "b", "c", "d"], "a", 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves a card up within the same column", () => {
    expect(reorder(["a", "b", "c", "d"], "d", 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("inserts a card coming from another column", () => {
    expect(reorder(["a", "b"], "x", 1)).toEqual(["a", "x", "b"]);
  });

  it("handles an empty target column", () => {
    expect(reorder([], "x", 5)).toEqual(["x"]);
  });

  it.each([
    [-3, ["x", "a", "b"]],
    [99, ["a", "b", "x"]],
    [Number.NaN, ["a", "b", "x"]],
    [1.9, ["a", "x", "b"]],
  ])("clamps index %s", (index, expected) => {
    expect(reorder(["a", "b"], "x", index)).toEqual(expected);
  });

  it("does not mutate its input", () => {
    const ids = ["a", "b", "c"];
    reorder(ids, "a", 2);
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("planRankUpdates", () => {
  const current = new Map<string, { stage: StageId; rank: number }>([
    ["a", { stage: "APPLIED", rank: 0 }],
    ["b", { stage: "APPLIED", rank: 1 }],
    ["c", { stage: "APPLIED", rank: 2 }],
    ["x", { stage: "INTERVIEW", rank: 1 }],
  ]);

  it("returns only rows whose rank changes", () => {
    const order = reorder(["a", "b", "c"], "c", 1); // a, c, b
    expect(planRankUpdates(order, "APPLIED", current)).toEqual([
      { id: "c", stage: "APPLIED", rank: 1 },
      { id: "b", stage: "APPLIED", rank: 2 },
    ]);
  });

  it("always updates a card that changes stage, even if its rank matches", () => {
    const order = reorder(["a", "b", "c"], "x", 1); // a, x, b, c
    expect(planRankUpdates(order, "APPLIED", current)).toEqual([
      { id: "x", stage: "APPLIED", rank: 1 },
      { id: "b", stage: "APPLIED", rank: 2 },
      { id: "c", stage: "APPLIED", rank: 3 },
    ]);
  });

  it("returns nothing when the order is unchanged", () => {
    expect(planRankUpdates(["a", "b", "c"], "APPLIED", current)).toEqual([]);
  });
});

describe("rankForNewCard", () => {
  it("starts an empty column at 0 and otherwise goes above the current top", () => {
    expect(rankForNewCard(null)).toBe(0);
    expect(rankForNewCard(0)).toBe(-1);
    expect(rankForNewCard(-4)).toBe(-5);
  });
});

type Card = { id: string; stage: StageId; rank: number; createdAt: Date };

const card = (
  id: string,
  stage: StageId,
  rank: number,
  createdAt = "2026-11-01",
): Card => ({
  id,
  stage,
  rank,
  createdAt: new Date(createdAt),
});

describe("groupByStage", () => {
  it("returns every stage, sorted by rank, newest first on ties", () => {
    const columns = groupByStage([
      card("b", "APPLIED", 1),
      card("old", "APPLIED", 0, "2026-10-01"),
      card("new", "APPLIED", 0, "2026-11-10"),
      card("o", "OFFER", 0),
    ]);

    expect(columns.APPLIED.map((c) => c.id)).toEqual(["new", "old", "b"]);
    expect(columns.OFFER.map((c) => c.id)).toEqual(["o"]);
    expect(columns.INTERVIEW).toEqual([]);
    expect(columns.REJECTED).toEqual([]);
  });
});

describe("moveCard", () => {
  const ids = (columns: Columns<Card>) =>
    Object.fromEntries(
      Object.entries(columns).map(([stage, cards]) => [
        stage,
        cards.map((c) => c.id),
      ]),
    );

  const board = () =>
    groupByStage([
      card("a", "APPLIED", 0),
      card("b", "APPLIED", 1),
      card("c", "APPLIED", 2),
      card("i", "INTERVIEW", 0),
    ]);

  it("moves a card across columns and updates its stage", () => {
    const next = moveCard(board(), "b", "INTERVIEW", 0);

    expect(ids(next)).toEqual({
      APPLIED: ["a", "c"],
      INTERVIEW: ["b", "i"],
      OFFER: [],
      REJECTED: [],
    });
    expect(next.INTERVIEW[0]?.stage).toBe("INTERVIEW");
  });

  it("reorders within a column", () => {
    expect(ids(moveCard(board(), "a", "APPLIED", 2)).APPLIED).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input columns", () => {
    const before = board();
    moveCard(before, "a", "OFFER", 0);
    expect(ids(before).APPLIED).toEqual(["a", "b", "c"]);
    expect(before.OFFER).toEqual([]);
  });

  it("returns the input unchanged for an unknown id", () => {
    const before = board();
    expect(moveCard(before, "missing", "OFFER", 0)).toBe(before);
  });

  it("agrees with the server-side reorder (optimistic UI matches the saved result)", () => {
    const before = board();
    const client = moveCard(before, "a", "APPLIED", 1).APPLIED.map((c) => c.id);
    const server = reorder(
      before.APPLIED.map((c) => c.id),
      "a",
      1,
    );
    expect(client).toEqual(server);
  });
});

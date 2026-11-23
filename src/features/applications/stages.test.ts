import { describe, expect, it } from "vitest";

import { canMoveTo, isStage, moveOptions } from "./stages";

describe("moveOptions", () => {
  it("lists every stage in board order and marks the current one", () => {
    expect(moveOptions("INTERVIEW")).toEqual([
      { value: "APPLIED", label: "Applied", isCurrent: false },
      { value: "INTERVIEW", label: "Interview (current)", isCurrent: true },
      { value: "OFFER", label: "Offer", isCurrent: false },
      { value: "REJECTED", label: "Rejected", isCurrent: false },
    ]);
  });

  it("marks exactly one option as current for every stage", () => {
    for (const stage of [
      "APPLIED",
      "INTERVIEW",
      "OFFER",
      "REJECTED",
    ] as const) {
      const current = moveOptions(stage).filter((o) => o.isCurrent);
      expect(current).toEqual([expect.objectContaining({ value: stage })]);
    }
  });
});

describe("canMoveTo", () => {
  it("is false for the current stage (Move button disabled)", () => {
    expect(canMoveTo("INTERVIEW", "INTERVIEW")).toBe(false);
  });

  it("is true for any other stage", () => {
    expect(canMoveTo("APPLIED", "INTERVIEW")).toBe(true);
    expect(canMoveTo("OFFER", "INTERVIEW")).toBe(true);
  });

  it("is false for anything that isn't a stage", () => {
    expect(canMoveTo("", "INTERVIEW")).toBe(false);
    expect(canMoveTo("HIRED", "INTERVIEW")).toBe(false);
    expect(canMoveTo(null, "INTERVIEW")).toBe(false);
  });
});

describe("isStage", () => {
  it("accepts only known stages", () => {
    expect(isStage("OFFER")).toBe(true);
    expect(isStage("offer")).toBe(false);
    expect(isStage(1)).toBe(false);
  });
});

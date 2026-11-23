import { describe, expect, it } from "vitest";

import { countByStage } from "./stats";

describe("countByStage", () => {
  it("counts per stage and in total, including stages with zero applications", () => {
    expect(
      countByStage([
        { stage: "APPLIED" },
        { stage: "APPLIED" },
        { stage: "INTERVIEW" },
        { stage: "REJECTED" },
      ]),
    ).toEqual({
      byStage: { APPLIED: 2, INTERVIEW: 1, OFFER: 0, REJECTED: 1 },
      total: 4,
    });
  });

  it("returns zeros for no applications", () => {
    expect(countByStage([])).toEqual({
      byStage: { APPLIED: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 },
      total: 0,
    });
  });
});

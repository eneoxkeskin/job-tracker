import { describe, expect, it } from "vitest";

import {
  computeInsights,
  daysBetween,
  daysWaiting,
  followUpStatus,
  isStale,
  MIN_SAMPLE,
  parseDay,
  STALE_AFTER_DAYS,
  type StageEvent,
  stageEnteredAt,
} from "./history";

const TODAY = parseDay("2026-11-24");
const day = (d: string) => parseDay(d);
const at = (iso: string) => new Date(iso);

describe("daysBetween", () => {
  it("counts UTC calendar days, ignoring the time of day", () => {
    expect(
      daysBetween(at("2026-11-23T23:59:00Z"), at("2026-11-24T00:01:00Z")),
    ).toBe(1);
    expect(
      daysBetween(at("2026-11-24T00:00:00Z"), at("2026-11-24T23:59:00Z")),
    ).toBe(0);
    expect(daysBetween(day("2026-11-24"), day("2026-11-10"))).toBe(-14);
  });

  it("is not thrown off by DST changes (UTC has none)", () => {
    expect(daysBetween(day("2026-03-28"), day("2026-03-30"))).toBe(2);
  });
});

describe("stageEnteredAt", () => {
  const events: StageEvent[] = [
    { fromStage: null, toStage: "APPLIED", at: at("2026-11-01T10:00:00Z") },
    {
      fromStage: "APPLIED",
      toStage: "INTERVIEW",
      at: at("2026-11-05T10:00:00Z"),
    },
  ];

  it("is the time of the latest event when it led into the current stage", () => {
    expect(stageEnteredAt("INTERVIEW", events)).toEqual(
      at("2026-11-05T10:00:00Z"),
    );
  });

  it("is null without history or when the history doesn't match the stage", () => {
    expect(stageEnteredAt("INTERVIEW", [])).toBeNull();
    expect(stageEnteredAt("OFFER", events)).toBeNull();
  });
});

describe("daysWaiting / isStale", () => {
  it("counts Applied cards from the application date", () => {
    const days = daysWaiting(
      {
        stage: "APPLIED",
        appliedAt: day("2026-11-10"),
        stageEnteredAt: day("2026-11-20"),
      },
      TODAY,
    );
    expect(days).toBe(14);
    expect(isStale(days)).toBe(true);
  });

  it("counts Interview cards from when they entered Interview", () => {
    const days = daysWaiting(
      {
        stage: "INTERVIEW",
        appliedAt: day("2026-10-01"),
        stageEnteredAt: at("2026-11-20T15:00:00Z"),
      },
      TODAY,
    );
    expect(days).toBe(4);
    expect(isStale(days)).toBe(false);
  });

  it("falls back to the application date when the Interview entry is unknown", () => {
    expect(
      daysWaiting(
        {
          stage: "INTERVIEW",
          appliedAt: day("2026-10-25"),
          stageEnteredAt: null,
        },
        TODAY,
      ),
    ).toBe(30);
  });

  it("doesn't apply to Offer and Rejected", () => {
    for (const stage of ["OFFER", "REJECTED"] as const) {
      const days = daysWaiting(
        { stage, appliedAt: day("2026-01-01"), stageEnteredAt: null },
        TODAY,
      );
      expect(days).toBeNull();
      expect(isStale(days)).toBe(false);
    }
  });

  it("uses a 14-day threshold", () => {
    expect(STALE_AFTER_DAYS).toBe(14);
    expect(isStale(13)).toBe(false);
    expect(isStale(14)).toBe(true);
  });
});

describe("followUpStatus", () => {
  it("is null without a date", () => {
    expect(followUpStatus(null, TODAY)).toBeNull();
  });

  it("is overdue, today or upcoming", () => {
    expect(followUpStatus(day("2026-11-21"), TODAY)).toEqual({
      kind: "overdue",
      days: 3,
    });
    expect(followUpStatus(day("2026-11-24"), TODAY)).toEqual({ kind: "today" });
    expect(followUpStatus(day("2026-11-26"), TODAY)).toEqual({
      kind: "upcoming",
      days: 2,
    });
  });
});

describe("computeInsights", () => {
  const created = (d: string): StageEvent => ({
    fromStage: null,
    toStage: "APPLIED",
    at: at(`${d}T09:00:00Z`),
  });
  const move = (
    from: StageEvent["toStage"],
    to: StageEvent["toStage"],
    d: string,
  ): StageEvent => ({
    fromStage: from,
    toStage: to,
    at: at(`${d}T09:00:00Z`),
  });

  const apps = [
    // Reached Interview after 4 days, then Offer.
    {
      appliedAt: day("2026-11-01"),
      events: [
        created("2026-11-01"),
        move("APPLIED", "INTERVIEW", "2026-11-05"),
        move("INTERVIEW", "OFFER", "2026-11-15"),
      ],
    },
    // Rejected after 10 days: a response, but no interview.
    {
      appliedAt: day("2026-11-01"),
      events: [
        created("2026-11-02"),
        move("APPLIED", "REJECTED", "2026-11-11"),
      ],
    },
    // Straight to Offer after 7 days: counts as having reached the interview stage.
    {
      appliedAt: day("2026-11-03"),
      events: [created("2026-11-03"), move("APPLIED", "OFFER", "2026-11-10")],
    },
    // Still waiting: tracked, no response.
    { appliedAt: day("2026-11-20"), events: [created("2026-11-20")] },
    // Legacy card without history: ignored.
    { appliedAt: day("2026-10-01"), events: [] },
    // Created directly in Interview: not tracked from Applied, ignored.
    {
      appliedAt: day("2026-10-01"),
      events: [
        {
          fromStage: null,
          toStage: "INTERVIEW",
          at: at("2026-11-01T09:00:00Z"),
        } as StageEvent,
      ],
    },
  ];

  it("derives the interview rate and average response time from events", () => {
    expect(computeInsights(apps)).toEqual({
      tracked: 4,
      interviewRate: { reached: 2, of: 4, percent: 50 },
      averageDaysToResponse: { days: 7, responses: 3 }, // (4 + 10 + 7) / 3
    });
  });

  it("returns nulls (empty state) below the minimum sample", () => {
    expect(MIN_SAMPLE).toBe(3);
    const few = apps.slice(0, 2);
    expect(computeInsights(few)).toEqual({
      tracked: 2,
      interviewRate: null,
      averageDaysToResponse: null,
    });
    expect(computeInsights([])).toEqual({
      tracked: 0,
      interviewRate: null,
      averageDaysToResponse: null,
    });
  });

  it("ignores cards without recorded history entirely", () => {
    const legacy = Array.from({ length: 5 }, () => ({
      appliedAt: day("2026-01-01"),
      events: [],
    }));
    expect(computeInsights(legacy).tracked).toBe(0);
  });

  it("only counts the first response and never a negative duration", () => {
    const result = computeInsights([
      // Back and forth: the first change out of Applied is the response.
      {
        appliedAt: day("2026-11-10"),
        events: [
          created("2026-11-10"),
          move("APPLIED", "INTERVIEW", "2026-11-12"),
          move("INTERVIEW", "APPLIED", "2026-11-13"),
          move("APPLIED", "REJECTED", "2026-11-30"),
        ],
      },
      // Applied date entered after the response was logged: clamped to 0.
      {
        appliedAt: day("2026-11-20"),
        events: [
          created("2026-11-01"),
          move("APPLIED", "INTERVIEW", "2026-11-02"),
        ],
      },
      {
        appliedAt: day("2026-11-10"),
        events: [
          created("2026-11-10"),
          move("APPLIED", "REJECTED", "2026-11-14"),
        ],
      },
    ]);
    expect(result.averageDaysToResponse).toEqual({ days: 2, responses: 3 }); // (2 + 0 + 4) / 3
    expect(result.interviewRate).toEqual({ reached: 2, of: 3, percent: 67 });
  });
});

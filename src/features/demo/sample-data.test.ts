import { describe, expect, it } from "vitest";

import { buildSampleApplications } from "./sample-data";
import { applicationInputSchema } from "@/features/applications/schema";
import { STAGES } from "@/features/applications/stages";
import {
  computeInsights,
  daysWaiting,
  followUpStatus,
  isStale,
  stageEnteredAt,
} from "@/features/applications/history";

const TODAY = new Date("2026-11-24T15:30:00Z");
// computeInsights expects { appliedAt, events }.
const samples = buildSampleApplications(TODAY).map((s) => ({
  ...s,
  events: s.history,
}));

describe("buildSampleApplications", () => {
  it("has a consistent stage history: created in Applied, ending in the card's stage", () => {
    for (const s of samples) {
      expect(s.history[0]).toMatchObject({
        fromStage: null,
        toStage: "APPLIED",
      });
      expect(s.history.at(-1)?.toStage).toBe(s.stage);
      for (let i = 1; i < s.history.length; i++) {
        expect(s.history[i]?.fromStage).toBe(s.history[i - 1]?.toStage);
        expect(s.history[i]!.at.getTime()).toBeGreaterThan(
          s.history[i - 1]!.at.getTime(),
        );
      }
      expect(s.history.at(-1)!.at.getTime()).toBeLessThan(TODAY.getTime());
    }
  });

  it("shows every V3 feature: insights, stale cards and all follow-up states", () => {
    const insights = computeInsights(samples);
    expect(insights.interviewRate).toEqual({ reached: 3, of: 8, percent: 38 });
    expect(insights.averageDaysToResponse).toEqual({ days: 6.8, responses: 5 });

    const today = new Date("2026-11-24T00:00:00Z");
    const kinds = samples.map((s) => followUpStatus(s.followUpAt, today)?.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["overdue", "today", "upcoming"]),
    );
    const stale = samples.filter((s) =>
      isStale(
        daysWaiting(
          { ...s, stageEnteredAt: stageEnteredAt(s.stage, s.history) },
          today,
        ),
      ),
    );
    expect(stale.map((s) => s.company)).toEqual([
      "Copperleaf Health",
      "Lumen Freight",
    ]);
  });

  it("covers every stage so the demo board has no empty column", () => {
    for (const stage of STAGES) {
      expect(samples.some((s) => s.stage === stage)).toBe(true);
    }
  });

  it("assigns dense ranks 0..n-1 within each stage", () => {
    for (const stage of STAGES) {
      const ranks = samples.filter((s) => s.stage === stage).map((s) => s.rank);
      expect(ranks).toEqual(ranks.map((_, i) => i));
    }
  });

  it("uses past calendar dates at UTC midnight", () => {
    for (const s of samples) {
      expect(s.appliedAt.getTime()).toBeLessThan(TODAY.getTime());
      expect(s.appliedAt.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
    expect(samples[0]?.appliedAt.toISOString()).toBe(
      "2026-11-22T00:00:00.000Z",
    );
  });

  it("only contains data the app's own validation would accept", () => {
    for (const s of samples) {
      const result = applicationInputSchema.safeParse({
        company: s.company,
        jobTitle: s.jobTitle,
        postingUrl: s.postingUrl ?? "",
        notes: s.notes ?? "",
        appliedAt: s.appliedAt.toISOString().slice(0, 10),
        salaryMin: s.salaryMin?.toString() ?? "",
        salaryMax: s.salaryMax?.toString() ?? "",
        salaryCurrency: s.salaryCurrency ?? "",
        stage: s.stage,
        followUpAt: s.followUpAt?.toISOString().slice(0, 10) ?? "",
      });
      expect(result.success, s.company).toBe(true);
    }
  });
});

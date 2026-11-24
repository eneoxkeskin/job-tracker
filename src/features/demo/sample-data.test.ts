import { describe, expect, it } from "vitest";

import { buildSampleApplications } from "./sample-data";
import { applicationInputSchema } from "@/features/applications/schema";
import { STAGES } from "@/features/applications/stages";

const TODAY = new Date("2026-11-24T15:30:00Z");
const samples = buildSampleApplications(TODAY);

describe("buildSampleApplications", () => {
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
      });
      expect(result.success, s.company).toBe(true);
    }
  });
});

// Demo applications for "Load sample data", so a reviewer sees a populated board at once.
// Company names are fictional and links use the reserved example.com domain.
import type { StageId } from "./stages";

type SampleSeed = {
  company: string;
  jobTitle: string;
  stage: StageId;
  daysAgo: number;
  postingUrl?: string;
  notes?: string;
  salary?: { min: number; max: number; currency: "EUR" | "USD" | "GBP" };
};

const SEEDS: SampleSeed[] = [
  {
    company: "Northwind Labs",
    jobTitle: "Frontend Engineer",
    stage: "APPLIED",
    daysAgo: 2,
    postingUrl: "https://example.com/jobs/northwind-frontend",
    salary: { min: 55_000, max: 65_000, currency: "EUR" },
  },
  {
    company: "Bluefin Analytics",
    jobTitle: "Full-stack Developer",
    stage: "APPLIED",
    daysAgo: 5,
    notes: "Referred by a former colleague.",
  },
  {
    company: "Copperleaf Health",
    jobTitle: "React Developer",
    stage: "APPLIED",
    daysAgo: 9,
  },
  {
    company: "Halcyon Systems",
    jobTitle: "Software Engineer, Platform",
    stage: "INTERVIEW",
    daysAgo: 12,
    postingUrl: "https://example.com/jobs/halcyon-platform",
    notes: "Technical interview on Thursday. Review system design basics.",
    salary: { min: 60_000, max: 72_000, currency: "EUR" },
  },
  {
    company: "Lumen Freight",
    jobTitle: "Backend Engineer (Node.js)",
    stage: "INTERVIEW",
    daysAgo: 16,
  },
  {
    company: "Orchid Fintech",
    jobTitle: "Full-stack Engineer",
    stage: "OFFER",
    daysAgo: 24,
    notes: "Offer received. Reply by Friday.",
    salary: { min: 68_000, max: 68_000, currency: "EUR" },
  },
  {
    company: "Quarry & Pine",
    jobTitle: "Web Developer",
    stage: "REJECTED",
    daysAgo: 30,
    notes: "Position filled internally.",
  },
  {
    company: "Tessellate Studio",
    jobTitle: "Junior Frontend Developer",
    stage: "REJECTED",
    daysAgo: 35,
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight `days` before `today` (applied dates are calendar dates, see format.ts). */
function daysBefore(today: Date, days: number): Date {
  const midnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return new Date(midnight - days * DAY_MS);
}

/** Rows ready for `createMany` (plus userId). Ranks are dense per stage, in listed order. */
export function buildSampleApplications(today: Date) {
  const nextRank: Partial<Record<StageId, number>> = {};
  return SEEDS.map((seed) => {
    const rank = nextRank[seed.stage] ?? 0;
    nextRank[seed.stage] = rank + 1;
    return {
      company: seed.company,
      jobTitle: seed.jobTitle,
      postingUrl: seed.postingUrl ?? null,
      notes: seed.notes ?? null,
      appliedAt: daysBefore(today, seed.daysAgo),
      salaryMin: seed.salary?.min ?? null,
      salaryMax: seed.salary?.max ?? null,
      salaryCurrency: seed.salary?.currency ?? null,
      stage: seed.stage,
      rank,
    };
  });
}

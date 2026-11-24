// Seed for "Try demo": a realistic board a visitor sees the moment the demo starts, including
// follow-ups (one overdue, one today, one upcoming), stale cards and backdated stage history,
// so the insights panel has data. Company names are fictional and links use the reserved
// example.com domain. Pure: dates are relative to `today`.
import type { StageEvent } from "@/features/applications/history";
import type { StageId } from "@/features/applications/stages";

type SampleSeed = {
  company: string;
  jobTitle: string;
  stage: StageId;
  daysAgo: number;
  /** Stage changes after the application was added, oldest first. */
  moves?: { to: StageId; daysAgo: number }[];
  /** Follow-up date relative to today (negative: overdue). */
  followUpInDays?: number;
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
    followUpInDays: -1,
    notes: "Referred by a former colleague. Ask her for an update.",
  },
  {
    company: "Copperleaf Health",
    jobTitle: "React Developer",
    stage: "APPLIED",
    daysAgo: 18,
  },
  {
    company: "Halcyon Systems",
    jobTitle: "Software Engineer, Platform",
    stage: "INTERVIEW",
    daysAgo: 12,
    moves: [{ to: "INTERVIEW", daysAgo: 6 }],
    followUpInDays: 2,
    postingUrl: "https://example.com/jobs/halcyon-platform",
    notes: "Technical interview on Thursday. Review system design basics.",
    salary: { min: 60_000, max: 72_000, currency: "EUR" },
  },
  {
    company: "Lumen Freight",
    jobTitle: "Backend Engineer (Node.js)",
    stage: "INTERVIEW",
    daysAgo: 30,
    moves: [{ to: "INTERVIEW", daysAgo: 24 }],
    followUpInDays: 0,
    notes: "First interview went well; no news since.",
  },
  {
    company: "Orchid Fintech",
    jobTitle: "Full-stack Engineer",
    stage: "OFFER",
    daysAgo: 24,
    moves: [
      { to: "INTERVIEW", daysAgo: 19 },
      { to: "OFFER", daysAgo: 5 },
    ],
    notes: "Offer received. Reply by Friday.",
    salary: { min: 68_000, max: 68_000, currency: "EUR" },
  },
  {
    company: "Quarry & Pine",
    jobTitle: "Web Developer",
    stage: "REJECTED",
    daysAgo: 30,
    moves: [{ to: "REJECTED", daysAgo: 20 }],
    notes: "Position filled internally.",
  },
  {
    company: "Tessellate Studio",
    jobTitle: "Junior Frontend Developer",
    stage: "REJECTED",
    daysAgo: 35,
    moves: [{ to: "REJECTED", daysAgo: 28 }],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight `days` before `today` (calendar dates, see format.ts). */
function daysBefore(today: Date, days: number): Date {
  const midnight = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return new Date(midnight - days * DAY_MS);
}

/** A time during that day, so history entries look like real clicks. */
function eventTime(today: Date, daysAgo: number): Date {
  return new Date(daysBefore(today, daysAgo).getTime() + 10 * 60 * 60 * 1000);
}

/**
 * Rows ready for the database (plus userId), each with its stage history. Ranks are dense per
 * stage, in listed order. The history starts with the creation in Applied, like a real card.
 */
export function buildSampleApplications(today: Date) {
  const nextRank: Partial<Record<StageId, number>> = {};
  return SEEDS.map((seed) => {
    const rank = nextRank[seed.stage] ?? 0;
    nextRank[seed.stage] = rank + 1;

    const history: StageEvent[] = [
      {
        fromStage: null,
        toStage: "APPLIED",
        at: eventTime(today, seed.daysAgo),
      },
    ];
    for (const move of seed.moves ?? []) {
      history.push({
        fromStage: history.at(-1)!.toStage,
        toStage: move.to,
        at: eventTime(today, move.daysAgo),
      });
    }

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
      followUpAt:
        seed.followUpInDays === undefined
          ? null
          : daysBefore(today, -seed.followUpInDays),
      history,
    };
  });
}

// Follow-ups, waiting time and event-based metrics (PLAN.md §8, V3). Pure and client-safe.
// All day counts are in UTC calendar days, like every date in the app (see format.ts).
import type { StageId } from "./stages";

/** Applied or Interview cards with no change for this many days get a "no response" note. */
export const STALE_AFTER_DAYS = 14;

/** Metrics need at least this many data points; below it the panel shows an empty state. */
export const MIN_SAMPLE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of the day `date` falls on. */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcDay(to) - utcDay(from)) / DAY_MS);
}

/** "YYYY-MM-DD" (the server's today, passed to the client so both render the same thing). */
export function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export type StageEvent = {
  fromStage: StageId | null;
  toStage: StageId;
  at: Date;
};

/**
 * When the card entered its current stage: the latest event, if it led into that stage.
 * Null when unknown (cards created before stage history existed).
 */
export function stageEnteredAt(
  stage: StageId,
  eventsOldestFirst: readonly StageEvent[],
): Date | null {
  const last = eventsOldestFirst.at(-1);
  return last && last.toStage === stage ? last.at : null;
}

/**
 * Days without a response, for cards still waiting on the company (Applied and Interview);
 * null for other stages. Applied counts from the application date; Interview from when the
 * card entered Interview, or from the application date if that is unknown.
 */
export function daysWaiting(
  card: { stage: StageId; appliedAt: Date; stageEnteredAt: Date | null },
  today: Date,
): number | null {
  if (card.stage === "APPLIED") return daysBetween(card.appliedAt, today);
  if (card.stage === "INTERVIEW") {
    return daysBetween(card.stageEnteredAt ?? card.appliedAt, today);
  }
  return null;
}

export function isStale(days: number | null): days is number {
  return days !== null && days >= STALE_AFTER_DAYS;
}

export type FollowUpStatus =
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "upcoming"; days: number };

export function followUpStatus(
  followUpAt: Date | null,
  today: Date,
): FollowUpStatus | null {
  if (!followUpAt) return null;
  const days = daysBetween(today, followUpAt);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  return { kind: "upcoming", days };
}

export type Insights = {
  /** Applications created in Applied since history exists (the base of both metrics). */
  tracked: number;
  /** Of those, how many reached Interview (or Offer). Null below MIN_SAMPLE tracked. */
  interviewRate: { reached: number; of: number; percent: number } | null;
  /** Average days from applying to the first stage change. Null below MIN_SAMPLE responses. */
  averageDaysToResponse: { days: number; responses: number } | null;
};

/**
 * Metrics derived from stage events. Only applications whose creation in Applied was recorded
 * count, so cards from before the history existed (no events) can't skew the numbers.
 */
export function computeInsights(
  applications: readonly {
    appliedAt: Date;
    events: readonly StageEvent[]; // oldest first
  }[],
): Insights {
  let tracked = 0;
  let reached = 0;
  const responseDays: number[] = [];

  for (const { appliedAt, events } of applications) {
    const [created, ...later] = events;
    if (!created || created.fromStage !== null || created.toStage !== "APPLIED")
      continue;
    tracked += 1;
    if (later.some((e) => e.toStage === "INTERVIEW" || e.toStage === "OFFER")) {
      reached += 1;
    }
    const response = later.find((e) => e.toStage !== "APPLIED");
    if (response) {
      responseDays.push(Math.max(0, daysBetween(appliedAt, response.at)));
    }
  }

  return {
    tracked,
    interviewRate:
      tracked >= MIN_SAMPLE
        ? {
            reached,
            of: tracked,
            percent: Math.round((reached / tracked) * 100),
          }
        : null,
    averageDaysToResponse:
      responseDays.length >= MIN_SAMPLE
        ? {
            days:
              Math.round(
                (responseDays.reduce((sum, d) => sum + d, 0) /
                  responseDays.length) *
                  10,
              ) / 10,
            responses: responseDays.length,
          }
        : null,
  };
}

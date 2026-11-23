// Client-safe: only a *type* is imported from the generated Prisma code, so nothing from it
// ends up in the browser bundle.
import type { Stage } from "@/generated/prisma/enums";

/** Board columns, in display order. */
export const STAGES = [
  "APPLIED",
  "INTERVIEW",
  "OFFER",
  "REJECTED",
] as const satisfies readonly Stage[];

export type StageId = (typeof STAGES)[number];

// Compile-time guard: fails if a stage is added to the Prisma enum but not to STAGES.
type AssertTrue<T extends true> = T;
export type StagesCoverPrismaEnum = AssertTrue<
  [Exclude<Stage, StageId>] extends [never] ? true : false
>;

export const STAGE_LABELS: Record<StageId, string> = {
  APPLIED: "Applied",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export function isStage(value: unknown): value is StageId {
  return (
    typeof value === "string" && (STAGES as readonly string[]).includes(value)
  );
}

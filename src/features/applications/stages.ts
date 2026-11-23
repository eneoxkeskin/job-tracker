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

export type MoveOption = { value: StageId; label: string; isCurrent: boolean };

/**
 * Options for the "Move to" menu: every stage in board order, the card's current stage
 * marked "(current)" so the menu opens on where the card already is.
 */
export function moveOptions(current: StageId): MoveOption[] {
  return STAGES.map((stage) => ({
    value: stage,
    label:
      stage === current
        ? `${STAGE_LABELS[stage]} (current)`
        : STAGE_LABELS[stage],
    isCurrent: stage === current,
  }));
}

/** A move is only meaningful to a valid stage other than the current one. */
export function canMoveTo(
  target: unknown,
  current: StageId,
): target is StageId {
  return isStage(target) && target !== current;
}

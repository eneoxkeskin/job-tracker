import { STAGES, type StageId } from "./stages";

export type StageSummary = {
  byStage: Record<StageId, number>;
  total: number;
};

/** Number of applications per stage (every stage present, zero included) and in total. */
export function countByStage(
  applications: readonly { stage: StageId }[],
): StageSummary {
  const byStage = Object.fromEntries(
    STAGES.map((stage) => [stage, 0]),
  ) as Record<StageId, number>;
  for (const { stage } of applications) {
    byStage[stage] += 1;
  }
  return { byStage, total: applications.length };
}

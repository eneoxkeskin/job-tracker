// Ordering of cards within a stage column (see PLAN.md §3).
// Pure and client-safe: the server uses it to compute ranks, the board uses it for the
// optimistic update, so both always agree on the resulting order.
import { STAGES, type StageId } from "./stages";

export type Columns<T> = Record<StageId, T[]>;

type Sortable = { id: string; stage: StageId; rank: number; createdAt: Date };

/** Display order inside a column: rank ascending; ties (rare, see PLAN.md) newest first, then id. */
export function compareCards(a: Sortable, b: Sortable): number {
  return (
    a.rank - b.rank ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Groups cards into one sorted list per stage; every stage is present, possibly empty. */
export function groupByStage<T extends Sortable>(
  cards: readonly T[],
): Columns<T> {
  const columns = Object.fromEntries(
    STAGES.map((stage) => [stage, [] as T[]]),
  ) as Columns<T>;
  for (const card of cards) {
    columns[card.stage].push(card);
  }
  for (const stage of STAGES) {
    columns[stage].sort(compareCards);
  }
  return columns;
}

function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.min(Math.max(Math.trunc(index), 0), length);
}

/**
 * The column's ids after placing `movedId` at `toIndex`, its final position in the column.
 * `columnIds` may or may not already contain `movedId` (same-column vs cross-column move).
 * Out-of-range indexes are clamped, so a stale client index can't corrupt the order.
 */
export function reorder(
  columnIds: readonly string[],
  movedId: string,
  toIndex: number,
): string[] {
  const rest = columnIds.filter((id) => id !== movedId);
  const index = clampIndex(toIndex, rest.length);
  return [...rest.slice(0, index), movedId, ...rest.slice(index)];
}

export type RankUpdate = { id: string; stage: StageId; rank: number };

/**
 * Minimal set of row updates so that, in `stage`, each card's rank equals its position in
 * `orderedIds`. Rows already correct are skipped. A card coming from another column always
 * gets an update, because its stage changes.
 */
export function planRankUpdates(
  orderedIds: readonly string[],
  stage: StageId,
  current: ReadonlyMap<string, { stage: StageId; rank: number }>,
): RankUpdate[] {
  const updates: RankUpdate[] = [];
  orderedIds.forEach((id, rank) => {
    const before = current.get(id);
    if (!before || before.stage !== stage || before.rank !== rank) {
      updates.push({ id, stage, rank });
    }
  });
  return updates;
}

/** Stage and 0-based position of a card, or null if it isn't on the board. */
export function locateCard<T extends { id: string }>(
  columns: Columns<T>,
  id: string,
): { stage: StageId; index: number } | null {
  for (const stage of STAGES) {
    const index = columns[stage].findIndex((card) => card.id === id);
    if (index !== -1) return { stage, index };
  }
  return null;
}

/**
 * The stage a drag target belongs to: `id` is either a column (its stage) or a card in one.
 */
export function resolveStage<T extends { id: string }>(
  columns: Columns<T>,
  id: string,
): StageId | null {
  if ((STAGES as readonly string[]).includes(id)) return id as StageId;
  return locateCard(columns, id)?.stage ?? null;
}

/** Rank for a newly created card so it appears at the top of its column. */
export function rankForNewCard(minRankInColumn: number | null): number {
  return minRankInColumn === null ? 0 : minRankInColumn - 1;
}

/**
 * Client-side counterpart of the server move: returns new columns with the card moved to
 * `toStage` at `toIndex`. Returns the input unchanged if the card isn't found.
 */
export function moveCard<T extends { id: string; stage: StageId }>(
  columns: Columns<T>,
  id: string,
  toStage: StageId,
  toIndex: number,
): Columns<T> {
  for (const fromStage of STAGES) {
    const card = columns[fromStage].find((c) => c.id === id);
    if (!card) continue;

    const next = {
      ...columns,
      [fromStage]: columns[fromStage].filter((c) => c.id !== id),
    };
    const target = next[toStage];
    const index = clampIndex(toIndex, target.length);
    next[toStage] = [
      ...target.slice(0, index),
      { ...card, stage: toStage },
      ...target.slice(index),
    ];
    return next;
  }
  return columns;
}

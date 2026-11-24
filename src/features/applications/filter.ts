// Board search and stage filter (PLAN.md §8, V4). Pure and client-safe. The filter lives in the
// URL (?q=&stage=), so it is shareable, survives a reload and works without JavaScript.
import type { Columns } from "./ranking";
import { isStage, STAGES, type StageId } from "./stages";

export const MAX_QUERY_LENGTH = 100;

export type BoardFilter = { q: string; stage: StageId | null };

export const NO_FILTER: BoardFilter = { q: "", stage: null };

type SearchParam = string | string[] | undefined;

/** Reads the filter from search params; anything unexpected is ignored rather than an error. */
export function parseBoardFilter(params: {
  q?: SearchParam;
  stage?: SearchParam;
}): BoardFilter {
  const first = (value: SearchParam) =>
    Array.isArray(value) ? value[0] : value;
  const q = (first(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const stage = first(params.stage);
  return { q, stage: isStage(stage) ? stage : null };
}

export function isFilterActive(filter: BoardFilter): boolean {
  return filter.q !== "" || filter.stage !== null;
}

/** Case- and accent-insensitive form for matching ("Zürich" matches "zurich"). */
function normalize(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");
}

export function matchesFilter(
  card: { company: string; jobTitle: string; stage: StageId },
  filter: BoardFilter,
): boolean {
  if (filter.stage !== null && card.stage !== filter.stage) return false;
  if (filter.q === "") return true;
  const query = normalize(filter.q);
  return (
    normalize(card.company).includes(query) ||
    normalize(card.jobTitle).includes(query)
  );
}

/** The columns with only the matching cards (order kept). Unfiltered input is returned as is. */
export function filterColumns<
  T extends { company: string; jobTitle: string; stage: StageId },
>(columns: Columns<T>, filter: BoardFilter): Columns<T> {
  if (!isFilterActive(filter)) return columns;
  return Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      columns[stage].filter((card) => matchesFilter(card, filter)),
    ]),
  ) as Columns<T>;
}

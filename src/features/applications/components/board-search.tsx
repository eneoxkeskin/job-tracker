import Form from "next/form";
import Link from "next/link";

import { buttonPrimary, buttonSecondary, inputBase } from "@/components/styles";

import { type BoardFilter, isFilterActive, MAX_QUERY_LENGTH } from "../filter";
import { STAGE_LABELS, STAGES } from "../stages";

/**
 * Search and stage filter. A GET form: the filter ends up in the URL, so it is shareable and
 * works without JavaScript; with JavaScript, next/form navigates on the client.
 */
export function BoardSearch({ filter }: { filter: BoardFilter }) {
  return (
    <Form
      action="/board"
      role="search"
      aria-label="Filter applications"
      className="mb-4 flex flex-wrap items-end gap-3"
    >
      <div className="min-w-0 flex-1 basis-56 space-y-1.5">
        <label htmlFor="board-q" className="block font-medium text-slate-900">
          Search company or job title
        </label>
        <input
          id="board-q"
          name="q"
          type="search"
          defaultValue={filter.q}
          maxLength={MAX_QUERY_LENGTH}
          className={inputBase}
        />
      </div>
      <div className="basis-40 space-y-1.5">
        <label
          htmlFor="board-stage"
          className="block font-medium text-slate-900"
        >
          Stage
        </label>
        <select
          id="board-stage"
          name="stage"
          defaultValue={filter.stage ?? ""}
          className={inputBase}
        >
          <option value="">All stages</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button type="submit" className={buttonPrimary}>
          Apply
        </button>
        {isFilterActive(filter) && (
          <Link href="/board" className={buttonSecondary}>
            Clear<span className="sr-only"> filters</span>
          </Link>
        )}
      </div>
    </Form>
  );
}

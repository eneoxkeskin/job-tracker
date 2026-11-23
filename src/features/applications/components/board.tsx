import type { Columns } from "../ranking";
import type { ApplicationListItem } from "../queries";
import { STAGE_LABELS, STAGES, type StageId } from "../stages";
import { ApplicationCard } from "./application-card";

// Stage accent. Never the only signal: every column also has its text heading.
const STAGE_ACCENT: Record<StageId, string> = {
  APPLIED: "border-t-blue-600",
  INTERVIEW: "border-t-amber-500",
  OFFER: "border-t-green-600",
  REJECTED: "border-t-slate-500",
};

type BoardProps = {
  columns: Columns<ApplicationListItem>;
};

export function Board({ columns }: BoardProps) {
  return (
    // Phones: columns scroll horizontally with snapping. Desktop: four-column grid.
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
      {STAGES.map((stage) => (
        <section
          key={stage}
          aria-labelledby={`column-${stage}`}
          className={`flex w-[85%] shrink-0 snap-start flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100 sm:w-[45%] md:w-auto ${STAGE_ACCENT[stage]}`}
        >
          <h2
            id={`column-${stage}`}
            className="flex items-center justify-between px-3 pt-3 pb-2 font-semibold text-slate-900"
          >
            {STAGE_LABELS[stage]}
            <span className="rounded-full bg-white px-2 py-0.5 text-sm font-medium text-slate-700">
              {columns[stage].length}
              <span className="sr-only"> applications</span>
            </span>
          </h2>
          {columns[stage].length === 0 ? (
            <p className="mx-3 mb-3 rounded-md border border-dashed border-slate-400 px-3 py-6 text-center text-sm text-slate-700">
              No applications in this stage.
            </p>
          ) : (
            <ul className="space-y-2 px-3 pb-3">
              {columns[stage].map((application) => (
                <li key={application.id}>
                  <ApplicationCard application={application} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

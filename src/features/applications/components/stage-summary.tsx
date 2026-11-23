import type { StageSummary as Summary } from "../stats";
import { STAGE_LABELS, STAGES, type StageId } from "../stages";

// Same accents as the board columns; the text label always carries the meaning.
const STAGE_ACCENT: Record<StageId, string> = {
  APPLIED: "border-l-blue-600",
  INTERVIEW: "border-l-amber-500",
  OFFER: "border-l-green-600",
  REJECTED: "border-l-slate-500",
};

const tile = "rounded-lg border border-slate-200 bg-white px-3 py-2";

/** Count per stage and in total. A description list, so each number has a proper label. */
export function StageSummary({ summary }: { summary: Summary }) {
  return (
    <section aria-labelledby="summary-title" className="mb-6">
      <h2 id="summary-title" className="sr-only">
        Summary
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        <div
          className={`${tile} col-span-2 border-l-4 border-l-slate-900 sm:col-span-1`}
        >
          <dt className="text-sm text-slate-700">Total</dt>
          <dd className="text-2xl font-semibold text-slate-900">
            {summary.total}
          </dd>
        </div>
        {STAGES.map((stage) => (
          <div
            key={stage}
            className={`${tile} border-l-4 ${STAGE_ACCENT[stage]}`}
          >
            <dt className="text-sm text-slate-700">{STAGE_LABELS[stage]}</dt>
            <dd className="text-2xl font-semibold text-slate-900">
              {summary.byStage[stage]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

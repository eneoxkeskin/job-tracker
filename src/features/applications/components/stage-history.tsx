import { formatDate } from "../format";
import type { StageEvent } from "../history";
import { STAGE_LABELS } from "../stages";

/** The application's stage changes, oldest first, as an ordered list. */
export function StageHistory({
  events,
}: {
  events: readonly (StageEvent & { id: string })[];
}) {
  return (
    <section
      aria-labelledby="stage-history"
      className="mt-12 border-t border-slate-200 pt-6"
    >
      <h2 id="stage-history" className="font-semibold text-slate-900">
        Stage history
      </h2>
      {events.length === 0 ? (
        <p className="mt-1 text-slate-700">
          No history yet. Stage changes are recorded from the day this feature
          was added, so older applications start without one.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap gap-x-3 border-l-2 border-slate-300 pl-3"
            >
              <time
                dateTime={event.at.toISOString()}
                className="text-sm text-slate-700"
              >
                {formatDate(event.at)}
              </time>
              <span className="text-slate-900">
                {event.fromStage === null ? (
                  <>Added in {STAGE_LABELS[event.toStage]}</>
                ) : (
                  <>
                    {STAGE_LABELS[event.fromStage]}{" "}
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">to</span>{" "}
                    {STAGE_LABELS[event.toStage]}
                  </>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import { type Insights, MIN_SAMPLE } from "../history";

const tile = "rounded-lg border border-slate-200 bg-white px-3 py-2";

/**
 * Metrics derived from stage history. Each metric shows its sample size, and below the
 * minimum sample it explains what's missing instead of showing a misleading number.
 */
export function InsightsPanel({ insights }: { insights: Insights }) {
  const { interviewRate, averageDaysToResponse } = insights;

  return (
    <section aria-labelledby="insights-title" className="mb-6">
      <h2 id="insights-title" className="mb-2 font-semibold text-slate-900">
        Insights
      </h2>
      {interviewRate === null && averageDaysToResponse === null ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white px-3 py-3 text-sm text-slate-700">
          Not enough history yet. Insights appear once at least {MIN_SAMPLE}{" "}
          applications added in Applied have moved on (tracked so far:{" "}
          {insights.tracked}). Applications added before stage history was
          recorded aren&apos;t counted.
        </p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className={tile}>
            <dt className="text-sm text-slate-700">Applied → Interview</dt>
            <dd className="text-2xl font-semibold text-slate-900">
              {interviewRate ? `${interviewRate.percent}%` : "—"}
            </dd>
            <dd className="text-sm text-slate-700">
              {interviewRate
                ? `${interviewRate.reached} of ${interviewRate.of} applications reached an interview`
                : `Needs at least ${MIN_SAMPLE} tracked applications`}
            </dd>
          </div>
          <div className={tile}>
            <dt className="text-sm text-slate-700">
              Average time to first response
            </dt>
            <dd className="text-2xl font-semibold text-slate-900">
              {averageDaysToResponse
                ? `${averageDaysToResponse.days} ${averageDaysToResponse.days === 1 ? "day" : "days"}`
                : "—"}
            </dd>
            <dd className="text-sm text-slate-700">
              {averageDaysToResponse
                ? `Across ${averageDaysToResponse.responses} responses`
                : `Needs at least ${MIN_SAMPLE} responses`}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

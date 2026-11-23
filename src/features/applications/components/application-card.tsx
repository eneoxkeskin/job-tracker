import { focusRing } from "@/components/styles";

import { formatAppliedDate, formatSalaryRange } from "../format";
import type { ApplicationListItem } from "../queries";

type ApplicationCardProps = {
  application: ApplicationListItem;
};

/** Presentational card; no hooks, so it can be rendered by server and client components. */
export function ApplicationCard({ application }: ApplicationCardProps) {
  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
  );

  return (
    <article className="space-y-1 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <h3 className="font-semibold break-words text-slate-900">
        {application.company}
      </h3>
      <p className="break-words text-slate-800">{application.jobTitle}</p>
      <p className="text-sm text-slate-700">
        Applied{" "}
        <time dateTime={application.appliedAt.toISOString().slice(0, 10)}>
          {formatAppliedDate(application.appliedAt)}
        </time>
      </p>
      {salary && <p className="text-sm text-slate-700">{salary}</p>}
      {application.notes && (
        <p className="line-clamp-2 text-sm break-words text-slate-600">
          {application.notes}
        </p>
      )}
      {application.postingUrl && (
        <a
          href={application.postingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block rounded text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 ${focusRing}`}
        >
          Job posting
          <span className="sr-only">
            {" "}
            for {application.company} (opens in a new tab)
          </span>
        </a>
      )}
    </article>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { focusRing } from "@/components/styles";

import { formatAppliedDate, formatSalaryRange } from "../format";
import type { ApplicationListItem } from "../queries";
import { MoveToForm } from "./move-to-form";

type ApplicationCardProps = {
  application: ApplicationListItem;
  /** Optional drag handle rendered next to the title (provided by the board). */
  dragHandle?: ReactNode;
};

const linkStyle = `inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 ${focusRing}`;

/** Presentational card; no hooks, so it can be rendered by server and client components. */
export function ApplicationCard({
  application,
  dragHandle,
}: ApplicationCardProps) {
  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
  );

  return (
    <article className="space-y-1 rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 font-semibold break-words text-slate-900">
          {application.company}
        </h3>
        {dragHandle}
      </div>
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
      <div className="flex flex-wrap items-center gap-x-4">
        <Link
          href={`/applications/${application.id}/edit`}
          className={linkStyle}
        >
          Edit<span className="sr-only"> {application.company}</span>
        </Link>
        {application.postingUrl && (
          <a
            href={application.postingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={linkStyle}
          >
            Job posting
            <span className="sr-only">
              {" "}
              for {application.company} (opens in a new tab)
            </span>
          </a>
        )}
      </div>
      <MoveToForm
        id={application.id}
        company={application.company}
        stage={application.stage}
      />
    </article>
  );
}

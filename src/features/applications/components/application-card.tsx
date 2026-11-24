import Link from "next/link";
import type { ReactNode } from "react";

import { focusRing } from "@/components/styles";

import { formatDate, formatSalaryRange } from "../format";
import {
  daysWaiting,
  type FollowUpStatus,
  followUpStatus,
  isStale,
} from "../history";
import type { ApplicationListItem } from "../queries";
import { MoveToForm } from "./move-to-form";

type ApplicationCardProps = {
  application: ApplicationListItem;
  /** Today (UTC midnight), from the server, so server and client render the same notes. */
  today: Date;
  /** Optional drag handle rendered next to the title (provided by the board). */
  dragHandle?: ReactNode;
};

const linkStyle = `inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 ${focusRing}`;

/** Presentational card; no hooks, so it can be rendered by server and client components. */
export function ApplicationCard({
  application,
  today,
  dragHandle,
}: ApplicationCardProps) {
  const salary = formatSalaryRange(
    application.salaryMin,
    application.salaryMax,
    application.salaryCurrency,
  );
  const waiting = daysWaiting(application, today);
  const followUp = followUpStatus(application.followUpAt, today);

  return (
    <article
      className={`space-y-1 rounded-lg border border-slate-300 bg-white p-3 shadow-sm ${followUp?.kind === "overdue" ? "border-l-4 border-l-red-700" : ""}`}
    >
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
          {formatDate(application.appliedAt)}
        </time>
      </p>
      {salary && <p className="text-sm text-slate-700">{salary}</p>}
      {followUp && application.followUpAt && (
        <FollowUpNote status={followUp} date={application.followUpAt} />
      )}
      {isStale(waiting) && (
        <p className="flex items-center gap-1.5 text-sm text-slate-700">
          <ClockIcon />
          No response for {waiting} days
        </p>
      )}
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

/**
 * The reminder note. Its wording carries the meaning ("overdue", "today"); color and the icon
 * only reinforce it, so nothing depends on color alone.
 */
function FollowUpNote({
  status,
  date,
}: {
  status: FollowUpStatus;
  date: Date;
}) {
  const time = (
    <time dateTime={date.toISOString().slice(0, 10)}>{formatDate(date)}</time>
  );
  if (status.kind === "overdue") {
    return (
      <p className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-sm font-medium text-red-800">
        <AlertIcon />
        <span>
          Follow-up overdue by {status.days}{" "}
          {status.days === 1 ? "day" : "days"} ({time})
        </span>
      </p>
    );
  }
  if (status.kind === "today") {
    return (
      <p className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-sm font-medium text-amber-900">
        <BellIcon />
        Follow up today
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-slate-700">
      <BellIcon />
      <span>Follow up on {time}</span>
    </p>
  );
}

const iconProps = {
  "aria-hidden": true,
  viewBox: "0 0 20 20",
  fill: "currentColor",
  className: "size-4 shrink-0",
} as const;

function AlertIcon() {
  return (
    <svg {...iconProps} className="mt-0.5 size-4 shrink-0">
      <path
        fillRule="evenodd"
        d="M8.5 2.6a1.7 1.7 0 0 1 3 0l6.3 11.4a1.7 1.7 0 0 1-1.5 2.5H3.7a1.7 1.7 0 0 1-1.5-2.5L8.5 2.6ZM10 7a.8.8 0 0 0-.8.8v3.4a.8.8 0 0 0 1.6 0V7.8A.8.8 0 0 0 10 7Zm0 7.6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 2a5 5 0 0 0-5 5v2.6l-1.3 2.6A1 1 0 0 0 4.6 14h10.8a1 1 0 0 0 .9-1.4L15 9.6V7a5 5 0 0 0-5-5Zm0 16a2.5 2.5 0 0 1-2.4-2h4.8A2.5 2.5 0 0 1 10 18Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.8-12.2a.8.8 0 0 0-1.6 0V10c0 .2.1.4.2.6l2.5 2.5a.8.8 0 1 0 1.1-1.1l-2.2-2.3V5.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

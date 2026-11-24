import type { Metadata } from "next";
import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary, focusRing } from "@/components/styles";
import { restoreApplication } from "@/features/applications/actions";
import { formatDate } from "@/features/applications/format";
import { listArchivedApplications } from "@/features/applications/queries";
import { STAGE_LABELS } from "@/features/applications/stages";

export const metadata: Metadata = {
  title: "Archive · Job Application Tracker",
};

export default async function ArchivePage() {
  // Resolves the session itself and redirects when signed out.
  const archived = await listArchivedApplications();

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Archive</h1>
        <Link href="/board" className={buttonSecondary}>
          Back to board
        </Link>
      </div>
      <p className="mb-6 text-slate-700">
        Archived applications are hidden from the board and the insights. Their
        data and history are kept, and you can restore them at any time.
      </p>

      {archived.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-400 bg-white px-6 py-12 text-center text-slate-700">
          Nothing archived. You can archive an application from its edit page.
        </p>
      ) : (
        <ul className="space-y-3">
          {archived.map((application) => (
            <li
              key={application.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white p-3"
            >
              <div className="min-w-0">
                <h2 className="font-semibold break-words text-slate-900">
                  {application.company}
                </h2>
                <p className="break-words text-slate-800">
                  {application.jobTitle}
                </p>
                <p className="text-sm text-slate-700">
                  {STAGE_LABELS[application.stage]} · archived{" "}
                  {application.archivedAt && (
                    <time dateTime={application.archivedAt.toISOString()}>
                      {formatDate(application.archivedAt)}
                    </time>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/applications/${application.id}/edit`}
                  className={`inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 ${focusRing}`}
                >
                  Edit<span className="sr-only"> {application.company}</span>
                </Link>
                <form action={restoreApplication.bind(null, application.id)}>
                  <SubmitButton
                    pendingLabel="Restoring…"
                    className={buttonSecondary}
                  >
                    Restore
                    <span className="sr-only"> {application.company}</span>
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

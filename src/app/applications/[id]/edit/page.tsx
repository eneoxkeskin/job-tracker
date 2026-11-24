import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  deleteApplication,
  updateApplication,
} from "@/features/applications/actions";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { DeleteApplication } from "@/features/applications/components/delete-application";
import { StageHistory } from "@/features/applications/components/stage-history";
import { toDateInputValue } from "@/features/applications/format";
import { getApplication } from "@/features/applications/queries";

export const metadata: Metadata = {
  title: "Edit application · Job Application Tracker",
};

export default async function EditApplicationPage({
  params,
}: PageProps<"/applications/[id]/edit">) {
  const { id } = await params;
  // null for a missing *or someone else's* id: both are a 404, never a 403.
  const application = await getApplication(id);
  if (!application) notFound();

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold break-words text-slate-900">
        Edit {application.company}
      </h1>
      <ApplicationForm
        action={updateApplication.bind(null, application.id)}
        defaults={{
          company: application.company,
          jobTitle: application.jobTitle,
          postingUrl: application.postingUrl ?? "",
          notes: application.notes ?? "",
          appliedAt: toDateInputValue(application.appliedAt),
          salaryMin: application.salaryMin?.toString() ?? "",
          salaryMax: application.salaryMax?.toString() ?? "",
          salaryCurrency: application.salaryCurrency ?? "",
          stage: application.stage,
          followUpAt: application.followUpAt
            ? toDateInputValue(application.followUpAt)
            : "",
        }}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        cancelHref="/board"
      />

      <StageHistory events={application.events} />

      <section
        aria-labelledby="danger-zone"
        className="mt-12 border-t border-slate-200 pt-6"
      >
        <h2 id="danger-zone" className="font-semibold text-slate-900">
          Delete application
        </h2>
        <p className="mt-1 mb-4 text-slate-700">
          Remove this application from your board permanently.
        </p>
        <DeleteApplication
          company={application.company}
          action={deleteApplication.bind(null, application.id)}
        />
      </section>
    </main>
  );
}

import type { Metadata } from "next";

import { createApplication } from "@/features/applications/actions";
import { ApplicationForm } from "@/features/applications/components/application-form";
import { toDateInputValue } from "@/features/applications/format";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Add application · Job Application Tracker",
};

export default async function NewApplicationPage() {
  await requireUserId();

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">
        Add application
      </h1>
      <ApplicationForm
        action={createApplication}
        defaults={{
          company: "",
          jobTitle: "",
          postingUrl: "",
          notes: "",
          // Today in UTC, computed on the server so server and client render the same value.
          appliedAt: toDateInputValue(new Date()),
          salaryMin: "",
          salaryMax: "",
          salaryCurrency: "",
          stage: "APPLIED",
        }}
        submitLabel="Save application"
        pendingLabel="Saving…"
        cancelHref="/board"
      />
    </main>
  );
}

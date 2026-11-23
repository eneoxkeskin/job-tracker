import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, buttonSecondary } from "@/components/styles";

import { loadSampleData } from "../actions";

export function EmptyBoard() {
  return (
    <section
      aria-labelledby="empty-board-title"
      className="mx-auto max-w-xl rounded-lg border border-dashed border-slate-400 bg-white px-6 py-12 text-center"
    >
      <h2
        id="empty-board-title"
        className="text-xl font-semibold text-slate-900"
      >
        No applications yet
      </h2>
      <p className="mt-2 text-slate-700">
        Add the first job you applied for. You can move it through the stages as
        you hear back.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/applications/new" className={buttonPrimary}>
          Add your first application
        </Link>
        <form action={loadSampleData}>
          <SubmitButton
            pendingLabel="Loading sample data…"
            className={buttonSecondary}
          >
            Load sample data
          </SubmitButton>
        </form>
      </div>
      <p className="mt-4 text-sm text-slate-700">
        Sample data adds eight fictional applications you can edit or delete.
      </p>
    </section>
  );
}

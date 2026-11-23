import type { Metadata } from "next";
import Link from "next/link";

import { buttonPrimary } from "@/components/styles";
import { Board } from "@/features/applications/components/board";
import { EmptyBoard } from "@/features/applications/components/empty-board";
import { listApplications } from "@/features/applications/queries";
import { groupByStage } from "@/features/applications/ranking";

export const metadata: Metadata = { title: "Board · Job Application Tracker" };

export default async function BoardPage() {
  // listApplications() resolves the session itself and redirects when signed out.
  const applications = await listApplications();

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Your applications
        </h1>
        {applications.length > 0 && (
          <Link href="/applications/new" className={buttonPrimary}>
            Add application
          </Link>
        )}
      </div>
      {applications.length === 0 ? (
        <EmptyBoard />
      ) : (
        <Board columns={groupByStage(applications)} />
      )}
    </main>
  );
}

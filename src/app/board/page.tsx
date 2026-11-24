import type { Metadata } from "next";
import Link from "next/link";

import { buttonPrimary } from "@/components/styles";
import { Board } from "@/features/applications/components/board";
import { EmptyBoard } from "@/features/applications/components/empty-board";
import { InsightsPanel } from "@/features/applications/components/insights-panel";
import { toDateInputValue } from "@/features/applications/format";
import { getInsights, listApplications } from "@/features/applications/queries";
import { groupByStage } from "@/features/applications/ranking";

export const metadata: Metadata = { title: "Board · Job Application Tracker" };

export default async function BoardPage() {
  // Both queries resolve the session themselves and redirect when signed out.
  const [applications, insights] = await Promise.all([
    listApplications(),
    getInsights(),
  ]);

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
        <Board
          columns={groupByStage(applications)}
          // "Today" in UTC, decided once on the server (see history.ts).
          today={toDateInputValue(new Date())}
          insights={<InsightsPanel insights={insights} />}
        />
      )}
    </main>
  );
}

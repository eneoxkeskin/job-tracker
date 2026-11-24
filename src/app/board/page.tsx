import type { Metadata } from "next";
import Link from "next/link";

import { buttonPrimary, buttonSecondary } from "@/components/styles";
import { Board } from "@/features/applications/components/board";
import { BoardSearch } from "@/features/applications/components/board-search";
import { EmptyBoard } from "@/features/applications/components/empty-board";
import { InsightsPanel } from "@/features/applications/components/insights-panel";
import {
  filterColumns,
  isFilterActive,
  parseBoardFilter,
} from "@/features/applications/filter";
import { toDateInputValue } from "@/features/applications/format";
import {
  countArchivedApplications,
  getInsights,
  listApplications,
} from "@/features/applications/queries";
import { groupByStage } from "@/features/applications/ranking";
import { STAGES } from "@/features/applications/stages";

export const metadata: Metadata = { title: "Board · Job Application Tracker" };

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  // The queries resolve the session themselves and redirect when signed out.
  const [applications, insights, archivedCount] = await Promise.all([
    listApplications(),
    getInsights(),
    countArchivedApplications(),
  ]);
  const filter = parseBoardFilter(await searchParams);
  const columns = groupByStage(applications);
  const shownCount = STAGES.reduce(
    (sum, stage) => sum + filterColumns(columns, filter)[stage].length,
    0,
  );

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          Your applications
        </h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/archive" className={buttonSecondary}>
            Archive
            {archivedCount > 0 && (
              <span className="rounded-full bg-slate-100 px-2 text-sm">
                {archivedCount}
                <span className="sr-only"> archived</span>
              </span>
            )}
          </Link>
          {applications.length > 0 && (
            <Link href="/applications/new" className={buttonPrimary}>
              Add application
            </Link>
          )}
        </div>
      </div>
      {applications.length === 0 ? (
        <EmptyBoard />
      ) : (
        <>
          <BoardSearch filter={filter} />
          {/* Announced after each search (the page re-renders with the new URL). */}
          <p
            role="status"
            className={
              isFilterActive(filter) ? "mb-4 text-slate-700" : "sr-only"
            }
          >
            {isFilterActive(filter)
              ? `Showing ${shownCount} of ${applications.length} applications.`
              : ""}
          </p>
          <Board
            columns={columns}
            filter={filter}
            // "Today" in UTC, decided once on the server (see history.ts).
            today={toDateInputValue(new Date())}
            insights={<InsightsPanel insights={insights} />}
          />
        </>
      )}
    </main>
  );
}

import type { Metadata } from "next";

import { requireUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Board · Job Application Tracker" };

export default async function BoardPage() {
  await requireUserId();

  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Your applications
      </h1>
      <p className="mt-2 text-slate-700">
        The board arrives in the next milestone.
      </p>
    </main>
  );
}

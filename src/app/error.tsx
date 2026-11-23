"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

import { buttonPrimary, buttonSecondary } from "@/components/styles";

// Fallback for every route without its own error.tsx. In production, server errors arrive
// with a generic message and a digest only, so no internal details reach the browser.
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center"
    >
      <div role="alert">
        <h1 className="text-2xl font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-slate-700">
          The request couldn&apos;t be completed. Please try again.
        </p>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className={buttonPrimary}>
          Try again
        </button>
        <Link href="/board" className={buttonSecondary}>
          Back to your board
        </Link>
      </div>
    </main>
  );
}

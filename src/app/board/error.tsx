"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

import { buttonPrimary } from "@/components/styles";

// In production, server errors arrive here with a generic message and a digest only, so no
// internal details can leak to the browser.
export default function BoardError({
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
          Couldn&apos;t load your board
        </h1>
        <p className="mt-2 text-slate-700">
          Something went wrong on our side. Your data is safe — please try
          again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className={`${buttonPrimary} mt-6`}
      >
        Try again
      </button>
    </main>
  );
}

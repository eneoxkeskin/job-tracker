"use client";

import { useId, useRef } from "react";

import { SubmitButton } from "@/components/submit-button";
import { buttonDanger, buttonSecondary } from "@/components/styles";

type DeleteApplicationProps = {
  company: string;
  action: () => Promise<void>;
};

/**
 * Delete with confirmation in a native <dialog>: showModal() gives focus trapping, Escape to
 * close, an inert background and focus return for free, with no extra library.
 */
export function DeleteApplication({ company, action }: DeleteApplicationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={buttonDanger}
      >
        Delete application
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-6 shadow-xl backdrop:bg-slate-900/50"
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          Delete {company}?
        </h2>
        <p id={descriptionId} className="mt-2 text-slate-700">
          This permanently removes the application and its notes. This
          can&apos;t be undone.
        </p>
        <form action={action} className="mt-6 flex flex-wrap justify-end gap-3">
          {/* Cancel comes first so it receives initial focus, not the destructive action. */}
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            className={buttonSecondary}
          >
            Cancel
          </button>
          <SubmitButton pendingLabel="Deleting…" className={buttonDanger}>
            Delete
          </SubmitButton>
        </form>
      </dialog>
    </>
  );
}

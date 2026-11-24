"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/styles";

import { startDemo, type StartDemoState } from "../actions";

const INITIAL: StartDemoState = { error: null };

export function TryDemoButton() {
  const [state, formAction] = useActionState(startDemo, INITIAL);

  return (
    <form action={formAction} className="contents">
      <SubmitButton pendingLabel="Starting demo…" className={buttonSecondary}>
        Try demo
      </SubmitButton>
      {state.error && (
        <p
          role="alert"
          className="w-full rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}

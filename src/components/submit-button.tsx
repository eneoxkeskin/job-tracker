"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  /** Extra disabled condition on top of "form is submitting". */
  disabled?: boolean;
  "aria-describedby"?: string;
};

/** A submit button that disables itself and shows a pending label while its form submits. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled = false,
  "aria-describedby": describedBy,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-describedby={describedBy}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

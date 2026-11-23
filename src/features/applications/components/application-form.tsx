"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useRef } from "react";

import { SubmitButton } from "@/components/submit-button";
import { buttonPrimary, buttonSecondary, inputBase } from "@/components/styles";

import {
  type ApplicationField,
  type ApplicationFormState,
  type ApplicationFormValues,
  INITIAL_FORM_STATE,
} from "../form";
import { CURRENCIES, LIMITS } from "../schema";
import { STAGE_LABELS, STAGES } from "../stages";

type ApplicationFormProps = {
  action: (
    state: ApplicationFormState,
    formData: FormData,
  ) => Promise<ApplicationFormState>;
  defaults: ApplicationFormValues;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
};

export function ApplicationForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  cancelHref,
}: ApplicationFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  const values = state.status === "error" ? state.values : defaults;
  const errors = state.status === "error" ? state.fieldErrors : {};

  // After a failed submit, move focus to the first invalid field (or the form error).
  useEffect(() => {
    if (state.status !== "error") return;
    const target = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"], [data-form-error]',
    );
    target?.focus();
  }, [state]);

  const field = (name: ApplicationField) => ({
    id: name,
    name,
    defaultValue: values[name],
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    // noValidate: show our own consistent, accessible messages instead of browser bubbles.
    // The server validates regardless.
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {state.status === "error" && state.formError && (
        <p
          role="alert"
          tabIndex={-1}
          data-form-error
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          {state.formError}
        </p>
      )}

      <p className="text-sm text-slate-700">
        Fields marked <span aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Company" name="company" required errors={errors.company}>
          <input
            {...field("company")}
            type="text"
            required
            maxLength={LIMITS.company}
            autoComplete="organization"
            className={inputBase}
          />
        </Field>

        <Field
          label="Job title"
          name="jobTitle"
          required
          errors={errors.jobTitle}
        >
          <input
            {...field("jobTitle")}
            type="text"
            required
            maxLength={LIMITS.jobTitle}
            autoComplete="organization-title"
            className={inputBase}
          />
        </Field>

        <Field label="Stage" name="stage" errors={errors.stage}>
          <select {...field("stage")} className={inputBase}>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Applied on"
          name="appliedAt"
          required
          errors={errors.appliedAt}
        >
          <input
            {...field("appliedAt")}
            type="date"
            required
            className={inputBase}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field
            label="Job posting URL"
            name="postingUrl"
            errors={errors.postingUrl}
          >
            <input
              {...field("postingUrl")}
              type="url"
              inputMode="url"
              maxLength={LIMITS.postingUrl}
              placeholder="https://"
              className={inputBase}
            />
          </Field>
        </div>
      </div>

      <fieldset className="space-y-4">
        <legend className="font-medium text-slate-900">
          Salary range (yearly, optional)
        </legend>
        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Minimum" name="salaryMin" errors={errors.salaryMin}>
            <input
              {...field("salaryMin")}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className={inputBase}
            />
          </Field>
          <Field label="Maximum" name="salaryMax" errors={errors.salaryMax}>
            <input
              {...field("salaryMax")}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className={inputBase}
            />
          </Field>
          <Field
            label="Currency"
            name="salaryCurrency"
            errors={errors.salaryCurrency}
          >
            <select {...field("salaryCurrency")} className={inputBase}>
              <option value="">Select…</option>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <Field label="Notes" name="notes" errors={errors.notes}>
        <textarea
          {...field("notes")}
          rows={5}
          maxLength={LIMITS.notes}
          className={inputBase}
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel={pendingLabel} className={buttonPrimary}>
          {submitLabel}
        </SubmitButton>
        <Link href={cancelHref} className={buttonSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required = false,
  errors,
  children,
}: {
  label: string;
  name: ApplicationField;
  required?: boolean;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block font-medium text-slate-900">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {errors && errors.length > 0 && (
        <p id={`${name}-error`} className="text-sm text-red-700">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

// Shared between the form (client) and the Server Actions. Kept out of actions.ts because a
// "use server" module may only export async functions.
import type { ApplicationInput } from "./schema";

export const APPLICATION_FIELDS = [
  "company",
  "jobTitle",
  "postingUrl",
  "notes",
  "appliedAt",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "stage",
  "followUpAt",
] as const;

export type ApplicationField = (typeof APPLICATION_FIELDS)[number];
export type ApplicationFormValues = Record<ApplicationField, string>;

export type ApplicationFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors: Partial<Record<ApplicationField, string[]>>;
      formError?: string;
      // Echoed back so the inputs keep what the user typed: React resets a form after its
      // action completes, and the inputs re-render from these as their default values.
      values: ApplicationFormValues;
    };

export const INITIAL_FORM_STATE: ApplicationFormState = { status: "idle" };

/**
 * Reads only the known fields from a submitted form, as strings. Anything else in the
 * FormData (e.g. an injected `userId`) is ignored.
 */
export function readApplicationForm(formData: FormData): ApplicationFormValues {
  return Object.fromEntries(
    APPLICATION_FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === "string" ? value : ""];
    }),
  ) as ApplicationFormValues;
}

/**
 * Maps validated input to database columns. Missing optional values become `null`
 * explicitly: on an update, Prisma treats `undefined` as "leave unchanged", so clearing a
 * field (e.g. removing the URL) would otherwise silently keep the old value.
 */
export function toApplicationData(input: ApplicationInput) {
  return {
    company: input.company,
    jobTitle: input.jobTitle,
    postingUrl: input.postingUrl ?? null,
    notes: input.notes ?? null,
    appliedAt: input.appliedAt,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    salaryCurrency: input.salaryCurrency ?? null,
    stage: input.stage,
    followUpAt: input.followUpAt ?? null,
  };
}

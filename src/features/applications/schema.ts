// Validation for every application input. The server is authoritative: Server Actions parse
// raw input with these schemas; forms may reuse them for hints, but never instead of it.
import { z } from "zod";

import { STAGES } from "./stages";

export const CURRENCIES = ["EUR", "USD", "GBP", "TRY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LIMITS = {
  company: 100,
  jobTitle: 120,
  postingUrl: 2048,
  notes: 5000,
  salary: 10_000_000,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

// HTML forms submit "" for empty optional inputs; treat that as "not provided".
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (label: string, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(max, `${label} must be at most ${max} characters.`)
      .optional(),
  );

// Only http(s) URLs with a real domain: blocks `javascript:` / `data:` URLs, which would
// become stored XSS when rendered as a link.
const postingUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(
      LIMITS.postingUrl,
      `URL must be at most ${LIMITS.postingUrl} characters.`,
    )
    .pipe(
      z.url({
        protocol: /^https?$/,
        hostname: z.regexes.domain,
        error: "Enter a valid URL starting with http:// or https://.",
      }),
    )
    .optional(),
);

const salary = z.preprocess(
  emptyToUndefined,
  z.coerce
    .number({ error: "Enter a whole number." })
    .int("Enter a whole number.")
    .min(0, "Salary can't be negative.")
    .max(
      LIMITS.salary,
      `Salary must be at most ${LIMITS.salary.toLocaleString("en-US")}.`,
    )
    .optional(),
);

// A calendar date ("YYYY-MM-DD", what <input type="date"> submits), stored as UTC midnight.
// One day of tolerance for users ahead of UTC, for whom "today" is already tomorrow in UTC.
const appliedAt = z.iso
  .date({ error: "Enter a valid date." })
  .refine(
    (value) =>
      value <= new Date(Date.now() + DAY_MS).toISOString().slice(0, 10),
    "Applied date can't be in the future.",
  )
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const applicationInputSchema = z
  .object({
    company: requiredText("Company", LIMITS.company),
    jobTitle: requiredText("Job title", LIMITS.jobTitle),
    postingUrl,
    notes: optionalText("Notes", LIMITS.notes),
    appliedAt,
    salaryMin: salary,
    salaryMax: salary,
    salaryCurrency: z.preprocess(
      emptyToUndefined,
      z
        .enum(CURRENCIES, { error: "Choose a currency from the list." })
        .optional(),
    ),
    stage: z
      .enum(STAGES, { error: "Choose a stage from the list." })
      .default("APPLIED"),
  })
  .superRefine((data, ctx) => {
    if (
      data.salaryMin !== undefined &&
      data.salaryMax !== undefined &&
      data.salaryMin > data.salaryMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "Maximum salary must be at least the minimum.",
      });
    }
    const hasSalary =
      data.salaryMin !== undefined || data.salaryMax !== undefined;
    if (hasSalary && data.salaryCurrency === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["salaryCurrency"],
        message: "Choose a currency for the salary.",
      });
    }
  })
  // A currency without any salary carries no information; don't store it.
  .transform((data) =>
    data.salaryMin === undefined && data.salaryMax === undefined
      ? { ...data, salaryCurrency: undefined }
      : data,
  );

export type ApplicationInput = z.output<typeof applicationInputSchema>;

export const applicationIdSchema = z.cuid({ error: "Invalid application id." });

export const moveInputSchema = z.object({
  id: applicationIdSchema,
  toStage: z.enum(STAGES, { error: "Choose a stage from the list." }),
  // Final position in the target column (0 = top). Coerced: the "Move to" form posts strings.
  toIndex: z.coerce.number().int().min(0).max(10_000),
});

export type MoveInput = z.output<typeof moveInputSchema>;

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { applicationInputSchema, moveInputSchema } from "./schema";

const VALID_ID = "cmabc123def456ghi789jkl01";

// What a submitted form looks like: every value is a string, empty inputs are "".
function formInput(overrides: Record<string, unknown> = {}) {
  return {
    company: "Acme",
    jobTitle: "Full-stack Developer",
    postingUrl: "",
    notes: "",
    appliedAt: "2026-11-20",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "",
    stage: "APPLIED",
    ...overrides,
  };
}

function fieldErrors(input: unknown) {
  const result = applicationInputSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? {} : z.flattenError(result.error).fieldErrors;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("applicationInputSchema", () => {
  it("accepts a minimal form and normalizes empty optional fields to undefined", () => {
    const result = applicationInputSchema.parse(formInput());

    expect(result).toEqual({
      company: "Acme",
      jobTitle: "Full-stack Developer",
      postingUrl: undefined,
      notes: undefined,
      appliedAt: new Date("2026-11-20T00:00:00.000Z"),
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined,
      stage: "APPLIED",
    });
  });

  it("trims text and defaults the stage to APPLIED", () => {
    const { stage, ...withoutStage } = formInput({ company: "  Acme  " });
    void stage;
    const result = applicationInputSchema.parse(withoutStage);

    expect(result.company).toBe("Acme");
    expect(result.stage).toBe("APPLIED");
  });

  it("requires company and job title (whitespace only counts as empty)", () => {
    const errors = fieldErrors(
      formInput({ company: "   ", jobTitle: undefined }),
    );

    expect(errors.company).toEqual(["Company is required."]);
    expect(errors.jobTitle).toEqual(["Job title is required."]);
  });

  it("enforces length limits", () => {
    const errors = fieldErrors(
      formInput({ company: "a".repeat(101), notes: "n".repeat(5001) }),
    );

    expect(errors.company).toBeDefined();
    expect(errors.notes).toBeDefined();
  });

  describe("postingUrl", () => {
    it.each([
      "javascript:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "ftp://example.com/job",
      "not a url",
      "https://localhost/job",
    ])("rejects %s", (postingUrl) => {
      expect(fieldErrors(formInput({ postingUrl })).postingUrl).toBeDefined();
    });

    it.each([
      "https://example.com/jobs/123",
      "http://careers.example.co.uk/apply?id=7",
    ])("accepts %s", (postingUrl) => {
      expect(
        applicationInputSchema.parse(formInput({ postingUrl })).postingUrl,
      ).toBe(postingUrl);
    });
  });

  describe("salary", () => {
    it("parses a valid range with currency", () => {
      const result = applicationInputSchema.parse(
        formInput({
          salaryMin: "50000",
          salaryMax: "65000",
          salaryCurrency: "EUR",
        }),
      );

      expect(result).toMatchObject({
        salaryMin: 50000,
        salaryMax: 65000,
        salaryCurrency: "EUR",
      });
    });

    it("accepts a single bound", () => {
      const result = applicationInputSchema.parse(
        formInput({ salaryMin: "50000", salaryCurrency: "USD" }),
      );

      expect(result).toMatchObject({ salaryMin: 50000, salaryMax: undefined });
    });

    it("rejects min greater than max, reported on the max field", () => {
      const errors = fieldErrors(
        formInput({
          salaryMin: "70000",
          salaryMax: "60000",
          salaryCurrency: "EUR",
        }),
      );

      expect(errors.salaryMax).toEqual([
        "Maximum salary must be at least the minimum.",
      ]);
    });

    it("requires a currency when a salary is given", () => {
      const errors = fieldErrors(formInput({ salaryMin: "50000" }));

      expect(errors.salaryCurrency).toEqual([
        "Choose a currency for the salary.",
      ]);
    });

    it("drops a currency that has no salary", () => {
      const result = applicationInputSchema.parse(
        formInput({ salaryCurrency: "EUR" }),
      );

      expect(result.salaryCurrency).toBeUndefined();
    });

    it.each(["abc", "-1", "1000.5", "10000001"])("rejects %s", (salaryMin) => {
      const errors = fieldErrors(
        formInput({ salaryMin, salaryCurrency: "EUR" }),
      );

      expect(errors.salaryMin).toBeDefined();
    });

    it("rejects an unknown currency", () => {
      const errors = fieldErrors(
        formInput({ salaryMin: "1", salaryCurrency: "BTC" }),
      );

      expect(errors.salaryCurrency).toBeDefined();
    });
  });

  describe("appliedAt", () => {
    it("rejects impossible and malformed dates", () => {
      expect(
        fieldErrors(formInput({ appliedAt: "2026-02-30" })).appliedAt,
      ).toBeDefined();
      expect(
        fieldErrors(formInput({ appliedAt: "20.11.2026" })).appliedAt,
      ).toBeDefined();
      expect(fieldErrors(formInput({ appliedAt: "" })).appliedAt).toBeDefined();
    });

    it("allows up to one day ahead (time zones) but not further", () => {
      expect(
        applicationInputSchema.safeParse(formInput({ appliedAt: "2026-11-25" }))
          .success,
      ).toBe(true);
      expect(
        fieldErrors(formInput({ appliedAt: "2026-11-26" })).appliedAt,
      ).toEqual(["Applied date can't be in the future."]);
    });
  });

  it("rejects an unknown stage", () => {
    expect(fieldErrors(formInput({ stage: "HIRED" })).stage).toBeDefined();
  });
});

describe("moveInputSchema", () => {
  it("coerces the index posted by a form", () => {
    expect(
      moveInputSchema.parse({ id: VALID_ID, toStage: "OFFER", toIndex: "2" }),
    ).toEqual({
      id: VALID_ID,
      toStage: "OFFER",
      toIndex: 2,
    });
  });

  it.each([
    { id: "not a cuid!", toStage: "OFFER", toIndex: 0 },
    { id: VALID_ID, toStage: "HIRED", toIndex: 0 },
    { id: VALID_ID, toStage: "OFFER", toIndex: -1 },
    { id: VALID_ID, toStage: "OFFER", toIndex: 1.5 },
  ])("rejects %o", (input) => {
    expect(moveInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("followUpAt", () => {
  it("is optional: empty means no follow-up", () => {
    const result = applicationInputSchema.parse(formInput({ followUpAt: "" }));
    expect(result.followUpAt).toBeUndefined();
  });

  it("accepts past and future calendar dates, stored at UTC midnight", () => {
    for (const day of ["2026-11-01", "2027-03-15"]) {
      expect(
        applicationInputSchema.parse(formInput({ followUpAt: day })).followUpAt,
      ).toEqual(new Date(`${day}T00:00:00.000Z`));
    }
  });

  it("rejects invalid dates and typo years", () => {
    expect(
      fieldErrors(formInput({ followUpAt: "2026-02-30" })).followUpAt,
    ).toBeDefined();
    expect(
      fieldErrors(formInput({ followUpAt: "next week" })).followUpAt,
    ).toBeDefined();
    expect(
      fieldErrors(formInput({ followUpAt: "0202-11-01" })).followUpAt,
    ).toEqual(["Enter a date between 2000 and 2100."]);
  });
});

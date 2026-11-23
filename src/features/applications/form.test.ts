import { describe, expect, it } from "vitest";

import { readApplicationForm, toApplicationData } from "./form";
import { applicationInputSchema } from "./schema";

describe("readApplicationForm", () => {
  it("reads known fields as strings, defaults missing ones to '' and ignores unknown fields", () => {
    const formData = new FormData();
    formData.set("company", "Acme");
    formData.set("userId", "someone-else");
    formData.set("salaryMin", new Blob(["50000"]));

    const values = readApplicationForm(formData);

    expect(values.company).toBe("Acme");
    expect(values.jobTitle).toBe("");
    expect(values.salaryMin).toBe(""); // a file upload is not a string
    expect(values).not.toHaveProperty("userId");
  });
});

describe("toApplicationData", () => {
  it("turns missing optional values into explicit nulls", () => {
    const input = applicationInputSchema.parse({
      company: "Acme",
      jobTitle: "Developer",
      postingUrl: "",
      notes: "",
      appliedAt: "2026-01-15",
      salaryMin: "",
      salaryMax: "",
      salaryCurrency: "",
      stage: "OFFER",
    });

    expect(toApplicationData(input)).toEqual({
      company: "Acme",
      jobTitle: "Developer",
      postingUrl: null,
      notes: null,
      appliedAt: new Date("2026-01-15T00:00:00.000Z"),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      stage: "OFFER",
    });
  });
});

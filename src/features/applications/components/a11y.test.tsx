// @vitest-environment jsdom
//
// Automated accessibility checks: render the real components to HTML (as the server would)
// and scan them with axe-core against WCAG 2.x A/AA rules.
// Limits: jsdom has no layout or CSS, so color contrast is not checked here (see PLAN.md for
// the contrast table), and nothing replaces a manual keyboard / screen-reader pass.
import axe from "axe-core";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Server Actions can't run in a test renderer; the markup only needs function references.
vi.mock("../actions", () => ({
  moveApplication: vi.fn(),
  moveApplicationFromForm: vi.fn(),
}));
vi.mock("@/features/demo/actions", () => ({ startDemo: vi.fn() }));
// next/link needs the App Router context; a plain anchor renders the same markup.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { Board } = await import("./board");
const { EmptyBoard } = await import("./empty-board");
const { ApplicationForm } = await import("./application-form");
const { DeleteApplication } = await import("./delete-application");
const { InsightsPanel } = await import("./insights-panel");
const { StageHistory } = await import("./stage-history");
const { TryDemoButton } =
  await import("@/features/demo/components/try-demo-button");
const { groupByStage } = await import("../ranking");
const { stageEnteredAt } = await import("../history");
const { buildSampleApplications } = await import("@/features/demo/sample-data");

async function violations(ui: ReactNode) {
  // A <main> landmark, as on the real pages.
  document.body.innerHTML = `<main>${renderToString(ui)}</main>`;
  const result = await axe.run(document.body, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`,
  );
}

const sampleColumns = groupByStage(
  buildSampleApplications(new Date("2026-11-24T00:00:00Z")).map(
    ({ history, ...app }, i) => ({
      ...app,
      id: `cmsample${String(i).padStart(17, "0")}`,
      createdAt: new Date("2026-11-24T00:00:00Z"),
      stageEnteredAt: stageEnteredAt(app.stage, history),
    }),
  ),
);

describe("accessibility (axe, WCAG 2.2 A/AA)", () => {
  it("board with summary, columns, cards, drag handles and Move to forms", async () => {
    const insights = (
      <InsightsPanel
        insights={{
          tracked: 8,
          interviewRate: { reached: 3, of: 8, percent: 38 },
          averageDaysToResponse: { days: 6.8, responses: 5 },
        }}
      />
    );
    expect(
      await violations(
        <Board
          columns={sampleColumns}
          today="2026-11-24"
          insights={insights}
        />,
      ),
    ).toEqual([]);
  });

  it("board with empty columns", async () => {
    const columns = groupByStage(
      [sampleColumns.APPLIED[0]].filter((card) => card !== undefined),
    );
    expect(
      await violations(<Board columns={columns} today="2026-11-24" />),
    ).toEqual([]);
  });

  it("empty board", async () => {
    expect(await violations(<EmptyBoard />)).toEqual([]);
  });

  it("application form", async () => {
    const html = (
      <ApplicationForm
        action={vi.fn()}
        defaults={{
          company: "",
          jobTitle: "",
          postingUrl: "",
          notes: "",
          appliedAt: "2026-11-24",
          salaryMin: "",
          salaryMax: "",
          salaryCurrency: "",
          stage: "APPLIED",
          followUpAt: "",
        }}
        submitLabel="Save application"
        pendingLabel="Saving…"
        cancelHref="/board"
      />
    );
    expect(await violations(html)).toEqual([]);
  });

  it("insights empty state", async () => {
    expect(
      await violations(
        <InsightsPanel
          insights={{
            tracked: 1,
            interviewRate: null,
            averageDaysToResponse: null,
          }}
        />,
      ),
    ).toEqual([]);
  });

  it("stage history, with and without events", async () => {
    expect(
      await violations(
        <StageHistory
          events={[
            {
              id: "e1",
              fromStage: null,
              toStage: "APPLIED",
              at: new Date("2026-11-01T10:00:00Z"),
            },
            {
              id: "e2",
              fromStage: "APPLIED",
              toStage: "INTERVIEW",
              at: new Date("2026-11-05T10:00:00Z"),
            },
          ]}
        />,
      ),
    ).toEqual([]);
    expect(await violations(<StageHistory events={[]} />)).toEqual([]);
  });

  it("try demo button", async () => {
    expect(await violations(<TryDemoButton />)).toEqual([]);
  });

  it("delete confirmation", async () => {
    expect(
      await violations(<DeleteApplication company="Acme" action={vi.fn()} />),
    ).toEqual([]);
  });
});

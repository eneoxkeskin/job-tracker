import { describe, expect, it } from "vitest";

import {
  cancelledText,
  describePosition,
  droppedText,
  movedText,
  pickedUpText,
} from "./dnd-announcements";
import type { Columns } from "./ranking";

type Card = { id: string; company: string };

const columns: Columns<Card> = {
  APPLIED: [
    { id: "a", company: "Acme" },
    { id: "b", company: "Globex" },
  ],
  INTERVIEW: [{ id: "i", company: "Initech" }],
  OFFER: [],
  REJECTED: [],
};

describe("drag and drop announcements", () => {
  it("describe stage and 1-based position, never raw ids", () => {
    expect(describePosition(columns, "b")).toBe("Applied, position 2 of 2");
    expect(pickedUpText(columns, "a")).toBe(
      "Picked up Acme. Applied, position 1 of 2.",
    );
    expect(droppedText(columns, "i")).toBe(
      "Dropped Initech. Interview, position 1 of 1.",
    );
    expect(cancelledText(columns, "b")).toBe(
      "Move cancelled. Globex returned to Applied, position 2 of 2.",
    );
  });

  it("explain when the card is not over any column", () => {
    expect(movedText(columns, "a", null)).toBe(
      "Acme is no longer over a column.",
    );
    expect(movedText(columns, "a", "OFFER")).toBe(
      "Acme moved. Applied, position 1 of 2.",
    );
  });
});

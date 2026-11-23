// Screen-reader texts for drag and drop. dnd-kit's defaults only say "Draggable item <id>",
// which would read out database ids; these use company names, stage names and positions.
import { type Columns, locateCard, resolveStage } from "./ranking";
import { STAGE_LABELS } from "./stages";

type Named = { id: string; company: string };

export const DND_INSTRUCTIONS =
  "To move an application, focus its drag handle and press Space or Enter to pick it up. " +
  "Use the arrow keys to move it up and down, or to another column. " +
  "Press Space or Enter to drop it, or Escape to cancel.";

/** "Interview, position 2 of 3" */
export function describePosition<T extends Named>(
  columns: Columns<T>,
  id: string,
): string {
  const location = locateCard(columns, id);
  if (!location) return "";
  const total = columns[location.stage].length;
  return `${STAGE_LABELS[location.stage]}, position ${location.index + 1} of ${total}`;
}

function companyOf<T extends Named>(columns: Columns<T>, id: string): string {
  const location = locateCard(columns, id);
  return location
    ? (columns[location.stage][location.index]?.company ?? "Application")
    : "Application";
}

export function pickedUpText<T extends Named>(
  columns: Columns<T>,
  id: string,
): string {
  return `Picked up ${companyOf(columns, id)}. ${describePosition(columns, id)}.`;
}

export function movedText<T extends Named>(
  columns: Columns<T>,
  id: string,
  overId: string | null,
): string {
  if (!overId || !resolveStage(columns, overId)) {
    return `${companyOf(columns, id)} is no longer over a column.`;
  }
  return `${companyOf(columns, id)} moved. ${describePosition(columns, id)}.`;
}

export function droppedText<T extends Named>(
  columns: Columns<T>,
  id: string,
): string {
  return `Dropped ${companyOf(columns, id)}. ${describePosition(columns, id)}.`;
}

export function cancelledText<T extends Named>(
  columns: Columns<T>,
  id: string,
): string {
  return `Move cancelled. ${companyOf(columns, id)} returned to ${describePosition(columns, id)}.`;
}

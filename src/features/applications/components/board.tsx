"use client";

import {
  type Announcements,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useOptimistic, useRef, useState, useTransition } from "react";

import { focusRing } from "@/components/styles";

import { moveApplication } from "../actions";
import {
  cancelledText,
  DND_INSTRUCTIONS,
  droppedText,
  movedText,
  pickedUpText,
} from "../dnd-announcements";
import type { ApplicationListItem } from "../queries";
import { type Columns, locateCard, moveCard, resolveStage } from "../ranking";
import type { MoveInput } from "../schema";
import { STAGE_LABELS, STAGES, type StageId } from "../stages";
import { ApplicationCard } from "./application-card";

type Card = ApplicationListItem;
type BoardColumns = Columns<Card>;

// Stage accent. Never the only signal: every column also has its text heading.
const STAGE_ACCENT: Record<StageId, string> = {
  APPLIED: "border-t-blue-600",
  INTERVIEW: "border-t-amber-500",
  OFFER: "border-t-green-600",
  REJECTED: "border-t-slate-500",
};

const MOVE_FAILED =
  "Couldn't move the application. Check your connection and try again.";

type BoardProps = {
  columns: BoardColumns;
};

/**
 * Kanban board with drag and drop (mouse, touch and keyboard via dnd-kit).
 *
 * State, from most to least authoritative:
 * - `columns`: server data (re-sent after every successful action via revalidatePath)
 * - `optimisticColumns`: server data + moves still in flight (useOptimistic). If a move fails,
 *   React drops it when the transition ends, so the card snaps back by itself.
 * - `dragColumns`: the preview while a drag is in progress (cards shift between columns).
 */
export function Board({ columns }: BoardProps) {
  const [optimisticColumns, applyMove] = useOptimistic(
    columns,
    (state, move: MoveInput) =>
      moveCard(state, move.id, move.toStage, move.toIndex),
  );
  const [dragColumns, setDragColumns] = useState<BoardColumns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Latest columns during a drag, readable synchronously from event handlers and from the
  // screen-reader announcements (which fire before React re-renders).
  const liveColumns = useRef<BoardColumns>(columns);

  const shown = dragColumns ?? optimisticColumns;
  const activeLocation = activeId ? locateCard(shown, activeId) : null;
  const activeCard = activeLocation
    ? shown[activeLocation.stage][activeLocation.index]
    : null;

  const sensors = useSensors(
    // Small distance so a click on the handle doesn't start a drag by accident.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function preview(next: BoardColumns) {
    liveColumns.current = next;
    setDragColumns(next);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setError(null);
    setActiveId(String(active.id));
    preview(optimisticColumns);
  }

  // Crossing into another column: move the card there in the preview.
  // (Reordering inside the same column is animated by dnd-kit and applied on drop.)
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const current = liveColumns.current;
    const id = String(active.id);
    const overId = String(over.id);
    const fromStage = resolveStage(current, id);
    const toStage = resolveStage(current, overId);
    if (!fromStage || !toStage || fromStage === toStage) return;

    const target = current[toStage];
    const overIndex = target.findIndex((card) => card.id === overId);
    const translated = active.rect.current.translated;
    const belowOver =
      translated !== null &&
      translated.top > over.rect.top + over.rect.height / 2;
    const toIndex =
      overIndex === -1 ? target.length : overIndex + (belowOver ? 1 : 0);
    preview(moveCard(current, id, toStage, toIndex));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const id = String(active.id);
    const origin = locateCard(optimisticColumns, id);
    let final = over ? liveColumns.current : optimisticColumns; // dropped outside = cancel

    if (over) {
      const stage = resolveStage(final, id);
      const overId = String(over.id);
      if (stage && stage === resolveStage(final, overId)) {
        const cards = final[stage];
        const from = cards.findIndex((card) => card.id === id);
        const to =
          overId === stage
            ? cards.length - 1
            : cards.findIndex((card) => card.id === overId);
        if (to !== -1 && to !== from) final = moveCard(final, id, stage, to);
      }
    }

    liveColumns.current = final;
    setDragColumns(null);
    setActiveId(null);

    const target = locateCard(final, id);
    if (
      !origin ||
      !target ||
      (origin.stage === target.stage && origin.index === target.index)
    ) {
      return;
    }

    const move: MoveInput = {
      id,
      toStage: target.stage,
      toIndex: target.index,
    };
    startTransition(async () => {
      applyMove(move);
      try {
        const result = await moveApplication(move);
        if (!result.ok) setError(result.error);
      } catch {
        setError(MOVE_FAILED);
      }
    });
  }

  function handleDragCancel() {
    liveColumns.current = optimisticColumns;
    setDragColumns(null);
    setActiveId(null);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      pickedUpText(liveColumns.current, String(active.id)),
    onDragOver: ({ active, over }) =>
      movedText(
        liveColumns.current,
        String(active.id),
        over ? String(over.id) : null,
      ),
    onDragEnd: ({ active }) =>
      droppedText(liveColumns.current, String(active.id)),
    onDragCancel: ({ active }) =>
      cancelledText(liveColumns.current, String(active.id)),
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-800"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className={`min-h-11 rounded-md px-3 font-medium underline ${focusRing}`}
          >
            Dismiss
          </button>
        </div>
      )}
      <DndContext
        // Stable id: dnd-kit derives aria-describedby ids from it (avoids hydration mismatches).
        id="board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: DND_INSTRUCTIONS },
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Phones: columns scroll horizontally with snapping. Desktop: four-column grid. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {STAGES.map((stage) => (
            <BoardColumn key={stage} stage={stage} cards={shown[stage]} />
          ))}
        </div>
        {/* What follows the pointer. Decorative: the original card keeps its place in the
            accessibility tree, and the announcements describe the move. */}
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <div
              aria-hidden="true"
              className="rotate-1 cursor-grabbing rounded-lg border border-slate-400 bg-white p-3 shadow-lg"
            >
              <p className="font-semibold text-slate-900">
                {activeCard.company}
              </p>
              <p className="text-slate-800">{activeCard.jobTitle}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function BoardColumn({ stage, cards }: { stage: StageId; cards: Card[] }) {
  // The column itself is a drop target, so empty columns accept cards too.
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      aria-labelledby={`column-${stage}`}
      className={`flex w-[85%] shrink-0 snap-start flex-col rounded-lg border border-t-4 border-slate-200 bg-slate-100 sm:w-[45%] md:w-auto ${STAGE_ACCENT[stage]}`}
    >
      <h2
        id={`column-${stage}`}
        className="flex items-center justify-between px-3 pt-3 pb-2 font-semibold text-slate-900"
      >
        {STAGE_LABELS[stage]}
        <span className="rounded-full bg-white px-2 py-0.5 text-sm font-medium text-slate-700">
          {cards.length}
          <span className="sr-only"> applications</span>
        </span>
      </h2>
      <SortableContext
        items={cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={`mx-3 mb-3 min-h-24 flex-1 rounded-md ${isOver ? "bg-slate-200" : ""}`}
        >
          {cards.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-400 px-3 py-6 text-center text-sm text-slate-700">
              No applications in this stage.
            </p>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <SortableCard key={card.id} application={card} />
              ))}
            </ul>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ application }: { application: Card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  return (
    <li
      ref={setNodeRef}
      data-sortable
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
    >
      <ApplicationCard
        application={application}
        dragHandle={
          // Drag starts only from this handle, so links, the "Move to" form and page
          // scrolling on touch devices keep working everywhere else on the card.
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className={`-mt-1 -mr-1 inline-flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:cursor-grabbing ${focusRing}`}
          >
            <GripIcon />
            <span className="sr-only">Drag {application.company}</span>
          </button>
        }
      />
    </li>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-5"
    >
      {[5, 10, 15].flatMap((y) =>
        [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} />),
      )}
    </svg>
  );
}

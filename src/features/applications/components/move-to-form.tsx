"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { focusRing } from "@/components/styles";

import { moveApplicationFromForm } from "../actions";
import { canMoveTo, moveOptions, type StageId } from "../stages";

type MoveToFormProps = {
  id: string;
  company: string;
  stage: StageId;
};

/**
 * Accessible alternative to drag and drop: a plain form, so it works with keyboard, touch,
 * screen readers and even without JavaScript. Opens on the card's current stage; "Move" is
 * enabled once a different stage is chosen, and moves the card to the top of that stage.
 */
export function MoveToForm({ id, company, stage }: MoveToFormProps) {
  const [target, setTarget] = useState<string>(stage);
  const selectId = `move-${id}`;
  const hintId = `move-hint-${id}`;
  const enabled = canMoveTo(target, stage);

  return (
    <form
      action={moveApplicationFromForm}
      className="flex items-center gap-2 border-t border-slate-200 pt-2"
    >
      <input type="hidden" name="id" value={id} />
      {/* Lets the server treat "move to the current stage" as a no-op (no-JS submits). */}
      <input type="hidden" name="currentStage" value={stage} />
      <label htmlFor={selectId} className="text-sm text-slate-700">
        Move to<span className="sr-only"> (for {company})</span>
      </label>
      <select
        id={selectId}
        name="toStage"
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        className={`min-h-11 min-w-0 flex-1 rounded-md border border-slate-500 bg-white px-2 text-sm text-slate-900 ${focusRing}`}
      >
        {moveOptions(stage).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <SubmitButton
        pendingLabel="Moving…"
        disabled={!enabled}
        aria-describedby={enabled ? undefined : hintId}
        className={`min-h-11 rounded-md border border-slate-500 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-white ${focusRing}`}
      >
        Move<span className="sr-only"> {company}</span>
      </SubmitButton>
      <span id={hintId} className="sr-only">
        Choose a different stage to enable moving.
      </span>
    </form>
  );
}

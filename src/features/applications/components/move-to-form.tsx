import { SubmitButton } from "@/components/submit-button";
import { focusRing } from "@/components/styles";

import { moveApplicationFromForm } from "../actions";
import { STAGE_LABELS, STAGES, type StageId } from "../stages";

type MoveToFormProps = {
  id: string;
  company: string;
  stage: StageId;
};

/**
 * Accessible alternative to drag and drop: a plain form, so it works with keyboard, touch,
 * screen readers and even without JavaScript. Moves the card to the top of the chosen stage.
 */
export function MoveToForm({ id, company, stage }: MoveToFormProps) {
  const targets = STAGES.filter((s) => s !== stage);
  const selectId = `move-${id}`;

  return (
    <form
      action={moveApplicationFromForm}
      className="flex items-center gap-2 border-t border-slate-200 pt-2"
    >
      <input type="hidden" name="id" value={id} />
      <label htmlFor={selectId} className="text-sm text-slate-700">
        Move to<span className="sr-only"> (for {company})</span>
      </label>
      <select
        id={selectId}
        name="toStage"
        defaultValue={targets[0]}
        className={`min-h-11 min-w-0 flex-1 rounded-md border border-slate-500 bg-white px-2 text-sm text-slate-900 ${focusRing}`}
      >
        {targets.map((target) => (
          <option key={target} value={target}>
            {STAGE_LABELS[target]}
          </option>
        ))}
      </select>
      <SubmitButton
        pendingLabel="Moving…"
        className={`min-h-11 rounded-md border border-slate-500 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-70 ${focusRing}`}
      >
        Move<span className="sr-only"> {company}</span>
      </SubmitButton>
    </form>
  );
}

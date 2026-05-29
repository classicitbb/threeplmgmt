
## Goal
Make the Pick Execution screen (`/pick-lists/:pickListId`) behave as a real handheld pick workflow: confirm each task, get strong feedback, collapse it, focus the next one, and finish the list with a Mark complete action when every task is done.

## Scope
Single file: `src/App.tsx` — `PickExecutionPage` and `PickTaskCard`. No schema, no backend, no other UI.

## Changes

### 1. Per-task collapse + visual state
- After `confirmPickTask` succeeds (or task already arrives with status `completed`/`exception`/`cancelled`), render the card as a read-only summary: task #, product, location, pallet, confirmed qty, short reason (if any), green left border + muted background for completed, amber for exception, neutral for cancelled. Inputs, keypad, and Confirm button are removed.
- Editable form only renders when status is `queued`/`assigned`/`in_progress`.

### 2. Feedback on success
- On confirm success: `navigator.vibrate?.([60, 40, 120])`, play existing `playBarcodeBeep()` plus a second higher tone (reuse the same oscillator helper inline), and flash the card border green for ~600ms.
- Confirm button gets `disabled` while `mutation.isPending` and stays effectively gone after success (card collapses).

### 3. Short-pick guard
- Client-side: if `Number(quantity) < task.requested_quantity` and `shortReason` is empty, block submit, flash the short-reason input red (reuse `flashInput` with a new `"red"` variant or local inline animation), focus it, and toast "Enter a reason for short pick."
- If `quantity > requested`, block with toast "Confirmed qty cannot exceed requested qty."
- If `quantity === requested`, short reason is ignored.

### 4. Numeric keypad for confirmed qty
- Add a small button beside the qty input (calculator icon) that opens a popover with a 0-9 / ⌫ / Clear / Done grid. Tapping digits builds the value in `form.setValue("quantity", …)`. Done closes the popover and focuses Confirm.
- Input also keeps `type="number" inputMode="numeric"` for keyboards that have it.

### 5. Auto-focus next task
- `PickExecutionPage` holds refs keyed by `task.id` to each card's location input. After successful confirm it finds the next task whose status is still open and calls `.focus()` on its location input (and scrolls it into view).

### 6. Mark complete button
- Below the task list, show a primary "Mark pick list complete" button.
- Enabled only when every task status is in `["completed", "exception", "cancelled"]` and the pick list status is not already `completed`/`cancelled`.
- Clicking it calls a new lightweight helper in the page (inline) that does `supabase.from("pick_lists").update({ status: "completed" }).eq("id", pickListId)`, then toast "Pick list complete — handed to dispatch", invalidates the query, and navigates back to `/pick-lists`.
- Helper text under the button: "Marking complete means pallets have been delivered to the dispatch/staging area and are handed off to the ERP."

## Out of scope
- No DB migrations, no changes to `confirmPickTask` or `wms-core.ts`.
- No changes to pick list creation, list page, or other screens.
- No changes to design tokens; use existing semantic tokens (`bg-muted`, `border-primary`, `text-destructive`, etc.).

## Technical notes
- Status check uses `task.status`. Completed tasks already come back from `getPickExecution`; the collapsed summary path renders for them on first load too, so reopening a partially-picked list looks correct.
- `flashInput` currently supports only `"orange"`/`"blue"`. Extend it with `"red"` and `"green"` (small additive edit, same shape) so we can reuse it for short-pick warning and success flash.
- Vibration and the extra tone are wrapped in `try/catch` and feature-detected so desktop browsers stay silent on tone failure.

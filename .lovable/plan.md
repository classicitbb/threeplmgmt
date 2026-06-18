# Location Wizard from Warehouse Tree — fix, verify, and extend

The previous turn's edits to `LocationWizardDialog` and the zone ⋯ menu were not actually persisted. The current code still navigates to `/locations` from "Add Locations", the wizard has no controlled-open / prefill / letter-substitute support, and there is no edit-range flow. This plan implements all five asks in one pass.

## 1. Make `LocationWizardDialog` controllable and prefilled

In `src/features/shared/ui-shared.tsx`:

- Extend props: `open?`, `onOpenChange?`, `defaultWarehouseId?`, `defaultZoneId?`, `trigger?: React.ReactNode | null`.
- Internal state falls back to uncontrolled when `open` is undefined; when `trigger === null`, render no `DialogTrigger`.
- When the dialog transitions to open, reset the form with the supplied defaults (warehouse + zone) so re-opening from a different zone re-prefills correctly.
- Drop the unconditional `setValue("zone_id","")` effect on warehouse change so the prefilled zone is not wiped. Only clear when the user actually changes the warehouse via the select.

## 2. Add "Substitute level numbers for letters" toggle

Matches the screenshot.

- Add field `level_style: "numeric" | "letters"` to `locationWizardSchema` (default `numeric`).
- Render a Switch row above Type/Temperature with the copy from the screenshot.
- Extend `expandLocationRange` in `src/features/setup/setup-core.ts` (or wherever it lives) with an optional `levelStyle` arg. When `letters`, level segment becomes `A,B,C…` instead of `L01,L02…` (e.g. `A-01-B-P1`). Update the rack code builder/normalizer or store the rendered code directly in `localCode` so DB inserts keep the letter form.
- Add a unit test in `src/test/wms-core.test.ts` covering `levelStyle: "letters"` output and that `positions_per_level=1` omits `-P1` only if existing behavior does — otherwise keep `-P1` so codes stay unique.

## 3. Wire the wizard into the zone ⋯ menu

In `src/components/warehouse-tree-view.tsx`:

- Add `setDialog` variant `{ type: "wizard-zone"; warehouseId: string; zoneId: string }` (and `{ type: "edit-range"; ... }` per §4).
- Replace the `navigate("/locations")` item with `setDialog({ type: "wizard-zone", warehouseId: zone.warehouse_id, zoneId: zone.id })`.
- At the dialog-render block, mount `<LocationWizardDialog open trigger={null} defaultWarehouseId=… defaultZoneId=… onOpenChange={(o) => !o && setDialog(null)} />`.
- Verify for multiple zones by switching zones in the tree and re-opening; the prefill must reflect the latest zone (covered by §1 reset-on-open).

## 4. Edit-range flow from the zone menu

New menu item "Edit Location Range" in the same zone ⋯ menu.

- Opens an `EditLocationRangeDialog` that:
  - Lets the user pick a rack prefix (auto-discovered from existing locations in the zone) and applies bulk updates: `location_type`, `temperature_class`, `mixed_sku_allowed`, `mixed_lot_allowed`, `depth/max_pallets`, `status`.
  - Optionally re-codes levels between numeric ↔ letters using the same `level_style` toggle; renames affected `code` values via `upsertRecord("locations", …)` keyed by id.
  - Shows the count of affected rows before applying, and a final confirm.
- Per-location editing already exists via the pencil action; we are intentionally adding a *range* editor here, not duplicating that.

## 5. Toast confirmation and submission fix

- The mutation already toasts `${count} locations created`. Verify by running the wizard end-to-end (see §7). If `upsertRecord` silently de-duplicates on conflict, switch to a single `supabase.from("locations").insert(rows)` batch and toast the actual inserted count returned by Supabase. Surface server errors verbatim through `toast.error`.
- After success, also invalidate `["warehouse-tree"]` (and any zone-scoped location queries) so the new locations appear in the tree without a hard refresh.

## 6. Accessibility for menu + dialog

- `DropdownMenuTrigger` button gets `aria-label="Zone actions — {zone.code}"`; same pattern for warehouse and location ⋯ buttons.
- `DialogContent` already provides focus trap + Esc via Radix. Confirm `DialogTitle` and `DialogDescription` are wired (they are) so screen readers announce the dialog. Add `aria-describedby` is auto from Radix when `DialogDescription` is present — keep it.
- Each form field uses shadcn `FormLabel`/`FormControl`, which sets `htmlFor`/`id` automatically. Audit the Switch rows (Mixed SKU, Mixed lot, Substitute letters) to ensure the label `<span>` is associated via `<label>` wrapping or `aria-labelledby` on the Switch.
- Wizard submit button gets `aria-busy={mutation.isPending}`.

## 7. Verification

- `bunx vitest run src/test/wms-core.test.ts` for the letter-style expansion test.
- Manually (via Playwright in build mode): open the warehouse tree, open zone ⋯ → Add Locations on two different zones, confirm prefill, toggle letter substitution, submit, observe toast with non-zero count, expand the zone in the tree, see the new locations.
- `bunx tsc --noEmit`.

## Files touched

- `src/features/shared/ui-shared.tsx` — wizard props, prefill, letter toggle, toast/invalidation.
- `src/features/setup/setup-core.ts` (or `src/lib/wms-core.ts` re-export site) — `expandLocationRange` letter mode.
- `src/components/warehouse-tree-view.tsx` — zone menu wiring, edit-range dialog, aria-labels.
- `src/test/wms-core.test.ts` — letter-style test.
- New: `EditLocationRangeDialog` component (kept inside `warehouse-tree-view.tsx` to stay scoped per AGENTS.md "segment by page").

## Out of scope

- No visual redesign of the wizard or tree.
- No backend schema changes; letter-form codes are stored as plain `code` strings (existing column).

## Goal

Make the location creation model match the physical rack: every bay-level is split into 1–3 side-by-side **positions**, and each position is its own location/bin. Depth (1–5) is the per-position pallet capacity, not a separate set of locations.

Formula: `locations per bay = positions_per_level × levels`, each with `max_pallets = depth`.

## Code format

New segment appended: `WH-ZONE-A-01-L02-P1` (P1…P3). Existing helpers (`composeLocationCode`, label/QR pages) already pass `localCode` through, so adding `-P{n}` at the leaf is enough — no upstream parser changes.

## Changes

### 1. `src/components/wms-ui.tsx` — `LocationWizardDialog`
- Replace the current schema fields with:
  - `prefix` (aisle, unchanged)
  - `start_bay`, `end_bay` (unchanged)
  - `positions_per_level` (1–3, **new**)
  - `levels` (1–6, tightened from 1–20)
  - `depth` (1–5, now used as capacity)
  - Drop the standalone `max_pallets` input — it is derived from `depth`.
- Rewrite the generation loop:
  ```text
  for bay in start..end:
    for level in 1..levels:
      for pos in 1..positions_per_level:
        code = `${prefix}-${bay}-L${level}-P${pos}`
        max_pallets = depth
  ```
- Update the live count: `bays × levels × positions_per_level`.
- Persist `depth` as the column value (capacity per slot) and keep `level`, `bay`, `aisle` as today; add a new `position` value into `depth`-style addressing — store position in the existing `depth` column? No — see schema note below.

### 2. Schema — add `position` to `locations`
- New migration: `ALTER TABLE public.locations ADD COLUMN position smallint;` (nullable, default null) + index on `(warehouse_id, aisle, bay, level, position)`.
- `depth` column keeps its current meaning (pallet positions deep = capacity dimension); `max_pallets` stores the actual capacity number (= depth value chosen in the wizard) so existing capacity/occupancy code keeps working unchanged.
- No backfill needed — user is wiping & recreating via the wizard.

### 3. `src/lib/wms-core.ts` — `WarehouseLocationTemplate`
- Add `positionsPerLevel: number` (default 1) and tighten `levels` (1–6), `maxPallets` is removed from the template (derived from `depth`).
- Update `createBlankLocationTemplate()` and `createDefaultWarehouseSetupPayload()` accordingly.
- Update the inferred-template builder (`groups` / `_levels` block, ~line 1126) to count `_positions` too and back-compute `positionsPerLevel`.

### 4. `src/pages/SetupWizardPage.tsx`
- Add a **Positions / level** numeric input (1–3) next to Levels.
- Drop the **Max pallets** input; show a derived **Capacity per slot = depth** read-only.
- Update totals: `aisleCount × baysPerAisle × levels × positionsPerLevel`.
- Update column header copy ("Each row generates aisles × bays × levels × positions locations").

### 5. Reset All copy
- Add a one-line note in the Reset All confirmation that location codes will be regenerated under the new positional scheme so the user understands re-running the wizard is the intended next step.

### 6. Tests
- Update `src/test/wms-core.test.ts` blank-template expectations to include `positionsPerLevel: 0` and remove `maxPallets`.
- Add a small unit test for the new wizard count math (extract the loop into a tiny pure helper in `wms-core.ts` to make it testable, e.g. `expandLocationRange(values)` returning the array of `{aisle,bay,level,position,max_pallets,code}`).

### 7. Out of scope (flag for follow-up)
- Bay-scan UX: "driver scans bay code → sees the front grid of that bay with availability" is a new Putaway/Inventory screen. Not part of this change — log as a separate task once the data shape lands.
- Label sheet templates: they already render whatever `code` is passed, so `-P1` shows up automatically; no template change needed.

## Risk / impact
- `locations.position` is additive and nullable — no breakage for existing queries.
- Code changes are concentrated in the wizard, the setup wizard, and the `wms-core` template helpers. Putaway, inventory, picking, labels read `locations.code` / `max_pallets` and stay untouched.

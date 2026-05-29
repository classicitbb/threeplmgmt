## Goal

Audit and rework the Setup Wizard so it never seeds forms or invents zones/locations for a brand-new tenant. Forms must open empty and let the user type freely. Prefilled rows are only allowed when the wizard is being used to extend an already-configured environment.

## Current behavior (audit findings)

- `createDefaultWarehouseSetupPayload()` (`src/lib/wms-core.ts:965`) hard-codes 3 warehouses (`MAIN`, `PORT`, `WLD`), 13 zones (`STG`/`DSP`/`QTN`/`AMB` per warehouse + `COOL`), and 16 location templates with aisles/bays/levels/maxPallets/temperature pre-filled.
- `SetupWizardPage.tsx` initializes state from that default, so every "fresh" wizard run lands on Barbados warehouses and 4 suggested zones per facility.
- "Add warehouse / Add zone / Add location template" buttons also inject made-up defaults ("New Warehouse", "Bridgetown", "New Zone", `STG`, aisleCount 1, etc.) instead of blank rows.
- Step 4 always calls `runWarehouseSetup(payload)` with default `seedMode = "starter_ops"`, which on the backend (`run_warehouse_setup`) inserts demo clients, products, pallets, receipts, putaway tasks, transfers, and cycle counts. UI copy ("seed starter operational data so receiving, putaway, picking… can be tested immediately") promises this.
- `wms-core.test.ts` asserts the 3-warehouse default and must be updated.

## Plan

### 1. `src/lib/wms-core.ts`

- Replace `createDefaultWarehouseSetupPayload()` with a true blank payload: `{ warehouses: [], zones: [], locationTemplates: [] }`.
- Add a new helper `createBlankWarehouse() / createBlankZone(warehouseCode) / createBlankLocationTemplate(warehouseCode, zoneCode)` returning all-empty strings and zero counts (`aisleCount: 0`, `baysPerAisle: 0`, `levels: 0`, `maxPallets: 0`, `temperatureClass: "ambient"`, status `"active"`, toggles false). These are used by the "Add" buttons.
- Add `loadExistingSetupPayload()` that reads current `warehouses`, `zones`, and a derived location-template summary (group by warehouse+zone+location_type) from Supabase so the wizard can hydrate when extending an existing environment.
- Change `runWarehouseSetup` default `seedMode` to `"structure_only"` so the wizard does not seed demo operational data unless explicitly asked.

### 2. `src/pages/SetupWizardPage.tsx`

- On mount, query existing warehouses. 
  - **Empty tenant (no warehouses):** start with the new blank payload. Show a banner: "Starting from scratch — add your first warehouse." All three steps render empty lists with only the "Add …" buttons.
  - **Existing tenant:** call `loadExistingSetupPayload()` and prefill warehouses/zones/templates as read-only-by-default rows tagged `existing: true` for review/edit, plus a clear "Add new warehouse / zone / location rule" affordance for the new structure being layered in.
- Update "Add warehouse / zone / location template" handlers to push blank rows from the new helpers (no Barbados, no `STG`, no aisle defaults).
- Replace Step 4 copy: remove "seed starter operational data" language; describe only structure creation. Add a separate, clearly-labeled secondary action "Also load demo operational data" (only visible to developer role) that passes `seedMode: "starter_ops"` — default action stays structure-only.
- Keep the existing accordion help, totals, and review tables; they continue to work against whatever the user actually entered.

### 3. Tests & docs

- Update `src/test/wms-core.test.ts` `createDefaultWarehouseSetupPayload` block to assert the payload is empty and that `createBlankWarehouse()` returns blank strings / zeros.
- Update `src/lib/help-content.ts` and the inline help text in `src/components/wms-ui.tsx:6325` to drop the "seed starter operational data" promise from the wizard description, and add a line noting demo data is opt-in for developers only.
- Add a Change-log entry in `AGENTS.md` under section 5: user-approved change that the Setup Wizard starts blank and only prefills when extending an existing warehouse environment.

### 4. Out of scope

- Backend `run_warehouse_setup` SQL stays as-is; we just stop calling it with `starter_ops` by default. No new migration required.
- No changes to Reset All, role gating, or cascade-delete flows.

## Files touched

- `src/lib/wms-core.ts`
- `src/pages/SetupWizardPage.tsx`
- `src/lib/help-content.ts`
- `src/components/wms-ui.tsx` (one help paragraph)
- `src/test/wms-core.test.ts`
- `AGENTS.md` (change log entry)

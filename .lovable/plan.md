## Goal

Make Transfers behave correctly:

1. The pallet picker only lists pallets that are actually transferable from the chosen source warehouse.
2. Creating a transfer immediately debits source-warehouse inventory (not only on dispatch).
3. A transferred pallet no longer appears in the source warehouse's inventory.

## Current behavior (verified)

- `TransfersPage` pallet dropdown is populated from `fetchOptions().pallets` — every pallet in the system, including ones with status `picked`, `shipped`, `in_transit`, or pallets that don't belong to the selected source warehouse.
- `createTransferFlow` only inserts `transfers` / `transfer_lines` / `move_tasks` rows. It does **not** touch `pallets` or `inventory_balances`, so the pallet still shows in source-warehouse inventory until someone signs off dispatch.
- `dispatchTransfer` is where the pallet/inventory rows are flipped to `in_transit` and `location_id` is cleared. Inventory search already hides `in_transit` / `shipped` / `picked` (`RETIRED_INVENTORY_STATUSES`), so once dispatched it correctly disappears — but between create and dispatch it incorrectly still shows.
- No filter on the pallet picker for picked/shipped/in_transit pallets, and no scoping to the source warehouse.

## Changes

### 1. `src/features/transfers/transfers-page.tsx` — pallet picker

- Watch `form.watch("source_warehouse_id")`.
- Build the pallet `<SelectField>` options from `options.pallets` filtered to:
  - `current_warehouse_id === source_warehouse_id` (required; show empty/disabled state until source is chosen),
  - `is_stored === true` and `current_location_id` present,
  - `status` in `{available, quarantine, hold}` — exclude `picked`, `shipped`, `in_transit`, `receiving`, `damaged`, `missing`,
  - not already referenced by an active (`queued` / `in_progress`) transfer line (use the existing `transfers` query to derive the in-flight pallet id set).
- Show a clear empty message ("No transferable pallets in this warehouse") when the filtered list is empty.

### 2. `src/features/transfers/transfers-core.ts` — debit on create

In `createTransferFlow`, after loading the pallet and before/after inserting `transfer_lines`:

- Validate the pallet is in the source warehouse, stored, and in a transferable status; throw a clear error otherwise (defense-in-depth for the UI filter).
- Capture `pallet.current_location_id` and `pallet.current_warehouse_id` for the move task / audit metadata.
- Update `pallets`: `status = 'in_transit'`, `current_location_id = null`, `is_stored = false`.
- Update `inventory_balances` for that pallet: `status = 'in_transit'`, `location_id = null`, `zone_id = null`.
- Write an `log_audit_event` row (`event_type = 'transfer_created'`) with the source warehouse and from-location for traceability.

Result: the pallet is debited from source inventory the moment the transfer is created. `dispatchTransfer` keeps doing the driver sign-off and timestamping, but the pallet/inventory updates there become no-ops (idempotent — leave them in place but guarded so they don't error if already `in_transit`).

### 3. No schema or RLS changes required

`inventory_search_view` already filters retired statuses; once `status = 'in_transit'` is set on create, the pallet disappears from the source warehouse view automatically. `cancelTransfer` already returns the pallet to `receiving` with a draft, so cancellation still works.

## Out of scope

- No UI restyle of the Transfers page.
- No changes to dispatch sign-off, receive, or cancel flows beyond making the pallet/inventory updates in `dispatchTransfer` idempotent.
- No changes to Inventory Search / Status pages — they already respect the retired-status filter.

## Verification

- `bunx tsc --noEmit`.
- Manually: pick a source warehouse → only its stored, non-picked/non-shipped pallets appear; create transfer → pallet disappears from Inventory Search for that warehouse immediately; cancel returns it to receiving as today.

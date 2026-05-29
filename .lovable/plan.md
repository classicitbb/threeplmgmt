# Plan — Pick completion truly debits inventory

## Problem

After a pick is confirmed, the SKU/pallet still shows up:

- Inventory Search keeps the row visible (status switches to `picked`, available = 0, but the row remains).
- Dashboard pallet counts don't decrement (`totalPallets` and `warehousePallets` count every `inventory_balances` row regardless of status).
- The location still shows as occupied (`location_occupancy_view` and putaway counters count picked balances).
- The pallet still has `current_location_id` set, so it appears parked in the slot.
- The pick list itself never auto-closes to `completed` when all its tasks finish.

Root cause is in `confirmPickTask` (`src/lib/wms-core.ts`): it only updates `available_quantity` + `status`, leaves `quantity`, `current_location_id`, `location_id`, `zone_id` untouched, and never rolls the pick list up.

## Changes

### 1. `confirmPickTask` — fully retire a depleted pallet (`src/lib/wms-core.ts`)

When `nextAvailable === 0` (pallet emptied by this pick):

- Pallet update: set `status = 'picked'`, `available_quantity = 0`, `quantity = 0`, `reserved_quantity = 0`, `current_location_id = null`, `is_stored = false`.
- Inventory balance update: set `status = 'picked'`, `available_quantity = 0`, `quantity = 0`, `reserved_quantity = 0`, `location_id = null`, `zone_id = null`.

When partial pick (`nextAvailable > 0`):

- Decrement `quantity` by `confirmedQuantity` alongside `available_quantity` on both `pallets` and `inventory_balances`. Keep location and `is_stored` as-is. Status stays `available`.

This is the core fix — it makes the pallet vanish from inventory search (filtered by available view), free its slot in `location_occupancy_view`, and stop being counted as on-hand stock.

### 2. Auto-complete the pick list (`src/lib/wms-core.ts`)

At the end of `confirmPickTask`, after the task row is marked completed/exception:

- Re-query sibling `pick_tasks` for the same `pick_list_id`.
- If every task is in (`completed`, `cancelled`, `exception`), update `pick_lists.status = 'completed'` and stamp a `completed_at`-style note. Also flip the linked `orders.status` to `'completed'` when present and all lines satisfied.
- Log `pick_list_completed` audit event.

This removes the list from the active queue and decrements `openPickLists` on the dashboard the moment the last task is confirmed. No new "Mark complete" button needed — completion is implicit, matching the receiving model.

### 3. Dashboard counters reflect live stock (`src/lib/wms-core.ts` → `getDashboardMetrics`)

Replace the unfiltered counts:

```text
totalPallets       → balances where status NOT IN ('picked','shipped','in_transit','missing')
warehousePallets   → same filter, scoped to warehouseId
```

`availablePallets`, `holdStock`, `quarantineStock` already filter correctly and stay as-is.

### 4. Inventory Search hides retired stock by default (`src/lib/wms-core.ts` → `searchInventory`)

When `filters.status` is `"all"` (the default), add `query.not('status', 'in', '(picked,shipped,in_transit,missing)')`. Selecting `Picked` explicitly still shows them for audit. No UI change.

### 5. Location occupancy ignores retired balances (migration)

New additive migration replacing `public.location_occupancy_view`:

```text
left join inventory_balances ib
  on ib.location_id = l.id
 and ib.status not in ('picked','shipped','in_transit','missing')
```

So slot frees up the instant the last unit is picked. Keeps `security_invoker = true`.

### 6. Tests

Add a `wms-core.test.ts` case that:

- Stubs a pick task with available 5, confirms 5 → asserts pallet/balance updates include `quantity: 0`, `current_location_id: null`, `status: 'picked'`.
- Stubs partial pick (5 of 10) → asserts `quantity: 5`, location preserved.

## Files touched

- `src/lib/wms-core.ts` — `confirmPickTask`, `searchInventory`, `getDashboardMetrics` + new pick-list rollup helper.
- `supabase/migrations/<new-timestamp>_location_occupancy_excludes_picked.sql` — recreate view.
- `src/test/wms-core.test.ts` — new pick-completion assertions.

## Out of scope

- No UI changes to Inventory Search, Pick Lists, Execute Picks, or Dashboard. The fixes are behind existing components.
- No schema changes to `pallets`/`inventory_balances`; only data rules.
- No "Mark pick list complete" button — rollup is automatic, consistent with Receiving.

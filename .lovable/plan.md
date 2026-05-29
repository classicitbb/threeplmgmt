# Pick List: smarter product search + fault-proof line entry

Decisions locked in from your answers:
- One row per product, with auto FEFO/FIFO (no per-pallet picker).
- Keep the existing single-page Create form — no Receiving-style wizard.
- "In a location" means the **pallet** has `current_location_id IS NOT NULL` AND `available_quantity > 0`.

## What changes

### 1. New backend helper — per-product pickable summary
Replace `getPickableProductIds` usage in the Create form with a new `getPickableStockSummary(warehouseId)` in `src/lib/wms-core.ts` that returns:

```ts
Map<product_id, {
  totalAvailable: number,     // sum across all eligible pallets
  palletCount: number,
  topPallet: {                // the pallet that would be picked first (FEFO if expiry, else FIFO by received_at)
    pallet_code: string,
    pallet_barcode: string,
    available_quantity: number,
    location_code: string,
    expiry_date: string | null,
  } | null
}>
```

Query: `pallets` joined to `locations(code)`, filtered by `current_warehouse_id`, `available_quantity > 0`, `current_location_id IS NOT NULL`, `status = 'available'`. Sorted FEFO (expiry asc, nulls last) then FIFO (created_at asc). The previous `getPickableProductIds` stays for any other callers.

### 2. `ProductSearch` rich rows (component-local change)
`src/components/product-search.tsx` — extend `ProductOption` with optional `meta` fields (`palletCode`, `palletQty`, `totalQty`, `palletCount`, `locationCode`). Render each row as a two-line item:

```
SKU-123 · Acme Cool 12pk                          Total 84
Pallet PLT-00042 · Qty 24 @ A-12-03-2             3 pallets
```

If `meta` is absent (other call sites — Receiving, etc.) the row falls back to the current SKU · Name format. No other props change.

### 3. Create Pick List form wiring
`src/components/wms-ui.tsx` (`PickListsPage`, Create tab only):
- Swap the `pickableIds` query for `getPickableStockSummary(selectedWarehouseId)`.
- `productOptions` is built from the summary map (only products with `totalAvailable > 0`), and includes the `meta` block so the new search rows render.
- Below each selected product line, show a small read-only preview strip: `Picks: PLT-00042 · Qty 24 @ A-12-03-2 · Exp 2026-08-01 · 3 pallets in stock`.
- Qty input gets `max={totalAvailable}` and inline destructive helper text when `quantity > totalAvailable` ("Only 24 in pickable locations"). Release button stays disabled until all lines are valid (existing zod resolver + this new guard).
- When the operator scans a product barcode into ProductSearch, behaviour is unchanged: it auto-selects, then the preview strip appears and focus moves to the qty input (already wired via `pickProductRefs`).

### 4. No flow rebuild
Active Lists tab, Execute Picks page, `createPickListFlow`, `selectPickCandidates`, audit, and DB are untouched. FEFO/FIFO selection at release time stays in `selectPickCandidates` — the preview just mirrors what it would choose, so what the operator sees on screen is what actually gets reserved.

## Out of scope
- No DB migration.
- No changes to the Active Lists card, Execute Picks page, or Receiving.
- No per-pallet manual selection UI.
- No new design tokens.

## Files touched
- `src/lib/wms-core.ts` — add `getPickableStockSummary` (≈40 lines).
- `src/components/product-search.tsx` — extend `ProductOption` + row template (≈25 lines).
- `src/components/wms-ui.tsx` — swap query, build options with meta, add preview strip + qty guard inside the Create tab only (≈30 lines).

## Verification
- `bunx tsc --noEmit`.
- Manual: with a SKU that has 2 pallets in racks + 1 on the receiving dock, the search row shows total = racked qty only; preview names the FEFO pallet; requesting > racked qty disables Release and shows the helper text; releasing creates a list whose first task targets that exact pallet/location.

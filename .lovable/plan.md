## Plan — v1.7 update batch

### 1. Replace all barcodes with QR codes

- `src/components/location-label-page.tsx`, `src/components/pallet-label-page.tsx`, `src/components/zone-label-page.tsx` (and `BarcodePrintDialog` in `src/components/wms-ui.tsx`, plus barcode rendering in `src/App.tsx`): swap `JsBarcode` / CODE128 rendering for `QRCodeSVG`. Remove the `QR_THRESHOLD` branching — always QR. Keep the printed human-readable code text below the QR. Adjust print CSS sizing so QR fills the same area.
- Leave `JsBarcode` import only if still needed elsewhere; otherwise remove.

### 2. Inventory Search — horizontal scroll

- In the results table wrapper inside `src/components/wms-ui.tsx` (inventory search route), allow the row-scroll container to scroll horizontally (`overflow-x-auto`) while keeping the sticky header aligned. Ensure min column widths so the table doesn't collapse on mobile and a horizontal scrollbar appears when needed.

### 3. Products table — total qty column

- Add a read-only "Qty" display column rendered immediately to the right of the product name in the Products list table. Sum from `inventory_balances.qty_on_hand` grouped by `product_id` (single aggregate query alongside the products query, cached by react-query). Not part of the editable inline form.

### 4. Desktop sidebar behavior

- Sidebar shown on desktop only in landscape orientation (`@media (min-width: 1024px) and (orientation: landscape)`); portrait desktop/tablet falls back to the mobile top-slide nav already in place.
- Make sidebar height responsive: shrink to fit nav label text down to a minimum, then enable an internal vertical scrollbar instead of pushing content. Add subtle "squishy" press animation on nav buttons (scale 0.96 on `active:`).

### 5. Help button always last in sidebar

- In `NAVIGATION` (`src/lib/wms-core.ts`) keep Help as a separate pinned entry; in the sidebar renderer, sort/append so Help is always rendered last regardless of module flag order or future additions.

### 6. Help content refresh

- Update `src/lib/help-content.ts` to reflect current functionality: offline queue/replay, badge+PIN/user-code login, password reset, Command Center draggable tiles, Pick List release→Lists tab, Location Moves cancel, settings tab order, label printing (now QR), location hierarchy codes, inventory search filters/scroll, pending-user limited shell. Keep existing article IDs; extend sections and keywords. Update route help summaries where workflows changed.

### 7. Version bump to 1.7 + release notes

- Bump `__APP_VERSION__` (defined in `vite.config.ts`) to `1.7.0`.
- Prepend new `1.7.0` entry to the release notes arrays in `src/App.tsx` and `src/components/wms-ui.tsx` (About tab + What's New popup) summarizing items 1–8 of this plan.
- Update What's New trigger to surface on first load of 1.7.

### 8. Label sheet printing (locations & zones) — design + scope

- New action on `/locations` and `/zones` list pages: "Print labels sheet".
  - Triggered from either (a) a multiselect checkbox column with bulk action bar, or (b) current filter result set.
  - Opens a dialog: paper size (Letter / A4), grid (e.g. 2×5 / 3×7 / 4×8 — Avery-style presets), label size auto-derived, margin presets, optional starting cell (to reuse partly-used sheets).
  - Renders a single print window containing N label cells, each using the existing QR label layout (location-label-page / zone-label-page) scaled to cell size.
- New shared component `src/components/label-sheet-print.tsx` that accepts an array of label items + sheet config and produces the printable HTML. Reuses the same `escapeHtml` helper and QR generation.
- No DB schema changes required.

### 9. Edit Location save fix

- Investigate `RESOURCE_DEFINITIONS.locations` update path in `src/lib/wms-core.ts` + the inline editor in `src/components/wms-ui.tsx`. Current symptom: some field edits don't persist. Likely causes to verify: (a) hierarchy-code normalization migration rewriting `code` on save and rejecting edits, (b) `updated_at` trigger missing, (c) optimistic cache not invalidating. Fix to ensure: any editable field on a location row (capacity, temperature_class, allowed_product_family, status, max_*, mixed_sku_allowed, putaway_sequence, aisle/bay/level/depth, notes) saves and persists across reload.

### Technical notes

- Files touched (UI is frozen per AGENTS.md — these are all user-approved UI changes; will add change-log entries):
  - `src/components/location-label-page.tsx`
  - `src/components/pallet-label-page.tsx`
  - `src/components/zone-label-page.tsx`
  - `src/components/wms-ui.tsx` (sidebar, inventory search table, products table, BarcodePrintDialog, About/What's New, label-sheet entry points, edit location)
  - `src/App.tsx` (release notes, any remaining barcode usage)
  - `src/lib/wms-core.ts` (NAVIGATION order guarantee, resource definition tweaks)
  - `src/lib/help-content.ts` (content refresh)
  - `src/components/label-sheet-print.tsx` (new)
  - `vite.config.ts` (`__APP_VERSION__` → 1.7.0)
- Add AGENTS.md change-log entries dated 2026-05-29 for each approved UI shift.
- No migrations required unless the edit-location investigation finds a DB-side blocker; if so I'll propose the migration before running it.

### Out of scope

- Reworking barcode scanning input (scanners still accept the underlying code text; QR contains the same payload).
- Switching label stock formats beyond the standard Avery presets in the new sheet dialog.
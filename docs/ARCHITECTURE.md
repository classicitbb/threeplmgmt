# Warehouse Wizard — Architecture Reference

> **Audience:** AI agents and developers. Read this before editing any core files.
> Keep this document in sync when adding new modules, tables, or workflow patterns.
> See also: `AGENTS.md` (UI freeze rules) and `README.md` (setup instructions).

---

## System Overview

Warehouse Wizard is a scan-first, pallet-level WMS for 3PL-style warehouse operations.
A React SPA backed by Supabase (PostgreSQL + Auth + RLS + Storage).

```
Browser SPA
 ├── src/App.tsx              Routes, auth guards, InventoryDetailPage, PickExecutionPage
 ├── src/components/
 │   └── wms-ui.tsx           All page components (AppShell, ResourcePage, workflows) — UI FROZEN
 └── src/lib/
     ├── wms-core.ts          Business logic: all Supabase queries and mutations
     └── enterprise-wms.ts    Dashboard transforms, ZPL labels, NetSuite payload builders

Supabase (PostgreSQL)
 ├── Auth                     JWT sessions; profiles auto-created via handle_new_user() trigger
 ├── RLS                      Row-level security on all tables
 ├── RPCs                     directed_putaway_candidates, log_audit_event, resolve_login_code,
 │                            admin_invite_user, write_system_log, reset_wms_data,
 │                            run_warehouse_setup
 └── Views                    inventory_search_view, location_occupancy_view
```

---

## File Responsibility Map

| File | Responsibility | Frozen? |
|------|---------------|---------|
| `src/App.tsx` | BrowserRouter, all Route definitions, LoginPage, InventoryDetailPage, PickExecutionPage, RequireAuth guard, RELEASE_HISTORY | Yes |
| `src/components/wms-ui.tsx` | Every page component: AppShell sidebar, DashboardPage, ReceivingPage, PutawayTasksPage, InventorySearchPage, PickListsPage, TransfersPage, LocationMovesPage, CycleCountsPage, StatusPage, ReportsPage, SettingsPage, UsersRolesPage, SystemLogPage, EmailLogPage, ResourcePage (generic CRUD), SetupWizardPage | Yes |
| `src/lib/wms-core.ts` | All Supabase calls, Zod schemas, business rules, RESOURCE_DEFINITIONS, NAVIGATION, validatePutawayAssignment | No |
| `src/lib/enterprise-wms.ts` | Dashboard data transformation (buildEnterpriseDashboard), ZPL label generation (generateZplLabel), NetSuite mappers | No |
| `src/lib/query-client.ts` | TanStack Query defaults and caching strategy | No |
| `src/lib/query-invalidation.ts` | invalidateWarehouseData() — sweeps all cache keys after mutations | No |
| `src/hooks/use-auth.tsx` | AuthContext: Supabase session, profile, roles, demo mode, sign-in by email/code/badge | No |
| `src/hooks/use-feature-flags.ts` | Module enable/disable flags (localStorage), mobile toolbar pin config | No |
| `src/hooks/use-network-status.ts` | assertOnline(), guardMutation(), useNetworkStatus() | No |
| `src/integrations/supabase/types.ts` | Auto-generated Supabase types — **never edit manually** | — |
| `src/integrations/supabase/client.ts` | Supabase client singleton — **never edit manually** | — |

---

## Role System

Five roles. `hasRole(allowed)` uses OR logic — user needs any one of the listed codes.

| Code | Label | Key access |
|------|-------|-----------|
| `admin` | Admin | All routes, user management, system log, email log |
| `warehouse_manager` | Warehouse Manager | All ops routes, reports, settings |
| `inventory_clerk` | Inventory Clerk | Receiving, putaway, inventory, picks, transfers, products |
| `warehouse_operator` | Warehouse Operator | Putaway, picks, location moves, cycle counts |
| `dispatch_driver` | Dispatch Driver | Transfers (dispatch sign-off), dashboard |

Navigation is role-filtered by the `NAVIGATION` array in `wms-core.ts`.
Module visibility is additionally controlled by feature flags (`use-feature-flags.ts`).
Route-level guards live in `RequireAuth` (App.tsx), using `auth.hasRole()`.

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `warehouses` | Physical warehouse sites |
| `zones` | Temperature/functional areas within warehouses (ambient, cool, staging, dispatch, quarantine) |
| `locations` | Individual rack bays, staging slots, dispatch, quarantine bays |
| `clients` | 3PL customers / stock owners |
| `products` | SKUs with temperature class, rotation method (FIFO/FEFO), lot/expiry tracking flags |
| `product_packaging_profiles` | Pallet dimension templates per product |
| `pallets` | Physical pallets: current location, warehouse, status, quantity, barcode |
| `inventory_lots` | Lot / batch / expiry groupings per product + client |
| `inventory_balances` | Position records: pallet × location × lot × warehouse × status × quantity |
| `receipts` / `receipt_lines` | Inbound receiving documents |
| `putaway_tasks` | Directed put-to-location tasks (one per pallet, created by receiving) |
| `orders` / `order_lines` | Outbound customer orders |
| `pick_lists` / `pick_tasks` | Pick waves and individual task lines per pallet |
| `transfers` / `transfer_lines` | Inter-warehouse or intra-warehouse pallet moves |
| `move_tasks` | Location-to-location moves within a single warehouse |
| `cycle_counts` / `cycle_count_lines` | Physical inventory count rounds |
| `stock_adjustments` | Quantity deltas and status-change audit records |
| `audit_events` | Immutable event log (written only via `log_audit_event` RPC) |
| `barcode_labels` | Label print history per entity |
| `profiles` | Extended user data: approval flag, user_code, badge_code, default_warehouse_id |
| `roles` / `user_roles` | RBAC — role codes assigned per user |
| `client_variables` | Per-client key/value config store |
| `system_logs` | Application-level error, info, and record-count log entries |
| `ai_recommendations` | Saved Warehouse Brain recommendations (status: open/acted) |

**Read-only views:**
- `inventory_search_view` — denormalized inventory with SKU, pallet, location, lot, quantity columns
- `location_occupancy_view` — per-location occupied vs. max_pallets capacity

**Enterprise extension tables** (added by the enterprise migrations):
`staging_loads`, `dock_appointments`, `printer_stations`, `label_templates`, `print_jobs`,
`replenishment_tasks`, `integration_connections`, `external_record_links`,
`integration_sync_jobs`, `barcode_label_items`

---

## Operational Workflow Sequences

### 1. Receiving
```
createReceiptFlow(input) →
  resolveInventoryLot()             find or create inventory_lots row
  upsertRecord("receipts")          receipt header (status: completed)
  upsertRecord("receipt_lines")     line with lot, packaging, dimensions
  [pallet reuse check]              if reuse_pallet_barcode, validate pallet is empty
  upsertRecord("pallets")           pallet (status: receiving, is_stored: false, available_quantity: 0)
  upsertRecord("inventory_balances") balance (status: receiving, available_quantity: 0)
  directed_putaway_candidates RPC   ranked location suggestions
  upsertRecord("putaway_tasks")     task (status: queued, suggested_location_id from RPC)
  log_audit_event RPC               "receipt" event
  createLabelRecord("pallet")       barcode_labels row
```

### 2. Putaway
```
confirmPutaway(taskId, palletBarcode, locationCode, options?) →
  Validate: pallet barcode matches task pallet
  Validate: location code exists in DB
  validatePutawayAssignment() →   checks active status, temperature match,
                                   capacity (occupiedPallets < max_pallets),
                                   mixed-SKU policy, pallet height limit
  If invalid and no override → throw "RULE_VIOLATION: {reason}"
                                 (UI intercepts this prefix for override dialog)
  UPDATE pallets             → current_location_id, status: available, is_stored: true, available_quantity = quantity
  UPDATE inventory_balances  → warehouse_id, zone_id, location_id, status: available
  UPDATE putaway_tasks        → status: completed, completed_at
  log_audit_event RPC         "putaway" + override metadata
```

### 3. Pick List Creation & Execution
```
createPickListFlow(input) →
  upsertRecord("orders") + upsertRecord("order_lines") per line
  upsertRecord("pick_lists")    (status: queued, consolidated: true if >1 line)
  For each line:
    selectPickCandidates()      sort available balances by FIFO or FEFO (rotation_method)
    upsertRecord("pick_tasks") per candidate pallet (status: queued or exception if short)
  createLabelRecord("pick_list")

confirmPickTask(taskId, locationCode, palletBarcode, quantity, shortReason?) →
  Validate barcode and location match
  UPDATE pick_tasks          → confirmed_quantity, status: completed (or exception if short_reason)
  UPDATE pallets             → available_quantity - confirmedQuantity; status: picked if 0
  UPDATE inventory_balances  → same quantity/status update
  log_audit_event RPC         "pick"
```

### 4. Transfers
```
createTransferFlow()  → transfer + transfer_line + move_task (status: queued)
dispatchTransfer()    → validates driver sign-off code matches profiles.user_code or badge_code
                         pallets → status: in_transit, current_location_id: null
                         transfer → status: in_progress, dispatch timestamps
receiveTransfer()     → pallets → status: receiving, warehouse updated, location cleared
                         new putaway_task per transfer line
cancelTransfer()      → pallets → status: receiving, location cleared
                         createReturnedPalletDraft() per line (surfaced in Receiving page)
```

### 5. Cycle Count
```
createCycleCountFlow(input) →
  upsertRecord("cycle_counts")   scope: location | zone | sku | spot
  Query inventory_balances in scope
  upsertRecord("cycle_count_lines") per balance (expected_quantity = current quantity)
  createLabelRecord("count_sheet")

submitCycleCountLine(lineId, countedQuantity) →
  Calculate variance_quantity and variance_percent
  UPDATE cycle_count_lines → counted_quantity, variance, status: completed | exception
  If pallet_id set:
    UPDATE pallets + inventory_balances → new quantity
    INSERT stock_adjustments            → adjustment_type: cycle_count
```

### 6. Draft Receipts
```
Draft receipt pattern:
  saveDraftReceipt(values)         → INSERT receipt (status: draft), all form data in notes as JSON
  listDraftReceipts(warehouseId)   → SELECT drafts, parse notes JSON for display
  completeReceiptFromDraft(id, values) →
    If notes._returned → completeReturnedPalletDraft()  (reuses existing pallet record)
    Else               → createReceiptFlow() + cancel the draft
  deleteDraftReceipt(id)           → DELETE draft (hard delete, draft status only)

Returned pallet drafts (_returned: true):
  Created by: cancelTransfer(), revertPutawayToDraft()
  Contains: returned_pallet_id, source_label, source_type
  Completing one updates the existing pallet record rather than creating a new one
```

---

## Code Conventions

**`db()` helper** — Used for tables not yet in generated Supabase types. Replace with typed
`supabase.from<Table>()` calls once all enterprise migrations are stable.

**Empty string → null** — `upsertRecord()` and `updateRecord()` convert `""` to `null` for
all payload values before saving. Never send empty strings to Supabase UUID or nullable columns.

**Audit events** — All mutations call `log_audit_event` RPC. Failures are `console.error`'d
but do **not** throw or block the primary operation (fire-and-forget).

**RULE_VIOLATION prefix** — `confirmPutaway()` throws `"RULE_VIOLATION: {reason}"` when a
location rule fails. The UI checks for this prefix to show an override confirmation dialog
instead of a plain error toast. Always preserve this prefix when modifying putaway logic.

**Task number prefixes** — All generated by `buildPalletCode(prefix)`:
`RCT` receipt · `PLT` pallet · `PTA` putaway · `PKL` pick-list · `PKT` pick-task ·
`TRF` transfer · `MOV` move-task · `CNT` cycle-count · `ADJ` adjustment · `STS` status-change

**Archive pattern** — Two strategies used across resources:
- `archiveField: "active"` → `active = false` hides the row (clients, products, warehouses, profiles)
- `archiveField: "is_hidden"` → `is_hidden = true` + `hidden_at` / `hidden_reason` (zones, locations, packaging, user_roles)
- `applyArchiveFilter(query, archiveField, includeHidden)` applies the correct filter automatically

**Location code format** — `{WAREHOUSE}-{ZONE}-{AISLE}-{BAY}-L{LEVEL}` e.g. `MAIN-AMB-A-01-L02`
Generated by the Location Wizard; stored in `locations.code`.
QR codes replace CODE128 barcodes in labels when the code exceeds 20 characters.

**RESOURCE_DEFINITIONS** — Config-driven CRUD. Adding a new resource requires:
1. New entry in `RESOURCE_DEFINITIONS` (wms-core.ts) with table, fields, roles, helpId
2. New route in `ResourceRoutes` (App.tsx) using `<ResourcePage resource={...} />`
3. Nav entry in `NAVIGATION` (wms-core.ts) with matching route and roles

---

## Query Cache Key Reference

All keys used by `invalidateWarehouseData()` in `query-invalidation.ts`:

```
["dashboard-metrics"]           getDashboardMetrics()
["inventory-search"]            searchInventory()
["putaway-tasks"]               getPutawayTasks()
["pick-lists"]                  listPickLists()
["transfers"]                   listTransfers()
["cycle-counts"]                listCycleCounts()
["move-tasks"]                  listMoveTasks()
["status-pallets"]              listStatusPallets()
["reports"]                     getReportData()
["warehouses"]                  listRecords("warehouses")
["zones"]                       listRecords("zones")
["locations"]                   listRecords("locations")
["clients"]                     listRecords("clients")
["products"]                    listRecords("products")
["product_packaging_profiles"]  listRecords("product_packaging_profiles")
["options"]                     fetchOptions()
```

Reference data with extended staleTime (5 min):
`["options"]`, `["products","options-for-table"]`, `["clients","options-for-table"]`,
`["warehouses","options-for-table"]`, `["zones","options-for-table"]`

---

## Demo Mode Quick Reference

| Field | Value |
|-------|-------|
| Password (all demo users) | `Warehouse123!` |
| Demo session storage key | `warehouse-wizard-demo-session` (localStorage) |
| Demo JWT access_token | `preview-demo-token` |
| Enabled on | localhost, `*.lovable.app` (except `threeplmgmt.lovable.app`) |
| `auth.uid()` in RLS/RPCs | `NULL` — audit events record no actor |

---

## Supabase RPC Reference

| RPC | Called by | Purpose |
|-----|-----------|---------|
| `directed_putaway_candidates(in_pallet_id)` | createReceiptFlow, completeReturnedPalletDraft | Ranked location suggestions for putaway |
| `log_audit_event(in_event_type, in_entity_table, in_entity_id, in_pallet_id?, in_warehouse_id?, in_to_location_id?, in_from_location_id?, in_metadata?)` | Every mutating function | Write immutable audit record |
| `resolve_login_code(in_login_code)` | use-auth signIn | Resolve user_code or badge_code to email |
| `admin_invite_user(in_email, in_full_name, in_password, in_role_code?, in_warehouse_id?)` | adminInviteUser | Create pre-approved user with role |
| `write_system_log(in_log_type, in_severity, in_title, ...)` | writeSystemLog | Insert system_logs row |
| `reset_wms_data()` | resetWmsData | Truncate all WMS tables (dev/demo use only) |
| `run_warehouse_setup(setup_payload, seed_mode)` | runWarehouseSetup | Bulk-create warehouses/zones/locations from template |

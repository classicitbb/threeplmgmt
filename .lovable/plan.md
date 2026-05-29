## Scope

Two related changes:

1. Make **Reset All** safe, explicit, and verified to actually reset everything except the dev account.
2. Add a **child-aware hard delete** for the entities the user listed (warehouses, zones, locations, products, clients) so admins can permanently remove rows once they're empty — replacing today's hide-only behavior with a real delete path that refuses if children still exist.

Out of scope: changing the existing soft-archive ("hide") flow — it stays. We're adding a "Delete permanently" action next to it.

---

## Part 1 — Reset All

### What's there today

- `public.reset_wms_data()` (in the consolidated migration) truncates all operational + setup tables (warehouses, zones, locations, products, clients, pallets, orders, tasks, audit, labels, integrations, AI, etc.) and clears `profiles.default_warehouse_id` + `user_roles` warehouse scoping. It runs `CASCADE`.
- It does **not** touch `profiles`, `user_roles`, or `auth.users` at all. So today "Reset All" keeps every user account, including dev.
- The Settings → Environment "Reset all" button fires immediately with no confirmation.

### What the user wants

> removes all users except dev, all products, warehouses, locations, zones, clients and all seeded data
> typed reset challenge and a list of the implications

### Backend changes

Migration that replaces `public.reset_wms_data()` to also wipe non-dev users:

```text
1. Admin-only guard (unchanged).
2. Truncate the same setup + operational tables as today.
3. Identify dev users: user_ids in user_roles joined to roles where code = 'developer'.
4. Delete user_roles where user_id NOT IN dev_users.
5. Delete profiles where id NOT IN dev_users.
6. Delete auth.users where id NOT IN dev_users
   (security definer, schema-qualified, wrapped so a missing row doesn't error).
7. Also clear: print_jobs, barcode_labels, label_templates rows that
   reference deleted entities (already CASCADEd by truncate today).
8. Return jsonb { status, deleted_users, kept_users, message }.
```

Notes:
- Use `delete from auth.users where id <> all(dev_ids)` — safer than truncating auth.
- Keep `email_send_log`, `email_unsubscribe_tokens`, `email_send_state` intact (system tables).
- Keep `roles` table (role catalog) and `system_logs` clearing as today.

### Frontend changes (Settings → Environment)

Replace the bare "Reset all" button with a `<Dialog>` that:

1. Headlines "Reset all warehouse data" with a destructive style.
2. Lists implications as a bulleted block:
   - All warehouses, zones, locations, and products will be deleted.
   - All clients, pallets, inventory, orders, tasks, transfers, counts, and audit events will be deleted.
   - All printed labels, templates, integrations, AI recommendations, and reports will be deleted.
   - All users **except developer accounts** will be removed. They will need to request access again.
   - This cannot be undone.
3. Shows a text input requiring the user to type `RESET ALL` exactly. The Confirm button stays disabled until the input matches.
4. Calls `resetWmsData()` on confirm, then navigates to `/setup-wizard` as today.
5. Toast shows `Reset complete. Removed N user accounts.` using the new RPC return payload.

Only admins/developers can open the dialog (existing `isDeveloperOrAdmin` gate).

---

## Part 2 — Child-aware hard delete

### Entities in scope

`warehouses`, `zones`, `locations`, `products`, `clients`.
(`product_packaging_profiles` already has a hide path; leave alone unless the user asks.)

### Child rules

A row may be deleted permanently only when no live children reference it. Live = not soft-deleted (`is_hidden = false` or `active = true`) **and** not historical operational data. Definition per parent:

- **warehouse** → blocked by any row in `zones`, `locations`, `pallets` (`current_warehouse_id`), `inventory_balances`, `orders`, `pick_lists`, `putaway_tasks`, `move_tasks`, `receipts`, `transfers` (src or dest), `dock_appointments`, `cycle_counts`, `printer_stations`.
- **zone** → blocked by `locations`, `inventory_balances` (`zone_id`), `cycle_counts` (`zone_id`).
- **location** → blocked by `pallets` (`current_location_id`), `inventory_balances` (`location_id`), `putaway_tasks` (suggested/confirmed), `move_tasks` (from/to), `pick_tasks`, `cycle_count_lines`.
- **product** → blocked by `pallets`, `inventory_balances`, `inventory_lots`, `order_lines`, `product_packaging_profiles` (live).
- **client** → blocked by `products` (live `client_owner_id`), `pallets`, `inventory_balances`, `orders`, `pick_lists`, `inventory_lots`.

If blocked, return `{ ok: false, blocked_by: [{ table, count }] }` so the UI can list reasons. If clear, hard-delete the row.

### Backend implementation

One security-definer RPC per parent, e.g.:

```text
public.delete_warehouse_cascade(in_id uuid) returns jsonb
public.delete_zone_cascade(in_id uuid) returns jsonb
public.delete_location_cascade(in_id uuid) returns jsonb
public.delete_product_cascade(in_id uuid) returns jsonb
public.delete_client_cascade(in_id uuid) returns jsonb
```

Each:
1. Guards on `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'developer')`.
2. Counts each blocking child table.
3. If any count > 0, returns `{ ok: false, blocked_by: [...] }` — no delete.
4. Otherwise hard-deletes the row, logs an `audit_events` entry, returns `{ ok: true }`.

All five granted to `authenticated`. No schema changes.

### Frontend implementation

In `src/lib/wms-core.ts`, add five wrappers (`deleteWarehouseCascade(id)`, etc.) that call the RPCs and return the structured result.

In `src/components/wms-ui.tsx`, in each entity's edit/detail sheet, **next to** the existing Hide/Archive button add a **Delete permanently** button (destructive, gated to admin/developer). On click:

1. Open an `AlertDialog`: "Delete <name> permanently? This cannot be undone. Children must be removed first."
2. On confirm, call the cascade RPC.
3. If `ok: false`, toast the blockers in human terms ("3 locations, 12 pallets still reference this warehouse — remove or reassign them first.") and keep the row.
4. If `ok: true`, toast success and invalidate the relevant queries.

No UI freeze copy or layout is removed; this only **adds** a button per the user's request.

### Tests

Extend `src/test/migration.test.ts` to assert:
- `reset_wms_data` source contains `delete from auth.users` and a `developer` exclusion.
- Each new `delete_*_cascade` function exists and contains `blocked_by`.

---

## Files touched (estimate)

- New migration: `supabase/migrations/<ts>_reset_all_and_cascade_deletes.sql` (Part 1 reset RPC update + Part 2 five new RPCs + grants).
- `src/lib/wms-core.ts` — five wrapper functions, update `resetWmsData` return type.
- `src/components/wms-ui.tsx` — Reset All dialog, Delete-permanently buttons in warehouse/zone/location/product/client edit surfaces.
- `src/test/migration.test.ts` — new assertions.

Confirm and I'll build it.
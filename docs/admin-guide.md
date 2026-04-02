# Warehouse Wizard Admin Guide

## Initial Setup

1. Run the Supabase migration in `supabase/migrations/20260402093000_init_wms.sql`.
2. Run `supabase/seed.sql` for a starter warehouse network, clients, products, and packaging profiles.
3. Create or invite users in Supabase Auth.
4. Have each user sign in once so their `profiles` row is created automatically.
5. Open the `Users` page and assign each user one or more roles.

## Master Data Sequence

1. Confirm both warehouses on the `Warehouses` page.
2. Create or adjust `Zones`.
3. Load `Locations` by form entry or CSV import.
4. Create `Products`.
5. Create `Packaging Profiles`.

## Operator Flow

1. `Receiving`: create the receipt, pallet, lot, and putaway task.
2. `Putaway Tasks`: scan pallet barcode, scan location barcode, confirm storage.
3. `Pick Lists`: managers release work, operators execute tasks from the pick execution route.
4. `Transfers`: create transfer request, dispatch, receive, then complete destination putaway.
5. `Cycle Counts`: generate count sheets and submit counted quantities.
6. `Statuses`: move pallets into hold, quarantine, damaged, available, or missing with an audit reason.

## Important Rules

- Cool-chain stock must go to cool locations only.
- Stock is not stored until pallet barcode and location barcode are both confirmed.
- Picking is FEFO for expirable SKUs and FIFO for non-expirable SKUs.
- Status changes and movements are written to `audit_events`.
- Users are authorized through Supabase RLS, not just hidden navigation.

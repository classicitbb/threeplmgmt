# Warehouse Wizard

Warehouse Wizard is a production-oriented internal WMS app for a 3PL-style warehouse operation. It supports warehouse setup, product master data, receiving, directed putaway, pallet-level inventory search, picking, transfers, cycle counts, stock status control, enterprise dashboards, dock handoff, AI-assisted recommendations, reporting, CSV import/export, Zebra ZPL label output, Supabase Auth, and Supabase RLS.

## Stack

- React + TypeScript + Vite
- Tailwind + shadcn/ui
- React Router
- TanStack Query
- React Hook Form + Zod
- Supabase Auth, Postgres, Storage, Realtime-ready schema
- PWA via `vite-plugin-pwa`
- Vitest + React Testing Library

## Setup

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase values.
3. Run all SQL files in `supabase/migrations/` in timestamp order.
4. Run the seed in `supabase/seed.sql`.
5. Start the app:
   `npm run dev`

## Supabase Notes

- The migrations create the required core tables, enums, helper functions, views, storage buckets, indexes, profile approval fields, and RLS policies.
- New auth users automatically get a `profiles` row through `handle_new_user()`.
- Roles are assigned through `roles` and `user_roles`.
- Storage buckets are created for `labels`, `imports`, and `attachments`.

## Key Routes

- `/login`
- `/dashboard`
- `/warehouses`
- `/zones`
- `/locations`
- `/products`
- `/packaging-profiles`
- `/receiving`
- `/putaway-tasks`
- `/inventory-search`
- `/pick-lists`
- `/transfers`
- `/cycle-counts`
- `/status`
- `/reports`
- `/users`
- `/settings`
- `/help`
- `/setup-wizard`

## Operational Workflows

- Receiving creates receipts, receipt lines, lots, pallets, label records, inventory balances, and putaway tasks.
- Putaway confirms both pallet barcode and location barcode before stock becomes available.
- Inventory search reads from `inventory_search_view`.
- Pick list creation allocates from available inventory and creates pick tasks.
- Transfers preserve pallet identity and create follow-on tasks.
- Cycle counts generate count lines and write adjustment records for variances.
- Status changes write audit entries and stock adjustment records.
- The dashboard has Floor, Dock, and Office modes for operator start-of-shift work, staged delivery handoff, and management monitoring.
- Reports include saved-report style outputs, CSV export, lean/Six Sigma signals, and Warehouse Brain recommendations.
- Enterprise extension migrations add NetSuite-ready integration logs, external ID links, printer queues, report definitions, AI recommendations, QA, returns, staging, replenishment, and work-template tables.

## Enterprise Deliverables

- API contract: [docs/api-v1.md](./docs/api-v1.md)
- Admin and go-live guide: [docs/admin-guide.md](./docs/admin-guide.md)
- NetSuite-first integration model through `integration_connections`, `external_record_links`, `integration_sync_jobs`, payload logs, and dead letters.
- Zebra-first printing model through `label_templates`, `printer_stations`, and `print_jobs`.
- Warehouse Brain recommendation storage through `ai_recommendations`.

## Commands

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`

## Verification

The current repository has been verified with:

- `npm run build`
- `npm run lint`
- `npm test`

## Admin Guide

See [docs/admin-guide.md](./docs/admin-guide.md) for the warehouse setup sequence and operator usage guidance.

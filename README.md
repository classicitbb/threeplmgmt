# Warehouse Wizard

Warehouse Wizard is a production-oriented internal WMS-lite app for a 3PL-style warehouse operation. It supports warehouse setup, product master data, receiving, directed putaway, pallet-level inventory search, picking, transfers, cycle counts, stock status control, reporting, CSV import/export, printable labels, Supabase Auth, and Supabase RLS.

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

## Operational Workflows

- Receiving creates receipts, receipt lines, lots, pallets, label records, inventory balances, and putaway tasks.
- Putaway confirms both pallet barcode and location barcode before stock becomes available.
- Inventory search reads from `inventory_search_view`.
- Pick list creation allocates from available inventory and creates pick tasks.
- Transfers preserve pallet identity and create follow-on tasks.
- Cycle counts generate count lines and write adjustment records for variances.
- Status changes write audit entries and stock adjustment records.

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

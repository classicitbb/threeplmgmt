import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260402093000_init_wms.sql"),
  "utf8",
);
const helpMigration = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260402193000_help_archive_reset_setup.sql"),
  "utf8",
);
const approvalRlsMigration = readFileSync(
  path.resolve(process.cwd(), "supabase/migrations/20260402195000_fix_profile_approval_and_admin_rls.sql"),
  "utf8",
);

describe("init_wms migration", () => {
  it("creates the core warehouse tables", () => {
    expect(migration).toContain("create table public.warehouses");
    expect(migration).toContain("create table public.locations");
    expect(migration).toContain("create table public.products");
    expect(migration).toContain("create table public.pallets");
    expect(migration).toContain("create table public.inventory_balances");
    expect(migration).toContain("create table public.pick_tasks");
  });

  it("enables row level security and role-based policies", () => {
    expect(migration).toContain("alter table public.pallets enable row level security");
    expect(migration).toContain("create policy \"putaway tasks read assigned\"");
    expect(migration).toContain("create policy \"pick tasks read assigned\"");
    expect(migration).toContain("create policy \"roles admin manage\"");
  });

  it("defines helper views and RPCs for operations", () => {
    expect(migration).toContain("create or replace function public.directed_putaway_candidates");
    expect(migration).toContain("create or replace view public.inventory_search_view");
    expect(migration).toContain("create or replace view public.location_occupancy_view");
    expect(migration).toContain("insert into storage.buckets");
  });
});

describe("help/archive/setup migration", () => {
  it("adds archive fields and admin rpc entry points", () => {
    expect(helpMigration).toContain("add column if not exists is_hidden boolean not null default false");
    expect(helpMigration).toContain("create or replace function public.reset_wms_data()");
    expect(helpMigration).toContain("create or replace function public.run_warehouse_setup");
  });
});

describe("profile approval and admin rls migration", () => {
  it("adds profile approval fields needed by the app", () => {
    expect(approvalRlsMigration).toContain("add column if not exists phone text");
    expect(approvalRlsMigration).toContain("add column if not exists approved boolean not null default false");
    expect(approvalRlsMigration).toContain("update public.profiles p");
  });

  it("restores admin write access to user_roles under RLS", () => {
    expect(approvalRlsMigration).toContain("create policy \"Admins can insert user_roles\"");
    expect(approvalRlsMigration).toContain("create policy \"Admins can update user_roles\"");
    expect(approvalRlsMigration).toContain("create policy \"Admins can delete user_roles\"");
  });
});

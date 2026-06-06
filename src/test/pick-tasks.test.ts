import { beforeEach, describe, expect, it, vi } from "vitest";

const pickDb = vi.hoisted(() => ({
  selects: {} as Record<string, Array<{ data: any; error: any }>>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown>; filters: Array<[string, unknown]> }>,
  updateErrors: {} as Record<string, Error | undefined>,
  rpcs: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  function nextSelect(table: string) {
    return pickDb.selects[table]?.shift() ?? { data: null, error: new Error(`No ${table} mock`) };
  }

  function from(table: string) {
    return {
      select: () => {
        const filters: Array<[string, unknown]> = [];
        const chain: any = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            return chain;
          },
          single: () => nextSelect(table),
          maybeSingle: () => nextSelect(table),
          then: (resolve: (value: any) => unknown) => resolve(nextSelect(table)),
        };
        return chain;
      },
      update: (payload: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const chain: any = {
          eq: (column: string, value: unknown) => {
            filters.push([column, value]);
            pickDb.updates.push({ table, payload, filters: [...filters] });
            return chain;
          },
          then: (resolve: (value: any) => unknown) => resolve({ data: null, error: pickDb.updateErrors[table] ?? null }),
        };
        return chain;
      },
    };
  }

  return {
    supabase: {
      from,
      rpc: (name: string, args: Record<string, unknown>) => {
        pickDb.rpcs.push({ name, args });
        return { data: null, error: null };
      },
    },
  };
});

import { confirmPickTask } from "@/lib/wms-core";

function seedPick({
  task = {},
  pallet = {},
  balance = {},
  location = {},
  siblings = [{ id: "pick-task-1", status: "completed" }],
  parent = { id: "pick-list-1", status: "released", warehouse_id: "wh-1", order_id: null },
}: {
  task?: Record<string, unknown>;
  pallet?: Record<string, unknown>;
  balance?: Record<string, unknown>;
  location?: Record<string, unknown>;
  siblings?: Array<Record<string, unknown>>;
  parent?: Record<string, unknown> | null;
} = {}) {
  pickDb.selects = {
    pick_tasks: [
      { data: { id: "pick-task-1", pallet_id: "pallet-1", pick_list_id: "pick-list-1", status: "queued", ...task }, error: null },
      { data: siblings, error: null },
    ],
    pallets: [
      { data: { id: "pallet-1", pallet_barcode: "PBC-1", quantity: 10, available_quantity: 10, ...pallet }, error: null },
    ],
    inventory_balances: [
      { data: { id: "bal-1", pallet_id: "pallet-1", location_id: "loc-1", warehouse_id: "wh-1", quantity: 10, available_quantity: 10, ...balance }, error: null },
    ],
    locations: [
      { data: { id: "loc-1", code: "A-01-01", ...location }, error: null },
    ],
    pick_lists: parent ? [{ data: parent, error: null }] : [],
  };
}

describe("confirmPickTask", () => {
  beforeEach(() => {
    pickDb.selects = {};
    pickDb.updates = [];
    pickDb.updateErrors = {};
    pickDb.rpcs = [];
  });

  it("fully depletes picked stock and clears the location", async () => {
    seedPick();

    await confirmPickTask("pick-task-1", "A-01-01", "PBC-1", 10);

    expect(pickDb.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "pick_tasks", payload: expect.objectContaining({ status: "completed", confirmed_quantity: 10 }) }),
      expect.objectContaining({ table: "pallets", payload: expect.objectContaining({ quantity: 0, available_quantity: 0, current_location_id: null, is_stored: false, status: "shipped" }) }),
      expect.objectContaining({ table: "inventory_balances", payload: expect.objectContaining({ quantity: 0, available_quantity: 0, location_id: null, zone_id: null, status: "shipped" }) }),
    ]));
    expect(pickDb.rpcs[0]).toMatchObject({
      name: "log_audit_event",
      args: {
        in_event_type: "pick",
        in_metadata: expect.objectContaining({ confirmed_quantity: 10, remaining_quantity: 0, location_cleared: true }),
      },
    });
  });

  it("partially picks stock without clearing the location", async () => {
    seedPick({
      siblings: [{ id: "pick-task-1", status: "completed" }, { id: "pick-task-2", status: "queued" }],
      parent: null,
    });

    await confirmPickTask("pick-task-1", "A-01-01", "PBC-1", 4);

    expect(pickDb.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "pallets", payload: expect.objectContaining({ quantity: 6, available_quantity: 6, status: "available" }) }),
      expect.objectContaining({ table: "inventory_balances", payload: expect.objectContaining({ quantity: 6, available_quantity: 6, status: "available" }) }),
    ]));
    expect(pickDb.updates.some((update) => update.table === "inventory_balances" && "location_id" in update.payload)).toBe(false);
    expect(pickDb.rpcs[0].args.in_metadata).toMatchObject({ confirmed_quantity: 4, remaining_quantity: 6, location_cleared: false });
  });

  it("rejects already closed pick tasks", async () => {
    seedPick({ task: { status: "completed" } });

    await expect(confirmPickTask("pick-task-1", "A-01-01", "PBC-1", 1)).rejects.toThrow("already closed");
    expect(pickDb.updates).toEqual([]);
    expect(pickDb.rpcs).toEqual([]);
  });

  it("rejects over-picking available stock", async () => {
    seedPick({ balance: { quantity: 5, available_quantity: 5 }, pallet: { quantity: 5, available_quantity: 5 } });

    await expect(confirmPickTask("pick-task-1", "A-01-01", "PBC-1", 6)).rejects.toThrow("only 5 available");
    expect(pickDb.updates).toEqual([]);
    expect(pickDb.rpcs).toEqual([]);
  });

  it("does not close the pick task if the pallet debit fails", async () => {
    seedPick();
    pickDb.updateErrors.pallets = new Error("pallet update denied");

    await expect(confirmPickTask("pick-task-1", "A-01-01", "PBC-1", 10)).rejects.toThrow("pallet update denied");

    expect(pickDb.updates.some((update) => update.table === "pick_tasks")).toBe(false);
    expect(pickDb.rpcs).toEqual([]);
  });
});

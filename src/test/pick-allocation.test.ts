import { describe, expect, it } from "vitest";

import { allocatePickQuantities } from "@/lib/wms-core";

describe("allocatePickQuantities", () => {
  it("splits a pick evenly across two pallets that exactly cover the requested quantity", () => {
    // Product received as 100 units on 2 pallets of 50 each; a pick of 100
    // should be split 50/50 across both pallets instead of trying to take
    // the whole 100 off a single pallet.
    const candidates = [
      { pallet_id: "pallet-1", available_quantity: 50 },
      { pallet_id: "pallet-2", available_quantity: 50 },
    ];

    const { allocations, short } = allocatePickQuantities(candidates, 100);

    expect(short).toBe(0);
    expect(allocations).toEqual([
      { pallet_id: "pallet-1", available_quantity: 50, allocated_quantity: 50 },
      { pallet_id: "pallet-2", available_quantity: 50, allocated_quantity: 50 },
    ]);
  });

  it("clips allocation to the remaining need instead of taking a pallet's full available quantity", () => {
    // Two pallets of 60 each, but only 100 units are needed. The first
    // pallet should be fully consumed (60) and the second only partially
    // (40) — the second pallet should keep 20 units available for other
    // orders instead of being over-allocated to 60.
    const candidates = [
      { pallet_id: "pallet-1", available_quantity: 60 },
      { pallet_id: "pallet-2", available_quantity: 60 },
    ];

    const { allocations, short } = allocatePickQuantities(candidates, 100);

    expect(short).toBe(0);
    expect(allocations).toEqual([
      { pallet_id: "pallet-1", available_quantity: 60, allocated_quantity: 60 },
      { pallet_id: "pallet-2", available_quantity: 60, allocated_quantity: 40 },
    ]);
  });

  it("stops allocating once the requested quantity is fully covered by earlier pallets", () => {
    // A single pallet with more than enough stock should satisfy the pick
    // on its own; later (e.g. more-expired) pallets should not be touched.
    const candidates = [
      { pallet_id: "pallet-1", available_quantity: 100 },
      { pallet_id: "pallet-2", available_quantity: 50 },
    ];

    const { allocations, short } = allocatePickQuantities(candidates, 60);

    expect(short).toBe(0);
    expect(allocations).toEqual([
      { pallet_id: "pallet-1", available_quantity: 100, allocated_quantity: 60 },
    ]);
  });

  it("splits across three pallets when needed and reports a shortfall if stock runs out", () => {
    const candidates = [
      { pallet_id: "pallet-1", available_quantity: 20 },
      { pallet_id: "pallet-2", available_quantity: 20 },
      { pallet_id: "pallet-3", available_quantity: 20 },
    ];

    const { allocations, short } = allocatePickQuantities(candidates, 100);

    expect(short).toBe(40);
    expect(allocations).toEqual([
      { pallet_id: "pallet-1", available_quantity: 20, allocated_quantity: 20 },
      { pallet_id: "pallet-2", available_quantity: 20, allocated_quantity: 20 },
      { pallet_id: "pallet-3", available_quantity: 20, allocated_quantity: 20 },
    ]);
  });

  it("ignores candidates with zero or null available quantity", () => {
    const candidates = [
      { pallet_id: "pallet-1", available_quantity: 0 },
      { pallet_id: "pallet-2", available_quantity: null as unknown as number },
      { pallet_id: "pallet-3", available_quantity: 30 },
    ];

    const { allocations, short } = allocatePickQuantities(candidates, 30);

    expect(short).toBe(0);
    expect(allocations).toEqual([
      { pallet_id: "pallet-3", available_quantity: 30, allocated_quantity: 30 },
    ]);
  });

  it("returns no allocations when the requested quantity is zero or negative", () => {
    const candidates = [{ pallet_id: "pallet-1", available_quantity: 50 }];

    expect(allocatePickQuantities(candidates, 0)).toEqual({ allocations: [], short: 0 });
    expect(allocatePickQuantities(candidates, -5)).toEqual({ allocations: [], short: 0 });
  });
});

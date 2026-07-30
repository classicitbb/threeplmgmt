import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc, from: vi.fn() },
}));

import { confirmPickTask, PickQuantityAnomalyError } from "@/lib/wms-core";

describe("confirmPickTask", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("commits a normal pick through the transactional database operation", async () => {
    rpc.mockResolvedValue({ data: { confirmed_quantity: 10, source_override: false }, error: null });

    await expect(confirmPickTask("task-1", "WH3-A-1-05-L05-P1", "PBC-1", 10)).resolves.toMatchObject({ confirmed_quantity: 10 });

    expect(rpc).toHaveBeenCalledWith("confirm_pick_task", {
      in_task_id: "task-1",
      in_scanned_location_code: "A-05-L05-P1",
      in_scanned_pallet_barcode: "PBC-1",
      in_confirmed_quantity: 10,
      in_allow_quantity_anomaly: false,
      in_source_override_reason: null,
    });
  });

  it("sends the reason only for the server to validate an alternate source", async () => {
    rpc.mockResolvedValue({ data: { source_override: true, picked_pallet_id: "pallet-2" }, error: null });

    await confirmPickTask("task-1", "A-06-L05-P1", "PBC-2", 10, false, "Directed pallet was inaccessible");

    expect(rpc).toHaveBeenCalledWith("confirm_pick_task", expect.objectContaining({
      in_scanned_location_code: "A-06-L05-P1",
      in_scanned_pallet_barcode: "PBC-2",
      in_source_override_reason: "Directed pallet was inaccessible",
    }));
  });

  it("keeps the quantity-anomaly recovery flow typed for the picker", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "PICK_QTY_ANOMALY: available=6;requested=10" },
    });

    await expect(confirmPickTask("task-1", "A-05-L05-P1", "PBC-1", 10)).rejects.toEqual(
      expect.objectContaining({
        name: "PickQuantityAnomalyError",
        availableQuantity: 6,
        requestedQuantity: 10,
      }),
    );
  });

  it("allows the existing short-pallet recovery only when explicitly confirmed", async () => {
    rpc.mockResolvedValue({ data: { confirmed_quantity: 6, quantity_anomaly_override: true }, error: null });

    await expect(confirmPickTask("task-1", "A-05-L05-P1", "PBC-1", 10, true)).resolves.toMatchObject({ confirmed_quantity: 6 });

    expect(rpc).toHaveBeenCalledWith("confirm_pick_task", expect.objectContaining({
      in_allow_quantity_anomaly: true,
    }));
  });

  it("surfaces server validation failures without attempting client-side inventory writes", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "This pallet is already directed to another active pick task." } });

    await expect(confirmPickTask("task-1", "A-06-L05-P1", "PBC-2", 10, false, "alternate source")).rejects.toThrow(
      "already directed to another active pick task",
    );
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearCycleCountResumeSnapshot,
  clearPickTaskResumeSnapshot,
  clearPutawayResumeSnapshot,
  clearReceivingResumeSnapshot,
  loadCycleCountResumeSnapshot,
  loadPickTaskResumeSnapshot,
  loadPutawayResumeSnapshot,
  loadReceivingResumeSnapshot,
  saveCycleCountResumeSnapshot,
  savePickTaskResumeSnapshot,
  savePutawayResumeSnapshot,
  saveReceivingResumeSnapshot,
} from "@/lib/floor-task-resume";

describe("floor task resume storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips putaway resume state for the same user and warehouse", () => {
    savePutawayResumeSnapshot({
      userId: "user-1",
      warehouseId: "wh-1",
      selectedTaskId: "task-1",
      taskSearch: "PLT-1",
      scanQuery: "PLT-1",
      scanState: {
        "task-1": { pallet: "PLT-1", location: "A1-01", override: false, reason: "" },
      },
      bayScanState: { "task-1": "BAY:WH-1:AMB:A1:01" },
      openTasksExpanded: false,
      updatedAt: 123,
    });

    expect(loadPutawayResumeSnapshot({ userId: "user-1", warehouseId: "wh-1" })?.selectedTaskId).toBe("task-1");
    expect(loadPutawayResumeSnapshot({ userId: "user-2", warehouseId: "wh-1" })).toBeNull();

    clearPutawayResumeSnapshot();
    expect(loadPutawayResumeSnapshot({ userId: "user-1", warehouseId: "wh-1" })).toBeNull();
  });

  it("round-trips pick task resume state per task", () => {
    savePickTaskResumeSnapshot({
      taskId: "pick-task-1",
      pickListId: "pick-list-1",
      locationCode: "A1-01",
      palletBarcode: "PLT-1",
      bayScan: "",
      confirmPrompt: true,
      updatedAt: 456,
    });

    expect(loadPickTaskResumeSnapshot("pick-task-1", "pick-list-1")?.palletBarcode).toBe("PLT-1");

    clearPickTaskResumeSnapshot("pick-task-1", "pick-list-1");
    expect(loadPickTaskResumeSnapshot("pick-task-1", "pick-list-1")).toBeNull();
  });

  it("round-trips receiving resume state per user", () => {
    saveReceivingResumeSnapshot({
      userId: "user-1",
      shipmentEntryMode: "shipment",
      shipmentOpen: true,
      showShipmentMore: true,
      shipmentContainerTouched: true,
      draftSearch: "MSKU1234565",
      printOpen: false,
      printContainer: "",
      selectedDraftIds: [],
      shipmentForm: {
        receipt_type: "po",
        warehouse_id: "wh-1",
        client_id: "client-1",
        container_number: "MSKU1234565",
        po_number: "PO-1",
        reference_number: "PO-1",
        lines: [],
      },
      updatedAt: 789,
    });

    expect(loadReceivingResumeSnapshot({ userId: "user-1" })?.shipmentForm).toEqual(expect.objectContaining({
      container_number: "MSKU1234565",
    }));
    expect(loadReceivingResumeSnapshot({ userId: "user-2" })).toBeNull();

    clearReceivingResumeSnapshot();
    expect(loadReceivingResumeSnapshot({ userId: "user-1" })).toBeNull();
  });

  it("round-trips cycle-count resume state per user", () => {
    saveCycleCountResumeSnapshot({
      userId: "user-1",
      entryQty: { "line-1": "12" },
      exceptionReason: { "line-2": "Blocked access" },
      approvalReason: { "line-3": "Verified variance" },
      updatedAt: 999,
    });

    expect(loadCycleCountResumeSnapshot({ userId: "user-1" })?.entryQty["line-1"]).toBe("12");
    expect(loadCycleCountResumeSnapshot({ userId: "user-2" })).toBeNull();

    clearCycleCountResumeSnapshot();
    expect(loadCycleCountResumeSnapshot({ userId: "user-1" })).toBeNull();
  });
});

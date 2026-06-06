import { describe, expect, it } from "vitest";

import {
  createBlankLocationTemplate,
  createBlankWarehouse,
  createBlankZone,
  createDefaultWarehouseSetupPayload,
  expandLocationRange,
  parseCsv,
  validatePutawayAssignment,
} from "@/lib/wms-core";

describe("parseCsv", () => {
  it("maps header names to row values", () => {
    const rows = parseCsv("sku,name\nSKU-1,Test Product\nSKU-2,Cold Item");

    expect(rows).toEqual([
      { sku: "SKU-1", name: "Test Product" },
      { sku: "SKU-2", name: "Cold Item" },
    ]);
  });
});

describe("validatePutawayAssignment", () => {
  it("blocks cool stock in ambient locations", () => {
    const result = validatePutawayAssignment({
      productTemperature: "cool",
      locationTemperature: "ambient",
      locationStatus: "active",
      locationMaxPallets: 1,
      occupiedPallets: 0,
      mixedSkuAllowed: false,
      hasOtherSku: false,
    });

    expect(result).toEqual({
      valid: false,
      reason: "Cool-chain pallet cannot be placed in a non-cool location",
    });
  });

  it("accepts active compatible empty slots", () => {
    const result = validatePutawayAssignment({
      productTemperature: "ambient",
      locationTemperature: "ambient",
      locationStatus: "active",
      locationMaxPallets: 2,
      occupiedPallets: 1,
      mixedSkuAllowed: true,
      hasOtherSku: true,
    });

    expect(result.valid).toBe(true);
  });
});

describe("createDefaultWarehouseSetupPayload", () => {
  it("returns a fully blank payload so the wizard starts from scratch", () => {
    const payload = createDefaultWarehouseSetupPayload();
    expect(payload).toEqual({ warehouses: [], zones: [], locationTemplates: [] });
  });

  it("blank helpers return empty strings and zero counts", () => {
    expect(createBlankWarehouse()).toEqual({ code: "", name: "", city: "", country: "", hasCoolZone: false });
    const zone = createBlankZone();
    expect(zone.code).toBe("");
    expect(zone.warehouseCode).toBe("");
    expect(zone.temperatureClass).toBe("ambient");
    const tpl = createBlankLocationTemplate();
    expect(tpl.aisleCount).toBe(0);
    expect(tpl.baysPerAisle).toBe(0);
    expect(tpl.levels).toBe(0);
    expect(tpl.positionsPerLevel).toBe(0);
    expect(tpl.depth).toBe(0);
    expect(tpl.locationType).toBe("");
  });
});

describe("expandLocationRange", () => {
  it("produces bays × levels × positions rows with depth as capacity", () => {
    const rows = expandLocationRange({
      prefix: "A",
      startBay: 1,
      endBay: 3,
      levels: 5,
      positionsPerLevel: 3,
      depth: 4,
    });
    expect(rows).toHaveLength(45);
    expect(rows[0].localCode).toBe("A-01-L01-P1");
    expect(rows.at(-1)?.localCode).toBe("A-03-L05-P3");
    expect(rows.every((r) => r.maxPallets === 4 && r.depth === 4)).toBe(true);
  });

  it("clamps positions to 1–3 and levels to 1–6", () => {
    const rows = expandLocationRange({
      prefix: "B",
      startBay: 1,
      endBay: 1,
      levels: 99,
      positionsPerLevel: 99,
      depth: 99,
    });
    expect(rows).toHaveLength(6 * 3);
    expect(rows[0].depth).toBe(5);
  });
});

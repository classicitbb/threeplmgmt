import { describe, expect, it } from "vitest";

import {
  buildBayOccupancyGrid,
  buildRackLocationCode,
  createBlankLocationTemplate,
  createBlankWarehouse,
  createBlankZone,
  createDefaultWarehouseSetupPayload,
  displayRackLocationCode,
  expandLocationRange,
  normalizeRackLocationCode,
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

  it("substitutes level numbers for letters when levelStyle is 'letters'", () => {
    const rows = expandLocationRange({
      prefix: "A",
      startBay: 1,
      endBay: 1,
      levels: 3,
      positionsPerLevel: 2,
      depth: 1,
      levelStyle: "letters",
    });
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.localCode)).toEqual([
      "A-01-A-P1",
      "A-01-A-P2",
      "A-01-B-P1",
      "A-01-B-P2",
      "A-01-C-P1",
      "A-01-C-P2",
    ]);
  });
});

describe("rack location codes", () => {
  it("builds and normalizes four-code rack labels", () => {
    expect(buildRackLocationCode({ rack: "A", aisle: 1, bay: 5, level: 5, position: 1 })).toBe("A-05-L05-P1");
    expect(normalizeRackLocationCode("WH3-A-1-05-L05-P1")).toBe("A-05-L05-P1");
  });

  it("shortens rack location display labels without uppercasing non-rack labels", () => {
    expect(displayRackLocationCode("WH3-A-1-01-L05-P2")).toBe("A-01-L05-P2");
    expect(displayRackLocationCode("Receiving")).toBe("Receiving");
  });
});

describe("buildBayOccupancyGrid", () => {
  it("orders levels bottom-up physically with P1/P2/P3 left to right", () => {
    const cells = [
      "A-01-L01-P3",
      "A-01-L03-P2",
      "A-01-L04-P1",
      "A-01-L02-P3",
      "A-01-L01-P1",
      "A-01-L04-P3",
      "A-01-L02-P1",
      "A-01-L03-P1",
      "A-01-L04-P2",
      "A-01-L01-P2",
      "A-01-L02-P2",
      "A-01-L03-P3",
    ].map((locationCode, index) => ({
      locationId: `loc-${index}`,
      locationCode,
      level: locationCode.match(/L(\d+)/)?.[1] ?? null,
      position: null,
      depth: 4,
      maxPallets: 4,
      occupiedPallets: 0,
      status: "active",
      isFull: false,
    }));

    const grid = buildBayOccupancyGrid(cells);
    const renderedCodes = grid.map((row) => row.map((slot) => slot.cell?.locationCode ?? null));

    expect(renderedCodes).toEqual([
      ["A-01-L04-P1", "A-01-L04-P2", "A-01-L04-P3"],
      ["A-01-L03-P1", "A-01-L03-P2", "A-01-L03-P3"],
      ["A-01-L02-P1", "A-01-L02-P2", "A-01-L02-P3"],
      ["A-01-L01-P1", "A-01-L01-P2", "A-01-L01-P3"],
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { parseCsv, validatePutawayAssignment } from "@/lib/wms-core";

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

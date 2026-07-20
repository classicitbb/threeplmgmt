// IMPORTANT: This is a Deno-side copy of `buildNetSuiteInventoryAdjustment`
// from `src/lib/enterprise-wms.ts`. Deno edge functions cannot import from
// `src/lib`, so we keep a duplicate here. If you change one, change the other
// so the payload shape stays byte-for-byte identical.

export function buildNetSuiteInventoryAdjustment(input: {
  accountId: string;
  sku: string;
  locationExternalId: string;
  quantityDelta: number;
  memo: string;
}) {
  return {
    accountId: input.accountId,
    recordType: "inventoryAdjustment",
    body: {
      memo: input.memo,
      subsidiary: { id: "1" },
    },
    inventory: {
      items: [
        {
          item: { externalId: input.sku },
          location: { externalId: input.locationExternalId },
          adjustQtyBy: input.quantityDelta,
        },
      ],
    },
    idempotencyKey: `netsuite-adjustment-${input.sku}-${input.locationExternalId}-${input.quantityDelta}`,
  };
}
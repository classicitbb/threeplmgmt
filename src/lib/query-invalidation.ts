import type { QueryClient } from "@tanstack/react-query";

const warehouseDataQueryKeys = [
  ["dashboard-metrics"],
  ["inventory-search"],
  ["putaway-tasks"],
  ["pick-lists"],
  ["transfers"],
  ["cycle-counts"],
  ["move-tasks"],
  ["status-pallets"],
  ["reports"],
  ["warehouses"],
  ["zones"],
  ["locations"],
  ["clients"],
  ["products"],
  ["product_packaging_profiles"],
  ["options"],
] as const;

export async function invalidateWarehouseData(queryClient: QueryClient) {
  await Promise.all(
    warehouseDataQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey: [...queryKey] }),
    ),
  );
}

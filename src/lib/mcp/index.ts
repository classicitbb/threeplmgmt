import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWarehousesTool from "./tools/list-warehouses";
import searchProductsTool from "./tools/search-products";
import inventorySummaryTool from "./tools/inventory-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "warehouse-wizard-mcp",
  title: "Warehouse Wizard MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Warehouse Wizard WMS. Use `list_warehouses` to see warehouses, `search_products` to find a product by SKU/barcode/name, and `inventory_summary` to see on-hand quantities per warehouse/location for a product. All calls act as the signed-in user under the app's RLS policies.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWarehousesTool, searchProductsTool, inventorySummaryTool],
});
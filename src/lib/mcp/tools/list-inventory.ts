import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_inventory",
  title: "List inventory balances",
  description:
    "List inventory balances for the signed-in user's warehouses. Optionally filter by product SKU or warehouse code.",
  inputSchema: {
    sku: z.string().trim().optional().describe("Product SKU to filter by (partial match)."),
    warehouseCode: z.string().trim().optional().describe("Warehouse code to filter by."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sku, warehouseCode, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("inventory_balances")
      .select("id, product_sku, product_name, quantity, warehouse_code, location_code, lot_number, expiry_date")
      .limit(limit ?? 50);
    if (sku) q = q.ilike("product_sku", `%${sku}%`);
    if (warehouseCode) q = q.eq("warehouse_code", warehouseCode);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
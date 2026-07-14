import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "inventory_summary",
  title: "Inventory summary for a product",
  description:
    "Return current inventory balances (quantity, available, reserved) for a product by SKU, across visible warehouses and locations.",
  inputSchema: {
    sku: z.string().trim().min(1).describe("Exact product SKU to look up."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sku, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data: product, error: prodErr } = await sb
      .from("products")
      .select("id, sku, name")
      .eq("sku", sku)
      .maybeSingle();
    if (prodErr) return { content: [{ type: "text", text: prodErr.message }], isError: true };
    if (!product) return { content: [{ type: "text", text: `No product found with SKU ${sku}` }] };

    const { data, error } = await sb
      .from("inventory_balances")
      .select(
        "id, quantity, available_quantity, reserved_quantity, held_quantity, damaged_quantity, status, expiry_date, warehouses(code, name), locations(code)"
      )
      .eq("product_id", product.id)
      .limit(limit ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = (data ?? []).map((r: any) => ({
      warehouse: r.warehouses?.code ?? null,
      location: r.locations?.code ?? null,
      status: r.status,
      quantity: r.quantity,
      available: r.available_quantity,
      reserved: r.reserved_quantity,
      held: r.held_quantity,
      damaged: r.damaged_quantity,
      expiry_date: r.expiry_date,
    }));
    const total = rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ product, total_quantity: total, rows }, null, 2),
        },
      ],
      structuredContent: { product, total_quantity: total, rows },
    };
  },
});
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

// Inlined (not imported from "@/...") so the Deno bundle stays self-contained.
function escapePostgrestOrValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export default defineTool({
  name: "search_products",
  title: "Search products",
  description: "Search the product catalog by SKU, barcode, or name (case-insensitive substring match).",
  inputSchema: {
    query: z.string().trim().min(1).describe("SKU, barcode, or product name substring."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    // Sanitize the user-supplied query before embedding it in a PostgREST
    // .or() filter — commas/parens/periods in the raw value otherwise change
    // the filter's structure (injection).
    const term = escapePostgrestOrValue(`%${query}%`);
    const { data, error } = await supabaseForUser(ctx)
      .from("products")
      .select("id, sku, barcode, name, description, temperature_requirement, active")
      .or(`sku.ilike.${term},barcode.ilike.${term},name.ilike.${term}`)
      .eq("active", true)
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
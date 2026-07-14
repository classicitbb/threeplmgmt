import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_warehouses",
  title: "List warehouses",
  description: "List warehouses visible to the signed-in user.",
  inputSchema: {
    includeHidden: z.boolean().optional().describe("Include hidden warehouses (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeHidden }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("warehouses")
      .select("id, code, name, city, country, has_cool_zone, active")
      .order("code");
    if (!includeHidden) q = q.eq("is_hidden", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
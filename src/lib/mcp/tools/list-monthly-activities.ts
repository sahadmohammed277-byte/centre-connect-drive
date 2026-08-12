import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_monthly_activities",
  title: "List monthly activities",
  description: "List planned monthly activities (CMEs, camps, meetings) visible to the signed-in user.",
  inputSchema: {
    status: z.string().optional().describe("Filter by status, e.g. planned, completed, cancelled."),
    limit: z.number().int().min(1).max(200).default(50).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let query = supabaseForUser(ctx)
      .from("monthly_activities")
      .select(
        "id, activity_name, activity_date, expected_completion_date, completion_date, location, status, notes, completion_notes, centres(name)",
      )
      .order("activity_date", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status as never);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, activities: data ?? [] },
    };
  },
});

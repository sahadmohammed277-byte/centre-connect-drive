import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export default defineTool({
  name: "list_visits",
  title: "List field visits",
  description:
    "List field visits (doctor, hospital, lab, pharmacy, ambulance, KOL, other) visible to the signed-in user, optionally filtered by date range and visitor type.",
  inputSchema: {
    from: dateSchema.optional().describe("Start visit date (inclusive), YYYY-MM-DD."),
    to: dateSchema.optional().describe("End visit date (inclusive), YYYY-MM-DD."),
    visitor_type: z.string().optional().describe("Filter by visitor type, e.g. doctor, hospital, lab."),
    limit: z.number().int().min(1).max(200).default(50).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, visitor_type, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let query = supabaseForUser(ctx)
      .from("visits")
      .select(
        "id, visit_date, visitor_name, visitor_type, designation, doctor_name, place, purpose, notes, checkin_time, checkout_time, centres(name)",
      )
      .order("visit_date", { ascending: false })
      .limit(limit ?? 50);
    if (from) query = query.gte("visit_date", from);
    if (to) query = query.lte("visit_date", to);
    if (visitor_type) query = query.eq("visitor_type", visitor_type as never);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, visits: data ?? [] },
    };
  },
});

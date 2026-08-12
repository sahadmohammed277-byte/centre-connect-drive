import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export default defineTool({
  name: "list_referrals",
  title: "List referrals",
  description:
    "List patient referrals visible to the signed-in user, optionally filtered by date range and procedure type (CAG/PTCA).",
  inputSchema: {
    from: dateSchema.optional().describe("Start referral date (inclusive), YYYY-MM-DD."),
    to: dateSchema.optional().describe("End referral date (inclusive), YYYY-MM-DD."),
    procedure_type: z.string().optional().describe("Filter by procedure type, e.g. cag or ptca."),
    limit: z.number().int().min(1).max(200).default(50).describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to, procedure_type, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let query = supabaseForUser(ctx)
      .from("referrals")
      .select(
        "id, referral_date, patient_name, patient_count, procedure_type, service_type, hospital_name, referral_centre, referral_received, estimated_value, notes, centres(name)",
      )
      .order("referral_date", { ascending: false })
      .limit(limit ?? 50);
    if (from) query = query.gte("referral_date", from);
    if (to) query = query.lte("referral_date", to);
    if (procedure_type) query = query.eq("procedure_type", procedure_type as never);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    const summary = {
      count: rows.length,
      patients: rows.reduce((n, r: { patient_count?: number | null }) => n + (r.patient_count ?? 0), 0),
      estimated_value: rows.reduce(
        (n, r: { estimated_value?: number | null }) => n + Number(r.estimated_value ?? 0),
        0,
      ),
    };
    return {
      content: [{ type: "text", text: JSON.stringify({ summary, referrals: rows }, null, 2) }],
      structuredContent: { ...summary, referrals: rows },
    };
  },
});

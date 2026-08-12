import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export default defineTool({
  name: "get_activity_summary",
  title: "Get daily activity summary",
  description:
    "Summarise field activity for a date range: working days, total KM travelled, visit counts by type, and referral totals.",
  inputSchema: {
    from: dateSchema.describe("Start date (inclusive), YYYY-MM-DD."),
    to: dateSchema.describe("End date (inclusive), YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from, to }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [checkins, visits, referrals] = await Promise.all([
      supabase
        .from("daily_checkins")
        .select("id, checkin_date, status, total_km, gps_km")
        .gte("checkin_date", from)
        .lte("checkin_date", to),
      supabase.from("visits").select("visitor_type, visit_date").gte("visit_date", from).lte("visit_date", to),
      supabase
        .from("referrals")
        .select("patient_count, procedure_type, estimated_value, referral_date")
        .gte("referral_date", from)
        .lte("referral_date", to),
    ]);
    const error = checkins.error || visits.error || referrals.error;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const visitsByType: Record<string, number> = {};
    for (const v of visits.data ?? []) {
      const key = String((v as { visitor_type: string }).visitor_type);
      visitsByType[key] = (visitsByType[key] ?? 0) + 1;
    }
    const summary = {
      range: { from, to },
      working_days: (checkins.data ?? []).length,
      total_km: (checkins.data ?? []).reduce(
        (n, c: { total_km?: number | null; gps_km?: number | null }) => n + Number(c.total_km ?? c.gps_km ?? 0),
        0,
      ),
      total_visits: (visits.data ?? []).length,
      visits_by_type: visitsByType,
      referrals: (referrals.data ?? []).length,
      referred_patients: (referrals.data ?? []).reduce(
        (n, r: { patient_count?: number | null }) => n + (r.patient_count ?? 0),
        0,
      ),
      cag: (referrals.data ?? []).filter((r: { procedure_type?: string | null }) => r.procedure_type === "cag").length,
      ptca: (referrals.data ?? []).filter((r: { procedure_type?: string | null }) => r.procedure_type === "ptca").length,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});

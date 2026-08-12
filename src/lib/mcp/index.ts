import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listVisitsTool from "./tools/list-visits";
import listReferralsTool from "./tools/list-referrals";
import getActivitySummaryTool from "./tools/get-activity-summary";
import listMonthlyActivitiesTool from "./tools/list-monthly-activities";
import listLeaveRequestsTool from "./tools/list-leave-requests";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "centre-connect-pro",
  title: "Centre Connect Pro",
  version: "0.1.0",
  instructions:
    "Read-only tools for Centre Connect Pro, a referral marketing system for cardiac centre field staff. Use `whoami` for the caller's profile and role, `get_activity_summary` for KM/visit/referral totals over a date range, and the list tools for visits, referrals, monthly activities and leave requests. All data is scoped to what the signed-in user is allowed to see.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    getActivitySummaryTool,
    listVisitsTool,
    listReferralsTool,
    listMonthlyActivitiesTool,
    listLeaveRequestsTool,
  ],
});

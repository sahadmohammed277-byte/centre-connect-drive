import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in user's profile, role and assigned centre.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile, error }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, employee_id, phone, is_active, centre_id, centres(name)")
        .eq("user_id", userId!)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const result = {
      email: ctx.getUserEmail() ?? null,
      profile: profile ?? null,
      roles: (roles ?? []).map((r: { role: string }) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});

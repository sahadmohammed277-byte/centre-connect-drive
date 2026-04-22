import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["admin", "staff"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- AuthN: verify caller JWT ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // ---- AuthZ: must be admin ----
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      console.warn("Non-admin attempted manage-users", { caller: userData.user.id });
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Invalid request body" }, 400);
    }

    const { action, employee_id, full_name, email, password, centre_name, role } = body as Record<string, unknown>;

    if (action === "create_user") {
      // ---- Input validation ----
      if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 255) {
        return json({ error: "Invalid email" }, 400);
      }
      if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        return json({ error: "Password must be 8-128 characters" }, 400);
      }
      if (typeof employee_id !== "string" || employee_id.trim().length === 0 || employee_id.length > 50) {
        return json({ error: "Invalid employee_id" }, 400);
      }
      if (typeof full_name !== "string" || full_name.trim().length === 0 || full_name.length > 100) {
        return json({ error: "Invalid full_name" }, 400);
      }
      const roleValue = (role as string) || "staff";
      if (!VALID_ROLES.includes(roleValue as typeof VALID_ROLES[number])) {
        return json({ error: "Invalid role" }, 400);
      }
      if (centre_name !== undefined && centre_name !== null && (typeof centre_name !== "string" || centre_name.length > 100)) {
        return json({ error: "Invalid centre_name" }, 400);
      }

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { employee_id, full_name },
      });

      if (authError || !authUser?.user) {
        console.error("Auth create error:", authError);
        const safe = authError?.message?.toLowerCase().includes("registered")
          ? "Email already in use"
          : "Failed to create account";
        return json({ error: safe }, 400);
      }

      const userId = authUser.user.id;

      if (typeof centre_name === "string" && centre_name.length > 0) {
        const { data: centre } = await supabaseAdmin
          .from("centres")
          .select("id")
          .eq("name", centre_name)
          .maybeSingle();

        if (centre) {
          await supabaseAdmin
            .from("profiles")
            .update({ centre_id: centre.id })
            .eq("user_id", userId);
        }
      }

      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: roleValue,
      });

      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        action: "create_user",
        user_id: userData.user.id,
        record_id: userId,
        table_name: "auth.users",
        new_values: { employee_id, full_name, email, role: roleValue, centre_name: centre_name ?? null },
      });

      return json({ success: true, user_id: userId });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("manage-users error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

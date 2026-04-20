import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  action:
    | "reset_password"
    | "set_active"
    | "delete_user";
  user_id: string;
  new_password?: string;
  active?: boolean; // for set_active
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claims.claims.sub as string;

    // check admin
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("is_admin", {
      _user_id: callerId,
    });
    if (!isAdmin) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const body: Body = await req.json();
    if (!body?.action || !body?.user_id) {
      return json({ error: "action and user_id required" }, 400);
    }

    if (body.action === "reset_password") {
      if (!body.new_password || body.new_password.length < 6) {
        return json({ error: "비밀번호는 6자 이상이어야 합니다" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password: body.new_password,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === "set_active") {
      const active = body.active !== false;
      // ban_duration: "none" 해제, "876000h" (~100년) 차단
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        ban_duration: active ? "none" : "876000h",
      });
      if (error) return json({ error: error.message }, 400);
      // profiles.status 동기화
      await admin.from("profiles").update({
        status: active ? "active" : "resigned",
      }).eq("user_id", body.user_id);
      return json({ ok: true });
    }

    if (body.action === "delete_user") {
      if (body.user_id === callerId) {
        return json({ error: "본인 계정은 삭제할 수 없습니다" }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

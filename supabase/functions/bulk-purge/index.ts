// supabase/functions/bulk-purge/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_TABLES = new Set([
  "sales",
  "inquiries",
  "profiles",
  "device_inventory",
  "ad_spend",
  "regulars",
]);

const ALLOWED_OPS = new Set(["eq", "gte", "lte", "in"]);

interface FilterDef {
  column: string;
  op: "eq" | "gte" | "lte" | "in";
  value: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) JWT 검증 + admin 권한 확인
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRow, error: roleErr } = await admin.rpc("is_admin", {
      _user_id: userData.user.id,
    });
    if (roleErr || isAdminRow !== true) {
      return new Response(JSON.stringify({ error: "admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) 입력 검증
    const body = await req.json();
    const table: string = body?.table;
    const filters: FilterDef[] = body?.filters ?? [];

    if (!ALLOWED_TABLES.has(table)) {
      return new Response(JSON.stringify({ error: "table not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(filters) || filters.length === 0) {
      return new Response(JSON.stringify({ error: "filters required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    for (const f of filters) {
      if (!ALLOWED_OPS.has(f.op) || typeof f.column !== "string" || !/^[a-z_][a-z0-9_]*$/i.test(f.column)) {
        return new Response(JSON.stringify({ error: "invalid filter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) 영향 건수 카운트
    let countQuery: any = admin.from(table).select("*", { count: "exact", head: true });
    for (const f of filters) {
      countQuery = countQuery[f.op](f.column, f.value);
    }
    const { count, error: countErr } = await countQuery;
    if (countErr) {
      return new Response(JSON.stringify({ error: "count failed: " + countErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) 실제 삭제
    let delQuery: any = admin.from(table).delete();
    for (const f of filters) {
      delQuery = delQuery[f.op](f.column, f.value);
    }
    const { error: delErr } = await delQuery;
    if (delErr) {
      return new Response(JSON.stringify({ error: "delete failed: " + delErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, deleted: count ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

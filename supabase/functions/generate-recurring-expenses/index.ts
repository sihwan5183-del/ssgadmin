// Generates ad_spend rows from active recurring_expenses for the current month.
// Idempotent via last_generated_month. Can be invoked manually or via cron on the 1st.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Require authenticated admin caller (or matching CRON_SECRET header for scheduled jobs)
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedCron = req.headers.get("x-cron-secret");
  const isCronCall = !!cronSecret && providedCron === cronSecret;

  if (!isCronCall) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await adminCheck.rpc("is_admin", { _user_id: userRes.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const monthKey = `${yyyy}-${mm}`;

  const { data: templates, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("active", true)
    .eq("auto_register", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let created = 0;
  for (const t of templates ?? []) {
    if (t.last_generated_month === monthKey) continue;
    const day = String(Math.min(28, Math.max(1, Number(t.day_of_month ?? 1)))).padStart(2, "0");
    const spendDate = `${yyyy}-${mm}-${day}`;

    const { error: insErr } = await supabase.from("ad_spend").insert({
      created_by: t.created_by,
      category: "고정지출",
      spend_date: spendDate,
      spend_month: monthKey,
      media: t.expense_type,
      expense_type: t.expense_type,
      amount: Number(t.amount ?? 0),
      campaign: t.vendor ?? null,
      note: (t.note ? t.note + " · " : "") + `[자동등록 ${monthKey}]`,
    });

    if (!insErr) {
      await supabase
        .from("recurring_expenses")
        .update({ last_generated_month: monthKey })
        .eq("id", t.id);
      created += 1;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, month: monthKey, created }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
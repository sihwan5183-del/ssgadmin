import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// KST 기준 오늘 / 내일 YYYY-MM-DD
function kstDate(offsetDays = 0): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offsetDays);
  return kst.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let mode: "d1" | "today" = "d1";
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === "today") mode = "today";
  } catch { /* ignore */ }

  const target = mode === "today" ? kstDate(0) : kstDate(1);
  const labelPrefix = mode === "today" ? "[오늘 일정]" : "[내일 일정]";

  // 해당 날짜에 일정이 있는 활동 조회 (미완료만)
  const { data: activities, error: aerr } = await supabase
    .from("seg_activities")
    .select("id, title, activity_date, activity_time, assignee, created_by")
    .eq("activity_date", target)
    .eq("is_completed", false);

  if (aerr) {
    return new Response(JSON.stringify({ error: aerr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;

  for (const act of activities ?? []) {
    const recipientId = act.assignee || act.created_by;
    if (!recipientId) continue;

    const title = `${labelPrefix} ${act.title ?? "영업 일정"}`;
    const body =
      mode === "today"
        ? `오늘 '${act.title ?? ""}' 일정이 있습니다. 잊지 마세요!`
        : `내일 '${act.title ?? ""}' 일정이 있습니다. 미리 준비하세요!`;
    const url = `/seg/calendar?activity=${act.id}`;

    // 1) 인앱 알림 row
    await supabase.from("notifications").insert({
      recipient_id: recipientId,
      kind: "seg_reminder",
      title,
      message: body,
      link: url,
      metadata: { activity_id: act.id, mode },
    });

    // 2) 푸시 토큰 조회 & 발송
    const { data: tokens } = await supabase
      .from("user_push_tokens")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", recipientId);

    for (const t of tokens ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          JSON.stringify({ title, body, url, tag: `seg-${act.id}-${mode}` }),
        );
        sent++;
        await supabase
          .from("user_push_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", t.id);
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("user_push_tokens").delete().eq("id", t.id);
        }
        console.warn("[push] send failed", status, (e as Error).message);
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, mode, target, activities: activities?.length ?? 0, sent, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const RAW_SUBJECT = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
const VAPID_SUBJECT = RAW_SUBJECT
  ? (RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("http")
      ? RAW_SUBJECT
      : `mailto:${RAW_SUBJECT}`)
  : "mailto:admin@example.com";

let vapidReady = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  }
} catch (e) {
  console.error("[dispatcher] vapid init failed", e);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function kstNow() {
  const now = new Date();
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    date: k.toISOString().slice(0, 10),
    hhmm: `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`,
    weekday: k.getUTCDay(), // 0=Sun
  };
}
function kstDateOffset(off: number) {
  const now = new Date();
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  k.setUTCDate(k.getUTCDate() + off);
  return k.toISOString().slice(0, 10);
}

function fillTpl(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{([^}]+)\}/g, (_m, k) => vars[k.trim()] ?? `{${k}}`);
}

interface Rule {
  id: string;
  rule_key: string;
  label: string;
  trigger_type: string;
  enabled: boolean;
  send_time: string | null;
  weekdays: number[];
  title_template: string;
  body_template: string;
  link: string | null;
  audience: string;
  conditions: Record<string, unknown>;
}

async function getRule(ruleKey: string): Promise<Rule | null> {
  const { data } = await supabase.from("notification_rules").select("*").eq("rule_key", ruleKey).maybeSingle();
  return (data as Rule) ?? null;
}

async function getRecipientUserIds(audience: string, opts?: { user_ids?: string[] }): Promise<string[]> {
  if (opts?.user_ids?.length) return opts.user_ids;
  let q = supabase.from("profiles").select("user_id").eq("push_enabled", true);
  if (audience === "dashboard_only") q = q.eq("show_in_dashboard", true);
  // 기본: active 직원만
  q = q.eq("status", "active");
  const { data } = await q;
  return (data ?? []).map((r) => (r as { user_id: string }).user_id);
}

async function sendToUser(uid: string, title: string, body: string, url: string, kind: string) {
  const { data: prof } = await supabase
    .from("profiles").select("push_enabled, display_name").eq("user_id", uid).maybeSingle();
  if (!prof || (prof as { push_enabled?: boolean }).push_enabled === false) {
    return { sent: 0, failed: 0, blocked: 1 };
  }
  // 인앱 알림
  await supabase.from("notifications").insert({
    recipient_id: uid, kind, title, message: body, link: url, metadata: { auto: true },
  });
  // 푸시
  const { data: tokens } = await supabase
    .from("user_push_tokens").select("id, endpoint, p256dh, auth").eq("user_id", uid);
  let sent = 0, failed = 0;
  for (const t of tokens ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title, body, url, tag: `${kind}-${Date.now()}` }),
      );
      sent++;
      await supabase.from("user_push_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", t.id);
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("user_push_tokens").delete().eq("id", t.id);
      }
      console.warn("[dispatcher] push failed", status, (e as Error).message);
    }
  }
  return { sent, failed, blocked: 0 };
}

async function runRule(rule: Rule, override?: { title?: string; body?: string; user_ids?: string[]; vars?: Record<string, string> }) {
  const totals = { sent: 0, failed: 0, blocked: 0, recipients: 0 };
  const k = kstNow();
  const baseVars: Record<string, string> = {
    "현재시간": k.hhmm,
    "오늘날짜": k.date,
    ...(override?.vars ?? {}),
  };

  if (rule.trigger_type === "seg_d1" || rule.trigger_type === "seg_today") {
    const target = rule.trigger_type === "seg_today" ? k.date : kstDateOffset(1);
    const { data: acts } = await supabase
      .from("seg_activities")
      .select("id, title, assignee, created_by")
      .eq("activity_date", target)
      .eq("is_completed", false);
    for (const a of acts ?? []) {
      const uid = (a as any).assignee || (a as any).created_by;
      if (!uid) continue;
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
      const vars = { ...baseVars, "직원이름": (prof as any)?.display_name ?? "", "활동명": (a as any).title ?? "" };
      const title = fillTpl(rule.title_template, vars);
      const body = fillTpl(rule.body_template, vars);
      const url = rule.link ?? "/seg/calendar";
      const r = await sendToUser(uid, title, body, url, `rule_${rule.rule_key}`);
      totals.sent += r.sent; totals.failed += r.failed; totals.blocked += r.blocked;
      totals.recipients += 1;
    }
  } else if (rule.trigger_type === "sales_zero") {
    const recipients = await getRecipientUserIds(rule.audience);
    // 오늘 sales가 1건 이상인 사용자 제외
    const { data: sales } = await supabase
      .from("sales").select("created_by").eq("open_date", k.date);
    const hasSales = new Set((sales ?? []).map((s: any) => s.created_by));
    const targets = recipients.filter((u) => !hasSales.has(u));
    for (const uid of targets) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
      const vars = { ...baseVars, "직원이름": (prof as any)?.display_name ?? "" };
      const title = fillTpl(rule.title_template, vars);
      const body = fillTpl(rule.body_template, vars);
      const r = await sendToUser(uid, title, body, rule.link ?? "/input", `rule_${rule.rule_key}`);
      totals.sent += r.sent; totals.failed += r.failed; totals.blocked += r.blocked;
      totals.recipients += 1;
    }
  } else {
    // manual / partner_assigned: 명시된 user_ids 또는 audience 기준
    const recipients = await getRecipientUserIds(rule.audience, { user_ids: override?.user_ids });
    for (const uid of recipients) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", uid).maybeSingle();
      const vars = { ...baseVars, "직원이름": (prof as any)?.display_name ?? "" };
      const title = override?.title ?? fillTpl(rule.title_template, vars);
      const body = override?.body ?? fillTpl(rule.body_template, vars);
      const r = await sendToUser(uid, title, body, rule.link ?? "/", `rule_${rule.rule_key}`);
      totals.sent += r.sent; totals.failed += r.failed; totals.blocked += r.blocked;
      totals.recipients += 1;
    }
  }

  await supabase.from("notification_rules").update({ last_run_at: new Date().toISOString() }).eq("id", rule.id);
  return totals;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!vapidReady) {
    return new Response(JSON.stringify({ ok: false, error: "VAPID 미설정" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  let body: {
    mode?: "auto" | "run_rule";
    rule_key?: string;
    title?: string;
    message?: string;
    user_ids?: string[];
    vars?: Record<string, string>;
  } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // 수동 실행 (관리자)
  if (body.mode === "run_rule" && body.rule_key) {
    const rule = await getRule(body.rule_key);
    if (!rule) {
      return new Response(JSON.stringify({ ok: false, error: "rule not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const r = await runRule(rule, {
      title: body.title, body: body.message, user_ids: body.user_ids, vars: body.vars,
    });
    return new Response(JSON.stringify({ ok: true, rule: rule.rule_key, ...r }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // auto: cron이 1분마다 호출. 활성+요일+시간 일치 규칙만 실행
  const k = kstNow();
  const { data: rules } = await supabase
    .from("notification_rules").select("*").eq("enabled", true);
  const results: Record<string, unknown> = { now_kst: k.hhmm, weekday: k.weekday, ran: [] as unknown[] };
  for (const r of (rules ?? []) as Rule[]) {
    if (!r.send_time) continue;
    if (r.send_time.slice(0, 5) !== k.hhmm) continue;
    if (!r.weekdays?.includes(k.weekday)) continue;
    if (r.trigger_type === "manual" || r.trigger_type === "partner_assigned") continue;
    const stat = await runRule(r);
    (results.ran as unknown[]).push({ rule: r.rule_key, ...stat });
  }
  return new Response(JSON.stringify({ ok: true, ...results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const RAW_SUBJECT = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
// VAPID subject 는 반드시 mailto:/https: URL 이어야 함. 이메일만 들어온 경우 자동 보정.
const VAPID_SUBJECT = RAW_SUBJECT
  ? (RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("http")
      ? RAW_SUBJECT
      : `mailto:${RAW_SUBJECT}`)
  : "mailto:admin@example.com";

let vapidReady = false;
let vapidError: string | null = null;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } else {
    vapidError = "VAPID_PUBLIC_KEY 또는 VAPID_PRIVATE_KEY 가 설정되어 있지 않습니다.";
  }
} catch (e) {
  vapidError = `VAPID 설정 오류: ${(e as Error).message}`;
  console.error("[push] vapid init failed", e);
}

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

function kstHHmm(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function runForMode(mode: "d1" | "today") {
  const target = mode === "today" ? kstDate(0) : kstDate(1);
  const labelPrefix = mode === "today" ? "[오늘 일정]" : "[내일 일정]";
  return await dispatch(mode, target, labelPrefix);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!vapidReady) {
    return new Response(
      JSON.stringify({ ok: false, error: vapidError ?? "VAPID 미설정" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: {
    mode?: "d1" | "today" | "auto" | "broadcast";
    title?: string;
    message?: string;
    url?: string;
    user_ids?: string[];
  } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  // 즉시 테스트 발송: 권한을 허용한 모든 구독자(또는 지정 user_ids)에게 즉시 푸시
  if (body.mode === "broadcast") {
    return new Response(
      JSON.stringify({ ok: true, ...(await broadcast(body)) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // auto 모드: app_settings 의 시간과 현재 KST HH:MM 비교
  if (!body.mode || body.mode === "auto") {
    const { data: s } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications.push_schedule")
      .maybeSingle();
    const cfg = (s?.value as { enabled?: boolean; d1_time?: string; today_time?: string }) ?? {};
    if (cfg.enabled === false) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const nowHm = kstHHmm();
    const results: Record<string, unknown> = { now_kst: nowHm };
    if (cfg.d1_time && cfg.d1_time.slice(0, 5) === nowHm) {
      results.d1 = await runForMode("d1");
    }
    if (cfg.today_time && cfg.today_time.slice(0, 5) === nowHm) {
      results.today = await runForMode("today");
    }
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 수동 트리거 (관리자 테스트용)
  const result = await runForMode(body.mode);
  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function dispatch(mode: "d1" | "today", target: string, labelPrefix: string) {

  // 해당 날짜에 일정이 있는 활동 조회 (미완료만)
  const { data: activities, error: aerr } = await supabase
    .from("seg_activities")
    .select("id, title, activity_date, activity_time, assignee, created_by")
    .eq("activity_date", target)
    .eq("is_completed", false);

  if (aerr) {
    return { error: aerr.message };
  }

  let sent = 0, failed = 0;

  for (const act of activities ?? []) {
    const recipientId = act.assignee || act.created_by;
    if (!recipientId) continue;

    // 관리자 알림 수신 토글 체크
    const { data: prof } = await supabase
      .from("profiles")
      .select("push_enabled")
      .eq("user_id", recipientId)
      .maybeSingle();
    if (prof && (prof as { push_enabled?: boolean }).push_enabled === false) {
      continue;
    }

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

  return { mode, target, activities: activities?.length ?? 0, sent, failed };
}

async function broadcast(opts: {
  title?: string;
  message?: string;
  url?: string;
  user_ids?: string[];
}) {
  const title = opts.title || "[시스템 테스트] 알림 수신 확인";
  const body =
    opts.message ||
    "이 메시지가 보인다면 푸시 알림 설정이 정상적으로 완료된 것입니다. 확인해 주셔서 감사합니다.";
  const url = opts.url || "/admin";

  let q = supabase.from("user_push_tokens").select("id, user_id, endpoint, p256dh, auth");
  if (opts.user_ids && opts.user_ids.length > 0) {
    q = q.in("user_id", opts.user_ids);
  }
  const { data: tokens, error } = await q;
  if (error) return { error: error.message, total: 0, sent: 0, failed: 0 };

  // 관리자 토글: push_enabled = false 인 직원 제외
  const allTokens = tokens ?? [];
  const uniqueUids = Array.from(new Set(allTokens.map((t) => t.user_id)));
  const allowed = new Set<string>(uniqueUids);
  if (uniqueUids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, push_enabled")
      .in("user_id", uniqueUids);
    for (const p of profs ?? []) {
      if ((p as { push_enabled?: boolean }).push_enabled === false) {
        allowed.delete((p as { user_id: string }).user_id);
      }
    }
  }
  const filteredTokens = allTokens.filter((t) => allowed.has(t.user_id));
  const blocked = allTokens.length - filteredTokens.length;
  const total = filteredTokens.length;
  let sent = 0, failed = 0;
  const failures: Array<{ user_id: string; reason: string; status?: number }> = [];
  const recipients = new Set<string>();

  for (const t of filteredTokens) {
    try {
      await webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title, body, url, tag: `test-${Date.now()}` }),
      );
      sent++;
      recipients.add(t.user_id);
      await supabase
        .from("user_push_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", t.id);
    } catch (e) {
      failed++;
      const status = (e as { statusCode?: number })?.statusCode;
      let reason = (e as Error).message || "unknown";
      if (status === 410 || status === 404) {
        reason = "구독 만료 또는 알림 권한 차단 (토큰 삭제됨)";
        await supabase.from("user_push_tokens").delete().eq("id", t.id);
      } else if (status === 403) {
        reason = "VAPID 인증 실패";
      } else if (status === 413) {
        reason = "페이로드 크기 초과";
      } else if (status === 429) {
        reason = "푸시 서비스 요청 제한";
      }
      failures.push({ user_id: t.user_id, reason, status });
      console.warn("[push:test] failed", status, reason);
    }
  }

  // 인앱 알림도 함께 (수신자 단위)
  for (const uid of recipients) {
    await supabase.from("notifications").insert({
      recipient_id: uid,
      kind: "system_test",
      title,
      message: body,
      link: url,
      metadata: { test: true, ts: Date.now() },
    });
  }

  return { total, sent, failed, blocked, recipients: recipients.size, failures };
}
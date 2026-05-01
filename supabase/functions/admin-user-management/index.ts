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
    | "reset_password_default"
    | "ensure_super_admin"
    | "send_password_reset_email"
    | "set_status"
    | "approve_user"
    | "update_profile"
    | "set_active"
    | "delete_user"
    | "list_user_emails"
    | "request_magic_link"
    | "consume_magic_link"
    | "admin_issue_magic_link"
    | "verify_trusted_device"
    | "register_trusted_device"
    | "list_trusted_devices"
    | "revoke_trusted_device";
  user_id?: string;
  email?: string;
  password?: string; // for request_magic_link (re-verify)
  new_password?: string;
  active?: boolean;
  token?: string; // raw magic link token / device token
  device_label?: string;
  device_id?: string;
  status?: "active" | "pending" | "suspended" | "leave" | "resigned";
  profile?: {
    display_name?: string;
    phone?: string | null;
    team?: string | null;
    store?: string | null;
    position?: string | null;
    hire_date?: string | null;
  };
  redirect_to?: string;
}

// Web Crypto SHA-256 -> hex
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genToken(len = 32): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body: Body = await req.json().catch(() => ({} as Body));
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    const authHeader = req.headers.get("Authorization");

    // ---------- PUBLIC actions (no JWT required) ----------

    // 1) 비밀번호 1차 검증 + 매직링크 발급 (시뮬레이션)
    if (body.action === "request_magic_link") {
      if (!body.email || !body.password) {
        return json({ error: "이메일/비밀번호 필요" }, 400);
      }
      // sign in to verify password
      const userClient = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signIn, error: signErr } = await userClient.auth
        .signInWithPassword({ email: body.email, password: body.password });
      if (signErr || !signIn.user) {
        await admin.from("auth_attempts").insert({
          email: body.email,
          kind: "password",
          success: false,
          ip,
          user_agent: ua,
          detail: signErr?.message ?? "fail",
        });
        return json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, 401);
      }
      const userId = signIn.user.id;
      // active 체크
      const { data: prof } = await admin.from("profiles").select("status, phone")
        .eq("user_id", userId).maybeSingle();
      if (prof && prof.status !== "active") {
        await admin.auth.signOut().catch(() => {});
        return json({ error: "비활성화된 계정입니다. 관리자에게 문의하세요" }, 403);
      }
      // 즉시 sign out (매직링크 통과 전엔 로그인 X)
      // signInWithPassword는 admin 클라이언트 세션과는 분리되므로 별도 처리 불필요

      // 토큰 발급
      const token = genToken(24);
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      await admin.from("magic_link_tokens").insert({
        user_id: userId,
        token_hash: tokenHash,
        purpose: "login",
        expires_at: expiresAt,
        ip,
        user_agent: ua,
      });
      await admin.from("auth_attempts").insert({
        user_id: userId,
        email: body.email,
        kind: "magic_link_request",
        success: true,
        ip,
        user_agent: ua,
      });
      return json({
        ok: true,
        token,
        expires_at: expiresAt,
        phone_masked: prof?.phone
          ? prof.phone.replace(/(\d{3})\d+(\d{4})/, "$1-****-$2")
          : null,
        display_name: signIn.user.user_metadata?.display_name ?? null,
      });
    }

    // 2) 매직링크 소비 → 실제 세션 발급
    if (body.action === "consume_magic_link") {
      if (!body.token) return json({ error: "token required" }, 400);
      const tokenHash = await sha256Hex(body.token);
      const { data: row } = await admin.from("magic_link_tokens")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (!row) return json({ error: "유효하지 않은 링크입니다" }, 400);
      if (row.used_at) return json({ error: "이미 사용된 링크입니다" }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "만료된 링크입니다 (3분 초과)" }, 400);
      }
      // mark used
      await admin.from("magic_link_tokens").update({ used_at: new Date().toISOString() })
        .eq("id", row.id);
      // 이메일 조회 후 magic-link 생성
      const { data: u } = await admin.auth.admin.getUserById(row.user_id);
      if (!u?.user?.email) return json({ error: "user not found" }, 404);
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: u.user.email,
      });
      if (linkErr) return json({ error: linkErr.message }, 400);
      const props = link.properties;
      await admin.from("auth_attempts").insert({
        user_id: row.user_id,
        kind: "magic_link_consume",
        success: true,
        ip,
        user_agent: ua,
      });
      return json({
        ok: true,
        action_link: props.action_link,
        hashed_token: props.hashed_token,
        verification_type: props.verification_type,
        email: u.user.email,
      });
    }

    // 3) 신뢰기기 검증 → 매직링크 단계 스킵
    if (body.action === "verify_trusted_device") {
      if (!body.email || !body.password || !body.token) {
        return json({ error: "필수 값 누락" }, 400);
      }
      const userClient = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signIn, error: signErr } = await userClient.auth
        .signInWithPassword({ email: body.email, password: body.password });
      if (signErr || !signIn.user) {
        return json({ error: "이메일 또는 비밀번호가 올바르지 않습니다" }, 401);
      }
      const userId = signIn.user.id;
      const tokenHash = await sha256Hex(body.token);
      const { data: dev } = await admin.from("trusted_devices")
        .select("*").eq("token_hash", tokenHash).eq("user_id", userId)
        .maybeSingle();
      if (!dev || new Date(dev.expires_at).getTime() < Date.now()) {
        return json({ trusted: false });
      }
      // 발급
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: body.email,
      });
      if (linkErr) return json({ error: linkErr.message }, 400);
      await admin.from("trusted_devices")
        .update({ last_used_at: new Date().toISOString() }).eq("id", dev.id);
      await admin.from("auth_attempts").insert({
        user_id: userId, kind: "trusted_device", success: true, ip, user_agent: ua,
      });
      return json({
        trusted: true,
        action_link: link.properties.action_link,
        hashed_token: link.properties.hashed_token,
        verification_type: link.properties.verification_type,
        email: body.email,
      });
    }

    // ---------- AUTHENTICATED actions ----------
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const callerId = claims.claims.sub as string;

    // 신뢰기기 등록 (로그인 성공 후 호출)
    if (body.action === "register_trusted_device") {
      const raw = genToken(32);
      const hash = await sha256Hex(raw);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await admin.from("trusted_devices").insert({
        user_id: callerId,
        token_hash: hash,
        device_label: body.device_label ?? "기기",
        user_agent: ua,
        ip,
        expires_at: expiresAt,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, token: raw, expires_at: expiresAt });
    }

    if (body.action === "list_trusted_devices") {
      const target = body.user_id ?? callerId;
      const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: callerId });
      if (target !== callerId && !isAdmin) return json({ error: "Forbidden" }, 403);
      const { data } = await admin.from("trusted_devices")
        .select("id, device_label, user_agent, ip, expires_at, last_used_at, created_at")
        .eq("user_id", target).order("last_used_at", { ascending: false });
      return json({ devices: data ?? [] });
    }

    if (body.action === "revoke_trusted_device") {
      if (!body.device_id) return json({ error: "device_id 필요" }, 400);
      const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: callerId });
      const q = admin.from("trusted_devices").delete().eq("id", body.device_id);
      if (!isAdmin) q.eq("user_id", callerId);
      const { error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- ADMIN-ONLY actions ----------
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: callerId });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    // 전체 사용자 이메일 매핑 (관리 페이지 표시용)
    if (body.action === "list_user_emails") {
      const result: Record<string, string> = {};
      let page = 1;
      // page through up to 10 pages * 200 = 2000 users
      for (let i = 0; i < 10; i++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return json({ error: error.message }, 400);
        for (const u of data.users) {
          if (u.email) result[u.id] = u.email;
        }
        if (data.users.length < 200) break;
        page++;
      }
      return json({ ok: true, emails: result });
    }

    if (body.action === "admin_issue_magic_link") {
      if (!body.user_id) return json({ error: "user_id 필요" }, 400);
      const raw = genToken(24);
      const hash = await sha256Hex(raw);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await admin.from("magic_link_tokens").insert({
        user_id: body.user_id,
        token_hash: hash,
        purpose: "admin_override",
        issued_by: callerId,
        expires_at: expiresAt,
      });
      return json({ ok: true, token: raw, expires_at: expiresAt });
    }

    if (body.action === "reset_password") {
      if (!body.user_id || !body.new_password || body.new_password.length < 6) {
        return json({ error: "비밀번호는 6자 이상이어야 합니다" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password: body.new_password,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // 관리자: 대상 계정 비밀번호를 기본값(123456)으로 초기화
    if (body.action === "reset_password_default") {
      if (!body.user_id) return json({ error: "user_id 필요" }, 400);
      const tempPassword = genToken(16);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        password: tempPassword,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("auth_attempts").insert({
        user_id: body.user_id,
        kind: "password_reset_default",
        success: true,
        ip,
        user_agent: ua,
        detail: `reset by ${callerId}`,
      });
      return json({ ok: true, temp_password: tempPassword });
    }

    // 슈퍼관리자 계정 보장: udak@daum.net 계정 생성/연결 + admin 권한 부여 + active
    if (body.action === "ensure_super_admin") {
      const targetEmail = "udak@daum.net";
      const tempPassword = genToken(16);
      // 기존 검색
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      let target = list.users.find((u) => (u.email ?? "").toLowerCase() === targetEmail);
      if (!target) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: targetEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { display_name: "슈퍼관리자" },
        });
        if (cErr) return json({ error: cErr.message }, 400);
        target = created.user!;
      } else {
        // 비밀번호 강제 초기화 + 이메일 인증
        await admin.auth.admin.updateUserById(target.id, {
          password: tempPassword,
          email_confirm: true,
          ban_duration: "none",
        });
      }
      // admin 권한 부여
      await admin.from("user_roles")
        .upsert({ user_id: target.id, role: "admin" }, { onConflict: "user_id,role" });
      // 프로필 active
      await admin.from("profiles").update({ status: "active", display_name: "슈퍼관리자" })
        .eq("user_id", target.id);
      return json({ ok: true, user_id: target.id, email: targetEmail, temp_password: tempPassword });
    }

    if (body.action === "set_active") {
      if (!body.user_id) return json({ error: "user_id 필요" }, 400);
      const active = body.active !== false;
      const { error } = await admin.auth.admin.updateUserById(body.user_id, {
        ban_duration: active ? "none" : "876000h",
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({
        status: active ? "active" : "resigned",
      }).eq("user_id", body.user_id);
      return json({ ok: true });
    }

    if (body.action === "delete_user") {
      if (!body.user_id) return json({ error: "user_id 필요" }, 400);
      if (body.user_id === callerId) {
        return json({ error: "본인 계정은 삭제할 수 없습니다" }, 400);
      }
      // 관리자(admin) 또는 슈퍼관리자(h860306@naver.com) 만 가능
      const { data: callerUser } = await admin.auth.admin.getUserById(callerId);
      const callerEmail = (callerUser?.user?.email ?? "").toLowerCase();
      const isSuper = callerEmail === "h860306@naver.com";
      // 위에서 isAdmin 으로 통과된 호출만 도달하지만, 명시적 재확인
      if (!isAdmin && !isSuper) {
        return json({ error: "관리자만 계정을 삭제할 수 있습니다" }, 403);
      }
      // 정지/퇴사 상태 계정만 삭제 허용 (활성/대기 계정 보호)
      const { data: targetProf } = await admin
        .from("profiles")
        .select("status")
        .eq("user_id", body.user_id)
        .maybeSingle();
      const targetStatus = (targetProf?.status ?? "").toLowerCase();
      if (!isSuper && targetStatus !== "suspended" && targetStatus !== "resigned") {
        return json({
          error: "정지(suspended) 또는 퇴사(resigned) 상태의 계정만 삭제할 수 있습니다",
        }, 400);
      }
      // 소프트 삭제: 데이터 보존, 로그인 차단, 모든 세션 종료
      const { error: banErr } = await admin.auth.admin.updateUserById(body.user_id, {
        ban_duration: "876000h",
      });
      if (banErr) return json({ error: banErr.message }, 400);
      // 모든 세션 강제 종료
      await admin.auth.admin.signOut(body.user_id, "global").catch(() => {});
      // profile 상태 변경 (resigned + deleted_at 표기)
      const { error: profErr } = await admin.from("profiles").update({
        status: "resigned",
        deleted_at: new Date().toISOString(),
        deleted_by: callerId,
      }).eq("user_id", body.user_id);
      if (profErr) return json({ error: profErr.message }, 400);
      // 활성 세션 테이블 정리
      try { await admin.from("active_sessions").delete().eq("user_id", body.user_id); } catch { /* noop */ }
      await admin.from("auth_attempts").insert({
        user_id: body.user_id,
        kind: "soft_delete",
        success: true,
        ip,
        user_agent: ua,
        detail: `soft-deleted by ${callerId}`,
      });
      return json({ ok: true, soft_deleted: true });
    }

    // 승인 (pending -> active)
    if (body.action === "approve_user") {
      if (!body.user_id) return json({ error: "user_id 필요" }, 400);
      await admin.auth.admin.updateUserById(body.user_id, { ban_duration: "none" });
      const { error } = await admin.from("profiles").update({ status: "active" })
        .eq("user_id", body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // 임의 상태 변경 (active / suspended / leave / resigned / pending)
    if (body.action === "set_status") {
      if (!body.user_id || !body.status) return json({ error: "user_id/status 필요" }, 400);
      const ban = body.status === "active" || body.status === "pending"
        ? "none"
        : "876000h";
      await admin.auth.admin.updateUserById(body.user_id, { ban_duration: ban });
      const { error } = await admin.from("profiles").update({ status: body.status })
        .eq("user_id", body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // 프로필 갱신 (display_name / phone / team / store / position / hire_date)
    if (body.action === "update_profile") {
      if (!body.user_id || !body.profile) return json({ error: "user_id/profile 필요" }, 400);
      const p = body.profile;
      const patch: Record<string, unknown> = {};
      for (const k of ["display_name","phone","team","store","position","hire_date"] as const) {
        if (k in p) patch[k] = (p as any)[k];
      }
      const { error } = await admin.from("profiles").update(patch).eq("user_id", body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // 비밀번호 재설정 메일 발송 (Supabase Auth 기본 메일러 사용)
    if (body.action === "send_password_reset_email") {
      if (!body.email) return json({ error: "email 필요" }, 400);
      const { data: link, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: body.email,
        options: body.redirect_to ? { redirectTo: body.redirect_to } : undefined,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, action_link: link.properties.action_link });
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

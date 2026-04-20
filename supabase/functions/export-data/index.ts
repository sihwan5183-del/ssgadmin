// 다운로드 센터 엑셀 생성 엣지 함수
// 카테고리별 데이터를 조회 → xlsx 생성 → exports 버킷 업로드 → download_history 기록 → 알림
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  category: "sales" | "inquiries" | "incentives" | "staff";
  filters?: {
    start_date?: string | null;
    end_date?: string | null;
    manager?: string | null;
    channel?: string | null;
    device_model?: string | null;
    status?: string | null;
  };
  label?: string;
}

const koHeaderSales: Array<[string, string]> = [
  ["seq", "순번"], ["open_date", "개통일"], ["channel", "인입경로"], ["manager", "담당자"],
  ["product", "가입상품"], ["sale_type", "판매유형"], ["status", "상태"],
  ["customer_name", "고객명"], ["phone", "연락처"], ["device_model", "단말기"],
  ["rate_plan", "요금제"], ["unit_price", "단가"], ["vas_fee", "VAS"],
  ["distributor_amount", "유통망"], ["extra_subsidy", "추가지원금"],
  ["cash_support_amount", "현금지원"], ["receivable_amount", "미수금"],
  ["net_fee", "회수마진"], ["approval_status", "검수상태"], ["note", "비고"],
];
const koHeaderInquiries: Array<[string, string]> = [
  ["inquiry_date", "문의일"], ["channel", "인입경로"], ["customer_name", "고객명"],
  ["phone", "연락처"], ["manager", "담당자"], ["status", "상태"],
  ["content", "문의내용"], ["note", "비고"],
];
const koHeaderStaff: Array<[string, string]> = [
  ["display_name", "이름"], ["position", "직책"], ["team", "팀"],
  ["store", "매장"], ["phone", "연락처"], ["status", "상태"],
];
const koHeaderIncentiveDetail: Array<[string, string]> = [
  ["open_date", "개통일"], ["manager", "담당자"], ["customer_name", "고객명"],
  ["product", "가입상품"], ["sale_type", "판매유형"], ["device_model", "단말기"],
  ["incentive_amount", "인센티브(₩)"], ["matched_rules", "매칭규칙"],
];
const koHeaderIncentiveSummary: Array<[string, string]> = [
  ["manager", "담당자"], ["count", "건수"],
  ["total", "총 인센티브(₩)"], ["avg", "평균(₩)"],
];

const buildSheet = (rows: any[], cols: Array<[string, string]>, sheetName: string) => {
  const remapped = rows.map((r) => {
    const o: Record<string, any> = {};
    for (const [k, label] of cols) o[label] = r[k] ?? "";
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(remapped, { header: cols.map(([, l]) => l) });
  ws["!cols"] = cols.map(([k, label]) => {
    const headerLen = label.length * 2;
    const maxBody = rows.reduce((m, r) => Math.max(m, String(r[k] ?? "").length), 0);
    return { wch: Math.min(40, Math.max(headerLen, maxBody) + 2) };
  });
  return { ws, sheetName };
};

const inDate = (d: string | null, from?: string | null, to?: string | null) => {
  if (!from && !to) return true;
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // 사용자 인증 확인
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: ReqBody;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { category, filters = {}, label } = body;
  if (!["sales", "inquiries", "incentives", "staff"].includes(category)) {
    return new Response(JSON.stringify({ error: "Invalid category" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1) 기록 생성 (pending)
  const labelText = label ?? ({
    sales: "판매원장", inquiries: "인입현황", incentives: "인센티브", staff: "직원명단",
  } as Record<string, string>)[category];

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `${labelText}_${stamp}.xlsx`;
  const storagePath = `${userId}/${stamp}_${category}.xlsx`;

  const { data: histRow, error: histErr } = await admin
    .from("download_history")
    .insert({
      user_id: userId, category, label: labelText,
      filters: filters as any, file_name: fileName, status: "pending",
    })
    .select("id").single();
  if (histErr) {
    return new Response(JSON.stringify({ error: histErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const historyId = histRow.id;

  try {
    const wb = XLSX.utils.book_new();
    let rowCount = 0;

    if (category === "sales") {
      let q = admin.from("sales").select("*").order("open_date", { ascending: false }).limit(10000);
      if (filters.start_date) q = q.gte("open_date", filters.start_date);
      if (filters.end_date) q = q.lte("open_date", filters.end_date);
      if (filters.manager) q = q.eq("manager", filters.manager);
      if (filters.channel) q = q.eq("channel", filters.channel);
      if (filters.device_model) q = q.eq("device_model", filters.device_model);
      if (filters.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      rowCount = data?.length ?? 0;
      const { ws, sheetName } = buildSheet(data ?? [], koHeaderSales, "판매원장");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else if (category === "inquiries") {
      let q = admin.from("inquiries").select("*").order("inquiry_date", { ascending: false }).limit(10000);
      if (filters.start_date) q = q.gte("inquiry_date", filters.start_date);
      if (filters.end_date) q = q.lte("inquiry_date", filters.end_date);
      if (filters.channel) q = q.eq("channel", filters.channel);
      if (filters.manager) q = q.eq("manager", filters.manager);
      if (filters.status) q = q.eq("status", filters.status);
      const { data, error } = await q;
      if (error) throw error;
      rowCount = data?.length ?? 0;
      const { ws, sheetName } = buildSheet(data ?? [], koHeaderInquiries, "인입현황");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else if (category === "staff") {
      const { data, error } = await admin.from("profiles").select("*").order("display_name");
      if (error) throw error;
      rowCount = data?.length ?? 0;
      const { ws, sheetName } = buildSheet(data ?? [], koHeaderStaff, "직원명단");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    } else if (category === "incentives") {
      let salesQ = admin.from("sales").select("*").limit(10000);
      if (filters.start_date) salesQ = salesQ.gte("open_date", filters.start_date);
      if (filters.end_date) salesQ = salesQ.lte("open_date", filters.end_date);
      if (filters.manager) salesQ = salesQ.eq("manager", filters.manager);
      const [{ data: sales, error: sErr }, { data: rates, error: rErr }] = await Promise.all([
        salesQ, admin.from("incentive_rates").select("*").eq("active", true),
      ]);
      if (sErr) throw sErr;
      if (rErr) throw rErr;

      const matchOne = (sale: any, rule: any) => {
        if (!inDate(sale.open_date, rule.valid_from, rule.valid_to)) return false;
        if (rule.match_sale_type && rule.match_sale_type !== (sale.sale_type ?? "")) return false;
        if (rule.match_product && rule.match_product !== (sale.product ?? "")) return false;
        if (rule.match_model && rule.match_model !== (sale.device_model ?? "")) return false;
        return true;
      };

      const detail = (sales ?? []).map((s: any) => {
        const matched = (rates ?? []).filter((r: any) => matchOne(s, r));
        const amount = matched.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
        return {
          open_date: s.open_date, manager: s.manager, customer_name: s.customer_name,
          product: s.product, sale_type: s.sale_type, device_model: s.device_model,
          incentive_amount: amount,
          matched_rules: matched.map((r: any) => `${r.label}(₩${r.amount})`).join(" + "),
        };
      });

      const byMgr = new Map<string, { count: number; total: number }>();
      for (const d of detail) {
        const k = d.manager ?? "(미지정)";
        const cur = byMgr.get(k) ?? { count: 0, total: 0 };
        cur.count += 1; cur.total += d.incentive_amount;
        byMgr.set(k, cur);
      }
      const summary = Array.from(byMgr.entries()).map(([manager, v]) => ({
        manager, count: v.count, total: v.total,
        avg: v.count ? Math.round(v.total / v.count) : 0,
      })).sort((a, b) => b.total - a.total);

      rowCount = detail.length;
      const s1 = buildSheet(detail, koHeaderIncentiveDetail, "인센티브 상세");
      const s2 = buildSheet(summary, koHeaderIncentiveSummary, "담당자별 요약");
      XLSX.utils.book_append_sheet(wb, s1.ws, s1.sheetName);
      XLSX.utils.book_append_sheet(wb, s2.ws, s2.sheetName);
    }

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const fileBytes = new Uint8Array(buf);

    // 2) Storage 업로드
    const { error: upErr } = await admin.storage.from("exports").upload(storagePath, fileBytes, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });
    if (upErr) throw upErr;

    // 3) 기록 완료
    await admin.from("download_history").update({
      status: "done", storage_path: storagePath, file_size: fileBytes.byteLength,
      row_count: rowCount, completed_at: new Date().toISOString(),
    }).eq("id", historyId);

    // 4) 알림
    await admin.from("notifications").insert({
      recipient_id: userId, kind: "export_ready",
      title: "엑셀 다운로드 준비 완료",
      message: `${labelText} (${rowCount.toLocaleString()}건) — 다운로드 센터에서 받을 수 있습니다`,
      link: "/downloads",
      metadata: { history_id: historyId, category, file_name: fileName },
    });

    // 서명 URL 1시간
    const { data: signed } = await admin.storage.from("exports").createSignedUrl(storagePath, 3600);

    return new Response(JSON.stringify({
      success: true, history_id: historyId, file_name: fileName,
      row_count: rowCount, signed_url: signed?.signedUrl ?? null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("download_history").update({
      status: "error", error_message: msg, completed_at: new Date().toISOString(),
    }).eq("id", historyId);
    return new Response(JSON.stringify({ error: msg, history_id: historyId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

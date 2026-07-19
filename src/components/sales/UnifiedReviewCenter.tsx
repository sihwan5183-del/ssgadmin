import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, ShieldCheck, AlertTriangle, Sparkles, Edit3, ListChecks,
  CheckCircle2, AlertCircle, RefreshCw, Phone, User, Smartphone, Calendar,
} from "lucide-react";
import { ReviewerPanel } from "./ReviewerPanel";
import { toast } from "sonner";
import { SaleEditForm } from "./SaleEditForm";

type ApprovalStatus =
  | "승인대기"
  | "검수완료"
  | "확정"
  | "반려"
  | "수정요청"
  | "환수"
  | "취소";

interface Row {
  id: string;
  created_by: string;
  customer_name: string | null;
  phone: string | null;
  device_serial: string | null;
  device_model: string | null;
  channel: string | null;
  product: string | null;
  rate_plan: string | null;
  sale_type: string | null;
  status: string | null;
  open_date: string | null;
  manager: string | null;
  unit_price: number | null;
  approval_status: ApprovalStatus | null;
  re_review_requested_at: string | null;
  revision_fields: string[] | null;
  revision_reason: string | null;
  revision_requested_at: string | null;
  approved_at: string | null;
  pending_items: string[] | null;
  pending_note: string | null;
  pending_resolved: boolean | null;
  custom_fields: Record<string, any> | null;
  is_suspicious: boolean | null;
  suspicious_reason: string | null;
}

const SELECT_COLS =
  "id, created_by, customer_name, phone, device_serial, device_model, channel, product, rate_plan, sale_type, status, open_date, manager, unit_price, approval_status, re_review_requested_at, revision_fields, revision_reason, revision_requested_at, approved_at, pending_items, pending_note, pending_resolved, custom_fields, is_suspicious, suspicious_reason";

const isHomeProduct = (product: string | null | undefined) =>
  /홈|인터넷|TV|IOT|스마트홈/i.test((product ?? "").toString());
const completionStatusFor = (product: string | null | undefined) =>
  isHomeProduct(product) ? "설치완료" : "개통완료";

// 라벨 분류: 수정완료(주황) / 신규(파랑) / 검수보류(빨강) / 일반
type Bucket = "revised" | "new" | "hold" | "normal";
const bucketOf = (r: Row): Bucket => {
  // 수정완료: 작성자가 재검수 요청
  if (r.re_review_requested_at) return "revised";
  // 검수보류: 반려/수정요청/이상영업/비정상
  if (
    r.approval_status === "반려" ||
    r.approval_status === "수정요청" ||
    r.is_suspicious ||
    (r.custom_fields?.final_verdict === "비정상")
  ) return "hold";
  // 신규: 승인대기 (재검수 요청 아님)
  if (r.approval_status === "승인대기") return "new";
  return "normal";
};

const BUCKET_BADGE: Record<Bucket, { label: string; cls: string }> = {
  revised: { label: "수정완료", cls: "border-orange-400 text-orange-700 bg-orange-50 dark:bg-orange-500/15 dark:text-orange-200" },
  new:     { label: "신규",     cls: "border-sky-400 text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-200" },
  hold:    { label: "검수보류", cls: "border-destructive/50 text-destructive bg-destructive/10" },
  normal:  { label: "검수중",   cls: "border-border/60 text-muted-foreground bg-muted/30" },
};

const SORT_RANK: Record<Bucket, number> = { revised: 0, new: 1, hold: 2, normal: 3 };

export function UnifiedReviewCenter() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { startDate, endDate, label } = usePeriod();
  const [searchParams] = useSearchParams();
  const showAll = searchParams.get("view") === "all";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // showAll(=대시보드 [개통 대기] 클릭 진입) 시: 상태 무관 전체 실적 노출
    // 기본: 종결(개통완료/설치완료) 제외 — 검수가 필요한 건들만
    let query = supabase
      .from("sales")
      .select(SELECT_COLS)
      .order("open_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (showAll) {
      // 개통일이 기간 내이거나, 개통일 미정이지만 등록일이 기간 내인 모든 건
      query = query.or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      );
    } else {
      query = query.gte("open_date", startDate).lte("open_date", endDate);
    }
    let data: Row[];
    try {
      data = await fetchAllRows<Row>(({ from, to }) => query.range(from, to));
    } catch (error: any) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    setLoading(false);
    const list = data;
    const filtered = showAll
      ? list.filter((r) => (r.status ?? "").trim() !== "취소") // 취소만 제외
      : list.filter((r) => {
          const s = (r.status ?? "").replace(/\s+/g, "").trim();
          return s !== "개통완료" && s !== "설치완료";
        });
    setRows(filtered);
  }, [startDate, endDate, showAll]);

  useEffect(() => { load(); }, [load]);

  // realtime 갱신
  useEffect(() => {
    const ch = supabase
      .channel("unified-review-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term
      ? rows.filter((r) =>
          [r.customer_name, r.phone, r.device_serial, r.device_model, r.channel, r.product, r.manager]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
        )
      : rows;
    // 정렬: 수정완료 → 신규 → 검수보류 → 일반, 같은 그룹은 최신순
    return [...list].sort((a, b) => {
      const ra = SORT_RANK[bucketOf(a)];
      const rb = SORT_RANK[bucketOf(b)];
      if (ra !== rb) return ra - rb;
      return (b.open_date ?? "").localeCompare(a.open_date ?? "");
    });
  }, [rows, q]);

  // 첫 진입 시 자동 선택
  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
    // 선택된 건이 리스트에서 사라지면 다음 건 자동 선택
    if (selectedId && !filtered.some((r) => r.id === selectedId) && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
    if (filtered.length === 0) setSelectedId(null);
  }, [filtered, selectedId]);

  const counts = useMemo(() => {
    const c = { revised: 0, new: 0, hold: 0 };
    filtered.forEach((r) => {
      const b = bucketOf(r);
      if (b === "revised") c.revised++;
      else if (b === "new") c.new++;
      else if (b === "hold") c.hold++;
    });
    return c;
  }, [filtered]);

  const selected = filtered.find((r) => r.id === selectedId) ?? null;

  const handleChanged = useCallback(async () => {
    // 변경 후 재조회 (다음 건 자동선택은 위 useEffect가 처리)
    await load();
  }, [load]);

  return (
    <Card className="p-0 glass border-border/40 overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2 flex-wrap bg-muted/30">
        <ShieldCheck className="size-4 text-primary-glow" />
        <h3 className="font-semibold text-sm">
          {showAll ? "전체 실적 입력 리스트" : "통합 검수함"}
        </h3>
        <span className="text-xs text-muted-foreground">{label} · 총 {filtered.length}건</span>
        {showAll && (
          <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
            상태 필터 해제
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={BUCKET_BADGE.revised.cls}>
            <Sparkles className="size-3 mr-1" /> 수정완료 {counts.revised}
          </Badge>
          <Badge variant="outline" className={BUCKET_BADGE.new.cls}>
            <AlertCircle className="size-3 mr-1" /> 신규 {counts.new}
          </Badge>
          <Badge variant="outline" className={BUCKET_BADGE.hold.cls}>
            <AlertTriangle className="size-3 mr-1" /> 검수보류 {counts.hold}
          </Badge>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => load()}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* 본문 — 좌(40%) / 우(60%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        {/* === 좌측 리스트 === */}
        <div className="border-r border-border/40 flex flex-col max-h-[calc(100vh-220px)]">
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="고객명 · 전화 · IMEI · 모델 · 매체 · 담당…"
                className="h-9 pl-9 bg-input/60"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                🎉 검수 대기 건이 없습니다
              </div>
            ) : (
              filtered.map((r) => {
                const bucket = bucketOf(r);
                const meta = BUCKET_BADGE[bucket];
                const active = r.id === selectedId;
                const suspicious = r.is_suspicious || r.custom_fields?.fraud_suspect;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left px-3 py-2.5 transition-colors border-l-4 ${
                      active
                        ? "bg-primary/10 border-l-primary"
                        : "border-l-transparent hover:bg-muted/40"
                    } ${suspicious ? "bg-yellow-100/70 dark:bg-yellow-500/10" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>
                        {meta.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                        <Calendar className="size-3" />
                        {r.open_date ?? "-"}
                      </span>
                    </div>
                    <div className="text-sm font-medium flex items-center gap-1.5 truncate">
                      <User className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{r.customer_name ?? "(이름없음)"}</span>
                      {suspicious && (
                        <Badge variant="outline" className="text-[9px] border-yellow-500 text-yellow-800 bg-yellow-100">
                          이상영업
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                      <span className="flex items-center gap-1"><Smartphone className="size-3" />{r.device_model ?? "-"}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {r.channel ?? "-"} · {r.product ?? "-"} · {r.manager ?? "-"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* === 우측 검수 패널 === */}
        <div className="p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
          {!selected ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground py-20">
              <div className="text-center">
                <ListChecks className="size-10 mx-auto mb-2 opacity-40" />
                좌측 리스트에서 검수할 실적을 선택하세요
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 flex items-center gap-3 flex-wrap">
                <div className="text-sm">
                  <span className="font-semibold">{selected.customer_name ?? "(이름없음)"}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {selected.product ?? "-"} · {selected.rate_plan ?? "-"} · {selected.device_model ?? "-"}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Badge variant="outline" className={`text-[10px] ${BUCKET_BADGE[bucketOf(selected)].cls}`}>
                    {BUCKET_BADGE[bucketOf(selected)].label}
                  </Badge>
                </div>
              </div>
              {/* 실적 입력창과 동일한 UX — 검수자가 즉시 수정/저장 가능 */}
              <SaleEditForm
                key={`form-${selected.id}`}
                saleId={selected.id}
                embedded
                onSaved={() => handleChanged()}
              />
              {/* 검수 및 메모 — 전폭 레이아웃 */}
              <div className="w-full">
              <ReviewerPanel
                key={selected.id}
                sale={{
                  id: selected.id,
                  created_by: selected.created_by,
                  customer_name: selected.customer_name,
                  approval_status: selected.approval_status,
                  revision_fields: selected.revision_fields,
                  revision_reason: selected.revision_reason,
                  revision_requested_at: selected.revision_requested_at,
                  re_review_requested_at: selected.re_review_requested_at,
                  approved_at: selected.approved_at,
                  pending_items: selected.pending_items,
                  pending_note: selected.pending_note,
                  pending_resolved: selected.pending_resolved,
                  product: selected.product,
                  status: selected.status,
                  custom_fields: selected.custom_fields,
                  rate_plan: selected.rate_plan,
                  device_model: selected.device_model,
                  unit_price: selected.unit_price,
                  sale_type: selected.sale_type,
                  is_suspicious: selected.is_suspicious,
                  suspicious_reason: selected.suspicious_reason,
                }}
                onChanged={handleChanged}
              />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
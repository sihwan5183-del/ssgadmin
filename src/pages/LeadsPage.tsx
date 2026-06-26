import { lazy, memo, startTransition, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, PhoneCall, CheckCircle2, Plus, Search, RotateCw, Ban, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Trash2 } from "lucide-react";
import { formatPhone } from "@/lib/phoneFormat";
import { logLeadStatusChange } from "@/services/workReport/activityLogService";
// 무거운(1k+ LOC) 페이지 — 사용자가 [기타인입] 탭을 처음 클릭할 때만 로드해서
// 메타/도그마루 탭의 초기 진입과 탭 전환 응답성을 잡아준다.
const ChannelIntakePage = lazy(() => import("@/pages/ChannelIntakePage"));
// ─── 모바일 영업 전용 뷰 ───────────────────────────────────────────────────
const MOBILE_STATUS_META = [
  { value: "신규 접수", label: "신규 접수", color: "bg-blue-100 text-blue-700" },
  { value: "케어중", label: "케어중", color: "bg-yellow-100 text-yellow-700" },
  { value: "부재 중", label: "부재 중", color: "bg-orange-100 text-orange-700" },
  { value: "재케어", label: "재케어", color: "bg-purple-100 text-purple-700" },
  { value: "취소", label: "취소", color: "bg-gray-100 text-gray-600" },
  { value: "개통 완료", label: "개통 완료", color: "bg-emerald-100 text-emerald-700" },
];
const MOBILE_STATUS_DOGMARU = [
  { value: "신규 접수", label: "신규 접수", color: "bg-blue-100 text-blue-700" },
  { value: "상담중", label: "상담중", color: "bg-yellow-100 text-yellow-700" },
  { value: "부재케어", label: "부재케어", color: "bg-orange-100 text-orange-700" },
  { value: "재케어", label: "재케어", color: "bg-purple-100 text-purple-700" },
  { value: "실패", label: "실패", color: "bg-red-100 text-red-700" },
  { value: "개통철회", label: "개통철회", color: "bg-rose-100 text-rose-700" },
  { value: "기타", label: "기타", color: "bg-gray-100 text-gray-600" },
  { value: "개통완료", label: "개통완료", color: "bg-emerald-100 text-emerald-700" },
];
const MOBILE_STATUS_UDAK = [
  { value: "신규 접수", label: "신규 접수", color: "bg-blue-100 text-blue-700" },
  { value: "성공", label: "성공", color: "bg-emerald-100 text-emerald-700" },
  { value: "실패", label: "실패", color: "bg-red-100 text-red-700" },
  { value: "부재케어", label: "부재케어", color: "bg-orange-100 text-orange-700" },
  { value: "재케어", label: "재케어", color: "bg-purple-100 text-purple-700" },
  { value: "택배발송", label: "택배발송", color: "bg-sky-100 text-sky-700" },
  { value: "개통완료", label: "개통완료", color: "bg-emerald-100 text-emerald-700" },
];
// 호환용
const MOBILE_STATUS_OPTIONS = MOBILE_STATUS_META;

const ABSENCE_REASONS = ["통화중", "부재"];
const RECARE_REASONS = ["가격 재상담", "기기 미정", "타사 비교중", "시기 조율", "가족 상의", "기타"];
const FAIL_REASONS = ["가격", "재고", "개통시기", "기타"];
const DOGMARU_CAMPAIGN = "도그마루_홈캠";

// ── 도그마루 상태 분류 함수 (PC/모바일 공통) ──
// 구글시트 최신값 기준으로 매번 해석 - status 컬럼 신뢰하지 않음
function getDogmaruTab(r: any): string {
  const manualStatus = String(r.status ?? "").trim();
  const activationStatus = String(r.activation_status ?? "").trim();
  const cancellationStatus = String(r.cancellation_status ?? "").trim();
  const memo = String(r.memo ?? "").trim();
  const activationNumber = String(r.activation_number ?? "").trim();

  // 담당자가 수동으로 바꾼 status 최우선 반영 (신규 접수 제외)
  const MANUAL_STATUSES = ["개통완료","개통철회","부재케어","재케어","실패","기타","청약대기","택배발송"];
  if (manualStatus && MANUAL_STATUSES.includes(manualStatus)) return manualStatus;

  // 시트에서 넘어온 값들 기준
  const text = [activationStatus, cancellationStatus, memo].join(" ");
  const hasAny = (keywords: string[]) => keywords.some(k => text.includes(k));

  // 1. 개통철회
  if (hasAny(["철회","개통철회","고객철회","해지","취소","취소요청","취소 요청","취소완료","반납","철거"])) return "개통철회";

  // 2. 실패
  if (hasAny(["개통불가","불가","실패","거절","진행불가","미진행","포기"])) return "실패";

  // 3. 부재케어
  if (hasAny(["부재","부재중","통화중","연락안됨","미응답","연락두절"])) return "부재케어";

  // 4. 재케어
  if (hasAny(["신분증","신분증첨부필요","첨부필요","미납","보류","확인필요","확인 필요","고객요청","재상담","검토","추후","나중","재연락"])) return "재케어";

  // 5. 완료 - "개통완료" 포함 (단, 택배/배송/기사출동신청완료는 완료 아님)
  const deliveryKeywords = ["택배신청완료","배송신청완료","기사출동신청완료","기사 출동신청완료"];
  const isDeliveryComplete = deliveryKeywords.some(k => text.includes(k));
  if (!isDeliveryComplete && text.includes("개통완료")) return "완료";

  // 6. 택배발송 - 택배/배송/발송/기사출동 관련
  if (hasAny(["택배","배송","발송","기사출동","기사 출동"])) return "택배발송";

  // 7. 청약대기 - 가입번호 있음
  if (activationNumber) return "청약대기";

  // 8. 기타 - 값은 있으나 위 조건 안 걸림
  if (text.trim()) return "기타";

  // 9. 신규접수
  return "신규 접수";
}

function MobileLeadsView({
  rows, loading, sourceTab, setSourceTab, search, setSearch, updateStatus, updateAssignee, adjustAbsenceCount, staff, onSwitchToFull, saveHappyCall
}: {
  rows: Lead[];
  loading: boolean;
  sourceTab: "meta" | "dogmaru" | "udak" | "other";
  setSourceTab: (t: "meta" | "dogmaru" | "udak" | "other") => void;
  search: string;
  setSearch: (s: string) => void;
  updateStatus: (id: string, status: string) => Promise<void>;
  updateAssignee: (id: string, assigned_to: string | null) => Promise<void>;
  adjustAbsenceCount: (lead: Lead, delta: number) => Promise<void>;
  staff: { user_id: string; display_name: string }[];
  onSwitchToFull: () => void;
  saveHappyCall: (lead: Lead, happy_call: string | null, happy_call_result: string | null) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [absenceModal, setAbsenceModal] = useState<Lead | null>(null);
  const [recareModal, setRecareModal] = useState<Lead | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [careTab, setCareTab] = useState<"all" | "new" | "absence" | "recare" | "fail" | "complete" | "delivery" | "subscribe" | "pending" | "care" | "cancel" | "complete_meta" | "withdraw" | "etc" | "happy_call" | "happy_call_result" | "recare4happy">("all");
  const [completePage, setCompletePage] = useState(0);
  const COMPLETE_PAGE_SIZE = 50;
  const [completeSearch, setCompleteSearch] = useState("");
  const [memoLead, setMemoLead] = useState<Lead | null>(null);
  const [happyCallSaving, setHappyCallSaving] = useState(false);
  const [memoDraft, setMemoDraft] = useState("");
  const [memoSaving, setMemoSaving] = useState(false);
  const [failModal, setFailModal] = useState<Lead | null>(null);
  const [failReason, setFailReason] = useState("");
  const [failMemo, setFailMemo] = useState("");

  useEffect(() => {
    supabase.from("sms_templates").select("*").eq("active", true)
      .then(({ data }) => setTemplates(data ?? []));
  }, []);

  // 탭 전환시 케어탭 리셋
  useEffect(() => { setCareTab("all"); }, [sourceTab]);

  // 도그마루 완료건 판단
  // 도그마루 건 하나를 정확히 하나의 탭으로 분류하는 단일 함수 (모바일용)
  function getDogmaruTabMobile(r: any): string {
    return getDogmaruTab(r);
  }

  // 탭별 필터 (메타/도그마루 완전 분리)
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
      const isUdak = r.channel === "유닥";
      if (sourceTab === "dogmaru" && !isDogmaru) return false;
      if (sourceTab === "meta" && (isDogmaru || isUdak)) return false;
      if (sourceTab === "udak" && !isUdak) return false;
      if (sourceTab === "other" && (isDogmaru || isUdak)) return false;
      // 도그마루: 단일 분류 함수로 정확히 하나의 탭에만 배치
      if (isDogmaru) {
        const tab = getDogmaruTabMobile(r);
        if (careTab === "all") { /* 전체 통과 */ }
        else if (careTab === "new" && tab !== "신규 접수") return false;
        else if (careTab === "absence" && tab !== "부재케어") return false;
        else if (careTab === "recare" && tab !== "재케어") return false;
        else if (careTab === "fail" && tab !== "실패") return false;
        else if (careTab === "withdraw" && tab !== "개통철회") return false;
        else if (careTab === "etc" && tab !== "기타") return false;
        else if (careTab === "pending" && tab !== "개통대기") return false;
        else if (careTab === "delivery" && tab !== "택배발송") return false;
        else if (careTab === "subscribe" && tab !== "청약대기") return false;
        else if (careTab === "complete" && tab !== "완료") return false;
      } else {
        if (careTab === "new" && r.status !== "신규 접수") return false;
        if (careTab === "absence" && r.status !== "부재 중") return false;
        if (careTab === "recare" && r.status !== "재케어") return false;
        if (careTab === "care" && r.status !== "케어중") return false;
        if (careTab === "cancel" && r.status !== "취소") return false;
        if (careTab === "complete_meta" && r.status !== "개통 완료") return false;
      }
      // 검색
      if (search) {
        const s = search.toLowerCase();
        return (r.customer_name ?? r.name ?? "").toLowerCase().includes(s) ||
               (r.customer_phone ?? r.phone ?? "").includes(s);
      }
      return true;
    });
  }, [rows, sourceTab, search, careTab]);

  // 탭별 카운트
  const isUdakRow = (r: Lead) => r.channel === "유닥";
  const metaCount = rows.filter(r => !isUdakRow(r) && r.campaign_name && r.campaign_name !== DOGMARU_CAMPAIGN).length;
  const dogmaruCount = rows.filter(r => r.campaign_name === DOGMARU_CAMPAIGN).length;
  const udakCount = rows.filter(r => isUdakRow(r)).length;

  // 현재 탭 내 케어 카운트
  const tabRows = useMemo(() => rows.filter(r => {
    const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
    if (sourceTab === "dogmaru") return isDogmaru;
    if (sourceTab === "udak") return isUdakRow(r);
    if (sourceTab === "meta") return !isDogmaru && !isUdakRow(r);
    return !isDogmaru && !isUdakRow(r);
  }), [rows, sourceTab]);
  // 도그마루 탭 카운트: effectiveStatus 기준 (DB status 우선, 없으면 memo 자동분류, 둘 다 없으면 신규 접수)
  const completeCount = tabRows.filter(r => getDogmaruTabMobile(r) === "완료").length;
  const pendingCount = tabRows.filter(r => getDogmaruTabMobile(r) === "개통대기").length;
  const deliveryCount = tabRows.filter(r => getDogmaruTabMobile(r) === "택배발송").length;
  const subscribeCount = tabRows.filter(r => getDogmaruTabMobile(r) === "청약대기").length;
  const newCount = sourceTab === "dogmaru"
    ? tabRows.filter(r => getDogmaruTabMobile(r) === "신규 접수").length
    : tabRows.filter(r => r.status === "신규 접수").length;
  const absenceCount = tabRows.filter(r => getDogmaruTabMobile(r) === "부재케어").length;
  const recareCount = tabRows.filter(r => getDogmaruTabMobile(r) === "재케어").length;
  const failCount = tabRows.filter(r => getDogmaruTabMobile(r) === "실패").length;
  // 메타 카운트
  const careCount = tabRows.filter(r => r.status === "케어중").length;
  const absMetaCount = tabRows.filter(r => r.status === "부재 중").length;
  const recareMetaCount = tabRows.filter(r => r.status === "재케어").length;
  const cancelCount = tabRows.filter(r => r.status === "취소").length;
  const completeMetaCount = tabRows.filter(r => r.status === "개통 완료").length;

  async function handleStatus(lead: Lead, status: string) {
    console.log("[Mobile handleStatus START]", {
      leadId: lead.id,
      nextStatus: status,
    });
    setStatusLoading(lead.id + status);
    try {
      await updateStatus(lead.id, status);
    } catch (e) {
      console.warn('[handleStatus] 에러 (무시):', e);
    } finally {
      setStatusLoading(null);
      setAbsenceModal(null);
      setRecareModal(null);
    }
  }

  async function saveMemo() {
    if (!memoLead) return;
    setMemoSaving(true);
    const { error } = await supabase.from("leads").update({ memo: memoDraft }).eq("id", memoLead.id);
    setMemoSaving(false);
    if (error) return;
    setMemoLead(null);
    setMemoDraft("");
  }

  function getChannel(lead: Lead): string {
    const camp = (lead.campaign_name ?? "").toLowerCase();
    if (camp.includes("도그마루")) return "도그마루";
    if (camp.includes("모요")) return "모요";
    return "유닥";
  }

  const displayName = (lead: Lead) => lead.customer_name ?? (lead as any).name ?? "-";
  const displayPhone = (lead: Lead) => lead.customer_phone ?? (lead as any).phone ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div className="font-bold text-base">잠재고객</div>
        <button onClick={onSwitchToFull} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-border/60 bg-muted/30 active:bg-muted/60 transition-colors">
          🖥️ PC 뷰
        </button>
      </div>

      {/* 채널 탭 */}
      <div className="sticky top-[53px] z-10 bg-background border-b flex">
        {([
          { key: "meta", label: "메타광고", count: metaCount },
          { key: "dogmaru", label: "도그마루", count: dogmaruCount },
          { key: "udak", label: "유닥", count: udakCount },
          { key: "other", label: "기타인입", count: 0 },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setSourceTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${sourceTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t.label} <span className="opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="px-3 py-2 border-b">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름 또는 연락처 검색..."
          className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background" />
      </div>

      {/* 케어 보관함 - 현재 채널 내 필터 */}
      <div className="flex gap-1.5 px-3 py-2 border-b overflow-x-auto bg-muted/10">
        {(() => {
          const mobileTabs: { key: string; label: string; color: string }[] = [
            { key: "all", label: "전체", color: "" },
            { key: "new", label: `신규 접수 ${newCount}`, color: "sky" },
          ];
          if (sourceTab === "dogmaru") {
            const withdrawCount = tabRows.filter(r => getDogmaruTabMobile(r) === "개통철회").length;
            mobileTabs.push({ key: "absence", label: `부재케어 ${absenceCount}`, color: "orange" });
            mobileTabs.push({ key: "recare", label: `재케어 ${recareCount}`, color: "purple" });
            mobileTabs.push({ key: "fail", label: `실패 ${failCount}`, color: "red" });
            mobileTabs.push({ key: "withdraw", label: `개통철회 ${withdrawCount}`, color: "rose" });
            const etcCount = tabRows.filter(r => getDogmaruTabMobile(r) === "기타").length;
            mobileTabs.push({ key: "etc", label: `기타 ${etcCount}`, color: "gray" });
            mobileTabs.push({ key: "delivery", label: `택배발송 ${deliveryCount}`, color: "indigo" });
            mobileTabs.push({ key: "subscribe", label: `청약대기 ${subscribeCount}`, color: "cyan" });
            mobileTabs.push({ key: "pending", label: `개통대기 ${pendingCount}`, color: "teal" });
            mobileTabs.push({ key: "complete", label: `완료 ${completeCount}`, color: "blue" });
            const happyCallMC = tabRows.filter(r => (r as any).happy_call === "O").length;
            const happyResultMC = tabRows.filter(r => !!(r as any).happy_call_result).length;
            const recare4MC = tabRows.filter(r => (r as any).happy_call === "O" && !(r as any).happy_call_result).length;
            mobileTabs.push({ key: "happy_call", label: `해피콜 ${happyCallMC}`, color: "green" });
            mobileTabs.push({ key: "happy_call_result", label: `영업 ${happyResultMC}`, color: "emerald" });
            mobileTabs.push({ key: "recare4happy", label: `재케어대상 ${recare4MC}`, color: "amber" });
          } else {
            mobileTabs.push({ key: "care", label: `케어중 ${careCount}`, color: "yellow" });
            mobileTabs.push({ key: "absence", label: `부재 중 ${absMetaCount}`, color: "orange" });
            mobileTabs.push({ key: "recare", label: `재케어 ${recareMetaCount}`, color: "purple" });
            mobileTabs.push({ key: "cancel", label: `취소 ${cancelCount}`, color: "gray" });
            mobileTabs.push({ key: "complete_meta", label: `개통 완료 ${completeMetaCount}`, color: "blue" });
          }
          return mobileTabs.map(t => (
            <button key={t.key} onClick={() => { setCareTab(t.key as any); setCompletePage(0); }}
              className={"flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 " + (
                careTab === t.key
                  ? t.color === "sky" ? "bg-sky-100 text-sky-700 shadow-sm"
                    : t.color === "yellow" ? "bg-yellow-100 text-yellow-700 shadow-sm"
                    : t.color === "orange" ? "bg-orange-100 text-orange-700 shadow-sm"
                    : t.color === "purple" ? "bg-purple-100 text-purple-700 shadow-sm"
                    : t.color === "red" ? "bg-red-100 text-red-700 shadow-sm"
                    : t.color === "gray" ? "bg-gray-100 text-gray-600 shadow-sm"
                    : t.color === "rose" ? "bg-rose-100 text-rose-700 shadow-sm"
                    : t.color === "indigo" ? "bg-indigo-100 text-indigo-700 shadow-sm"
                    : t.color === "cyan" ? "bg-cyan-100 text-cyan-700 shadow-sm"
                    : t.color === "teal" ? "bg-teal-100 text-teal-700 shadow-sm"
                    : t.color === "blue" ? "bg-blue-100 text-blue-700 shadow-sm"
                    : "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background text-muted-foreground border border-border/40"
              )}>
              {t.label}
            </button>
          ));
        })()}
      </div>

      {/* 완료건 전용 뷰 */}
      {careTab === "complete" && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 border-b">
            <input
              value={completeSearch}
              onChange={e => { setCompleteSearch(e.target.value); setCompletePage(0); }}
              placeholder="완료건 검색..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background"
            />
          </div>
          {(() => {
            const completeRows = filtered.filter(r => {
              if (!completeSearch) return true;
              const s = completeSearch.toLowerCase();
              return (r.customer_name ?? "").toLowerCase().includes(s) ||
                     (r.customer_phone ?? "").includes(s) ||
                     ((r as any).activation_number ?? "").includes(s);
            });
            const paged = completeRows.slice(completePage * COMPLETE_PAGE_SIZE, (completePage + 1) * COMPLETE_PAGE_SIZE);
            return (
              <>
                <div className="divide-y divide-border/30">
                  {paged.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">완료건이 없습니다</div>
                  ) : paged.map(lead => (
                    <div key={lead.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{lead.customer_name ?? "-"}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">완료</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{lead.customer_phone ?? "-"} · {lead.branch_name ?? "-"}</div>
                      {(lead as any).activation_status && (
                        <div className="text-xs text-muted-foreground mt-0.5">개통상태: {(lead as any).activation_status}</div>
                      )}
                      {(lead as any).activation_number && (
                        <div className="text-xs text-muted-foreground mt-0.5">가입번호: {(lead as any).activation_number}</div>
                      )}
                      {(lead as any).pkg_number && (
                        <div className="text-xs text-muted-foreground mt-0.5">상품번호: {(lead as any).pkg_number}</div>
                      )}
                      {lead.registration_date && (
                        <div className="text-xs text-muted-foreground mt-0.5">접수일: {lead.registration_date}</div>
                      )}
                    </div>
                  ))}
                </div>
                {completeRows.length > COMPLETE_PAGE_SIZE && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-xs text-muted-foreground">{completePage * COMPLETE_PAGE_SIZE + 1}–{Math.min((completePage + 1) * COMPLETE_PAGE_SIZE, completeRows.length)} / {completeRows.length}건</span>
                    <div className="flex gap-2">
                      <button onClick={() => setCompletePage(p => Math.max(0, p-1))} disabled={completePage === 0}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border/60 disabled:opacity-30">← 이전</button>
                      <button onClick={() => setCompletePage(p => p+1)} disabled={(completePage+1)*COMPLETE_PAGE_SIZE >= completeRows.length}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border/60 disabled:opacity-30">다음 →</button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* 카드 목록 (완료탭 아닐 때만) */}
      {careTab !== "complete" && <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 m-3 rounded-xl bg-muted/40 animate-pulse" style={{ animationDelay: `${i*60}ms` }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">리드가 없습니다</div>
        ) : filtered.map(lead => {
          const isExpanded = expandedId === lead.id;
          const statusInfo = MOBILE_STATUS_OPTIONS.find(s => s.value === lead.status) ?? MOBILE_STATUS_OPTIONS[0];
          const phone = displayPhone(lead);
          return (
            <div key={lead.id}>
              {/* 카드 헤더 */}
              <div className="px-4 py-3 flex items-center gap-3 active:bg-muted/20 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : lead.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{displayName(lead)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    {(lead as any).happy_call === "O" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-300 flex-shrink-0">해피O</span>}
                    {(lead as any).happy_call === "X" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold border border-rose-300 flex-shrink-0">해피X</span>}
                    {(lead as any).happy_call_result === "성공" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold border border-emerald-300 flex-shrink-0">영업✅</span>}
                    {(lead as any).happy_call_result === "실패" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold border border-rose-300 flex-shrink-0">영업❌</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {phone ?? "번호 없음"} · {lead.registration_date ?? lead.created_at?.slice(0,10) ?? "-"}
                  </div>
                  {lead.branch_name && <div className="text-xs text-muted-foreground mt-0.5">{lead.branch_name}</div>}
                  {lead.memo && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">💬 {lead.memo}</div>
                  )}
                </div>
                {phone && (
                  <a href={`tel:${phone}`} onClick={e => e.stopPropagation()}
                    className="flex-shrink-0 size-11 rounded-full bg-emerald-500 flex items-center justify-center shadow-md active:scale-90 transition-transform">
                    <span className="text-white text-xl">📞</span>
                  </a>
                )}
                <span className={`text-muted-foreground text-xs transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
              </div>

              {/* 펼쳐지는 액션 */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 bg-muted/10 border-t border-border/20">
                  {/* 상태 변경 */}
                  <div className="pt-3">
                    <div className="text-xs text-muted-foreground mb-2 font-medium">상태 변경</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(sourceTab === "dogmaru" ? MOBILE_STATUS_DOGMARU : sourceTab === "udak" ? MOBILE_STATUS_UDAK : MOBILE_STATUS_META).map(s => (
                        <button key={s.value}
                          onClick={() => {
                            if (s.value === "부재케어") { setAbsenceModal(lead); return; }
                            if (s.value === "재케어") { setRecareModal(lead); return; }
                            if (s.value === "실패") { setFailModal(lead); setFailReason(""); setFailMemo(""); return; }
                            handleStatus(lead, s.value);
                          }}
                          disabled={!!statusLoading}
                          className={"py-2.5 rounded-xl text-xs font-medium border transition-all active:scale-95 " + (
                            lead.status === s.value
                              ? s.color + " border-current shadow-sm"
                              : "bg-background border-border/60 text-muted-foreground"
                          ) + (statusLoading ? " opacity-50" : "")}>
                          {statusLoading === lead.id + s.value ? "⏳" : s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 담당자 배정 */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5 font-medium">담당자</div>
                    <select
                      value={lead.assigned_to ?? ""}
                      onChange={async e => {
                        await updateAssignee(lead.id, e.target.value || null);
                      }}
                      className="w-full text-sm px-3 py-2 rounded-xl border border-border/60 bg-background"
                    >
                      <option value="">미지정</option>
                      {staff.map(s => (
                        <option key={s.user_id} value={s.user_id}>{s.display_name}</option>
                      ))}
                    </select>
                  </div>
                  {/* 부재케어 카운터 */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5 font-medium">부재케어 횟수</div>
                    <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-2.5 border border-orange-200">
                      <button
                        onClick={() => adjustAbsenceCount(lead, -1)}
                        className="size-8 rounded-full bg-white border border-orange-300 text-orange-700 font-bold text-lg active:scale-90 transition-transform flex items-center justify-center"
                      >−</button>
                      <div className="flex-1 text-center">
                        <span className="text-lg font-bold text-orange-700">
                          🚫 {(() => { const m = (lead.memo ?? "").match(/부재\/(\d+)회/); return m ? m[1] : 0; })()}회
                        </span>
                      </div>
                      <button
                        onClick={() => adjustAbsenceCount(lead, 1)}
                        className="size-8 rounded-full bg-white border border-orange-300 text-orange-700 font-bold text-lg active:scale-90 transition-transform flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>

                  {/* 해피콜 — 도그마루 탭에서만 표시 */}
                  {sourceTab === "dogmaru" && <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">📞 해피콜</div>
                      <div className="text-[10px] text-muted-foreground">해피콜 팀 작성</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call === "O" ? null : "O", (lead as any).happy_call_result)} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call === "O" ? "bg-emerald-100 text-emerald-700 border-emerald-400" : "bg-background border-border text-muted-foreground"}`}>✅ O (상담 원함)</button>
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call === "X" ? null : "X", (lead as any).happy_call_result)} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call === "X" ? "bg-rose-100 text-rose-700 border-rose-400" : "bg-background border-border text-muted-foreground"}`}>❌ X (거절)</button>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{(lead as any).happy_call === "O" ? "✅ 인터넷 상담 받을게요!" : (lead as any).happy_call === "X" ? "❌ 필요 없어요" : "미설정"}</div>
                  </div>}
                  {/* 영업 결과 — 도그마루 탭에서만 표시 */}
                  {sourceTab === "dogmaru" && <div className={`p-3 rounded-xl border space-y-1.5 transition-opacity ${(lead as any).happy_call === "O" ? "border-border bg-muted/20 opacity-100" : "border-dashed border-border/40 bg-muted/10 opacity-40 pointer-events-none"}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">💼 영업 결과</div>
                      <div className="text-[10px] text-muted-foreground">해피콜 O만 활성</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call, (lead as any).happy_call_result === "성공" ? null : "성공")} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call_result === "성공" ? "bg-emerald-100 text-emerald-700 border-emerald-400" : "bg-background border-border text-muted-foreground"}`}>✅ 성공</button>
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call, (lead as any).happy_call_result === "실패" ? null : "실패")} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call_result === "실패" ? "bg-rose-100 text-rose-700 border-rose-400" : "bg-background border-border text-muted-foreground"}`}>❌ 실패</button>
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call, (lead as any).happy_call_result === "부재" ? null : "부재")} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call_result === "부재" ? "bg-orange-100 text-orange-700 border-orange-400" : "bg-background border-border text-muted-foreground"}`}>📵 부재</button>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{(lead as any).happy_call_result ? `현재: ${(lead as any).happy_call_result}` : "⚠️ 미설정 — 재케어 대상"}</div>
                  </div>}

                  {/* 메모 */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5 font-medium">메모</div>
                    {lead.memo && (
                      <div className="text-xs bg-background rounded-lg p-2.5 border border-border/40 mb-2">
                        💬 {lead.memo}
                      </div>
                    )}
                    <button
                      onClick={() => { setMemoLead(lead); setMemoDraft(lead.memo ?? ""); }}
                      className="w-full py-2 rounded-lg border border-border/60 text-xs text-muted-foreground bg-background active:bg-muted/30 text-left px-3">
                      ✏️ {lead.memo ? "메모 수정" : "메모 추가"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* 메모 모달 */}
      {memoLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setMemoLead(null)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b font-bold text-base">메모 — {displayName(memoLead)}</div>
            <div className="p-4">
              <textarea
                value={memoDraft}
                onChange={e => setMemoDraft(e.target.value)}
                rows={4}
                placeholder="메모를 입력하세요..."
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border/60 resize-none"
                autoFocus
              />
              <div className="text-right text-xs text-muted-foreground mt-1">{memoDraft.length}자</div>
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => setMemoLead(null)} className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm text-muted-foreground">취소</button>
              <button onClick={saveMemo} disabled={memoSaving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                {memoSaving ? "저장중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 부재케어 모달 */}
      {absenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAbsenceModal(null)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b">
              <div className="font-bold text-base">부재 사유</div>
              <div className="text-xs text-muted-foreground mt-0.5">{displayName(absenceModal)}</div>
            </div>
            <div className="p-4 space-y-2">
              {ABSENCE_REASONS.map(r => (
                <button key={r}
                  onClick={() => {
                    handleStatus(absenceModal, "부재케어");
                    const ch = getChannel(absenceModal);
                    const tmpl = templates.find(t => t.channel === ch && t.title === r && t.type === "absence");
                    const msg = tmpl?.content ?? `안녕하세요 고객님, 연락드렸으나 ${r === "통화중" ? "통화 중이신 것 같아" : "자리를 비우신 것 같아"} 문자 남깁니다. 편하신 시간에 연락 부탁드립니다 :)`;
                    const phone = displayPhone(absenceModal);
                    if (phone) {
                      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                      const sep = isIOS ? "&" : "?";
                      window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(msg)}`;
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 font-medium text-sm active:scale-95 transition-transform">
                  {r}
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button onClick={() => setAbsenceModal(null)} className="w-full py-2.5 text-sm text-muted-foreground">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 재케어 모달 */}
      {recareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRecareModal(null)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b">
              <div className="font-bold text-base">재케어 사유</div>
              <div className="text-xs text-muted-foreground mt-0.5">{displayName(recareModal)}</div>
            </div>
            <div className="p-4 space-y-2">
              {RECARE_REASONS.map(r => (
                <button key={r}
                  onClick={() => handleStatus(recareModal, "재케어")}
                  className="w-full py-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 font-medium text-sm active:scale-95 transition-transform">
                  {r}
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button onClick={() => setRecareModal(null)} className="w-full py-2.5 text-sm text-muted-foreground">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 실패 모달 */}
      {failModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFailModal(null)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b">
              <div className="font-bold text-base">실패 사유</div>
              <div className="text-xs text-muted-foreground mt-0.5">{displayName(failModal)}</div>
            </div>
            <div className="p-4 space-y-2">
              {FAIL_REASONS.map(r => (
                <button key={r}
                  onClick={() => setFailReason(r)}
                  className={`w-full py-3 rounded-xl border font-medium text-sm active:scale-95 transition-all ${
                    failReason === r
                      ? "bg-red-100 border-red-400 text-red-700 shadow-sm"
                      : "bg-red-50 border-red-200 text-red-600"
                  }`}>
                  {r}
                </button>
              ))}
              <textarea
                value={failMemo}
                onChange={e => setFailMemo(e.target.value)}
                placeholder="추가 메모 (선택)"
                rows={3}
                className="w-full text-sm px-3 py-2 rounded-xl border border-border/60 resize-none mt-1"
              />
            </div>
            <div className="px-4 pb-4 flex gap-2">
              <button onClick={() => setFailModal(null)} className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm text-muted-foreground">취소</button>
              <button
                disabled={!failReason}
                onClick={async () => {
                  await handleStatus(failModal, "실패");
                  if (failMemo.trim()) {
                    const memo = `[실패:${failReason}] ${failMemo.trim()}`;
                    await supabase.from("leads").update({ memo }).eq("id", failModal.id);
                  } else {
                    await supabase.from("leads").update({ memo: `[실패:${failReason}]` }).eq("id", failModal.id);
                  }
                  setFailModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-30">
                실패 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────



/** 탭 전환 직후 lazy chunk를 로드하는 동안 화면이 굳어 보이지 않도록
 *  shadcn 스타일과 어울리는 스켈레톤 행을 표시한다. */
const IntakeSkeleton = memo(function IntakeSkeleton() {
  return (
    <div className="space-y-2.5 p-4">
      <div className="h-10 rounded-md bg-muted/70 animate-pulse" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-9 rounded-md bg-muted/40 animate-pulse"
          style={{ animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
});
import { ColumnFilter, matchesFilter, type FilterSelection } from "@/components/common/ColumnFilter";

const STATUS_OPTIONS_META = [
  "신규 접수",
  "케어중",
  "부재 중",
  "재케어",
  "취소",
  "개통 완료",
] as const;

const STATUS_OPTIONS_DOGMARU = [
  "신규 접수",
  "상담중",
  "부재케어",
  "재케어",
  "실패",
  "개통철회",
  "기타",
  "개통완료",
] as const;

const STATUS_OPTIONS_UDAK = [
  "신규 접수", "성공", "실패", "부재케어", "재케어", "택배발송", "개통완료",
] as const;

const STATUS_OPTIONS = [...STATUS_OPTIONS_META, ...STATUS_OPTIONS_DOGMARU, ...STATUS_OPTIONS_UDAK] as const;
type Status = string;

// 파스텔 배경 제거: 흰 배경 + 진한 텍스트/테두리로 명도 대비 확보
const STATUS_COLOR: Record<string, string> = {
  "신규 접수": "bg-background text-red-700 border border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  "케어중": "bg-background text-blue-700 border border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  "부재 중": "bg-background text-orange-700 border border-orange-600 font-bold dark:text-orange-300 dark:border-orange-400",
  "재케어": "bg-background text-violet-700 border border-violet-600 font-bold dark:text-violet-300 dark:border-violet-400",
  "개통 완료": "bg-background text-emerald-700 border border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
  "취소": "bg-background text-rose-700 border border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400",
  "상담중": "bg-background text-yellow-700 border border-yellow-600 font-bold dark:text-yellow-300 dark:border-yellow-400",
  "부재케어": "bg-background text-orange-700 border border-orange-600 font-bold dark:text-orange-300 dark:border-orange-400",
  "실패": "bg-background text-red-700 border border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  "개통철회": "bg-background text-rose-700 border border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400",
  "기타": "bg-background text-gray-600 border border-gray-400 font-bold dark:text-gray-300 dark:border-gray-500",
  "개통완료": "bg-background text-emerald-700 border border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
  "성공": "bg-background text-emerald-700 border border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
  "택배발송": "bg-background text-sky-700 border border-sky-600 font-bold dark:text-sky-300 dark:border-sky-400",
};


const LEADS_SELECT = `
  id,
  created_at,
  name,
  phone,
  current_carrier,
  desired_device,
  desired_product,
  campaign_name,
  status,
  memo,
  source,
  assigned_to,
  registration_date,
  customer_name,
  customer_phone,
  branch_name,
  activation_status,
  cancellation_status,
  activation_number,
  happy_call,
  happy_call_result,
  channel,
  utm_campaign,
  storage,
  color,
  discount,
  additional_benefits,
  jointype,
  birth,
  consult_time,
  estimated_fee,
  estimated_fee_memo,
  pkg_number,
  last_action_at,
  last_action_by
`;

const cleanText = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value == null ? null : String(value);
};

function fmtCompactDate(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let hh = d.getHours();
  const ampm = hh < 12 ? "오전" : "오후";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  const hStr = String(hh).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${ampm} ${hStr}:${min}`;
}

const toDogmaruItem = (item: Lead) => ({
  ...item,
  registration_date: cleanText(item.registration_date),
  customer_name: cleanText(item.customer_name),
  customer_phone: cleanText(item.customer_phone),
  branch_name: cleanText(item.branch_name),
  activation_status: cleanText(item.activation_status),
  cancellation_status: cleanText(item.cancellation_status),
  activation_number: cleanText(item.activation_number),
});

type LeadDraft = {
  name: string;
  phone: string;
  current_carrier: string;
  desired_device: string;
  desired_product: string;
  campaign_name: string;
  memo: string;
};

const DRAFT_FIELDS: Array<{ key: keyof LeadDraft; label: string }> = [
  { key: "name", label: "고객명" },
  { key: "phone", label: "연락처" },
  { key: "current_carrier", label: "현재 통신사" },
  { key: "desired_device", label: "희망 기종" },
  { key: "desired_product", label: "희망 상품" },
  { key: "campaign_name", label: "캠페인명" },
];

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  current_carrier: string | null;
  desired_device: string | null;
  desired_product: string | null;
  campaign_name: string | null;
  status: string;
  memo: string | null;
  source: string | null;
  assigned_to: string | null;
  // 도그마루 시트 연동 필드
  registration_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  branch_name: string | null;
  activation_status: string | null;
  cancellation_status: string | null;
  activation_number: string | null;
  pkg_number: string | null;
  happy_call: string | null;
  happy_call_result: string | null;
  channel: string | null;
  utm_campaign: string | null;
  storage: string | null;
  color: string | null;
  discount: string | null;
  additional_benefits: string | null;
  jointype: string | null;
  birth: string | null;
  consult_time: string | null;
  estimated_fee: number | null;
  estimated_fee_memo: string | null;
  last_action_at: string | null;
  last_action_by: string | null;
};

type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

export default function LeadsPage() {
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { staff } = useDashboardStaff();
  // [기타인입] 탭 청크를 마운트 시 백그라운드로 미리 로드해
  // 사용자가 처음 클릭했을 때 흰 화면 없이 곧바로 리스트가 보이도록 한다.
  useEffect(() => {
    const t = setTimeout(() => {
      import("@/pages/ChannelIntakePage").catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [mobileFullView, setMobileFullView] = useState(false); // 모바일에서 전체 PC 뷰 전환
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceTab, setSourceTab] = useState<"meta" | "dogmaru" | "udak" | "other">("meta");
  const [pcCareTab, setPcCareTab] = useState<"all" | "new" | "absence" | "recare" | "fail" | "complete" | "delivery" | "subscribe" | "pending" | "care" | "cancel" | "complete_meta" | "withdraw" | "etc">("all");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [savingLeadInfo, setSavingLeadInfo] = useState(false);
  const [happyCallSaving, setHappyCallSaving] = useState(false);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [memoDraft, setMemoDraft] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [intakeFormOpen, setIntakeFormOpen] = useState(false);
  const [inquiryRows, setInquiryRows] = useState<{ created_at: string; status: string | null; manager: string | null }[]>([]);
  const [period, setPeriod] = useState<"all" | "this_month" | "last_month" | "this_week" | "last_week" | "custom">("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [dashOpen, setDashOpen] = useState(false);
  const [personalView, setPersonalView] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  // 엑셀형 컬럼 필터 (메타/도그마루 공통 + 각자 고유)
  const [fStatus, setFStatus] = useState<FilterSelection>(null);
  const [fCarrier, setFCarrier] = useState<FilterSelection>(null);
  const [fProduct, setFProduct] = useState<FilterSelection>(null);
  const [fCampaign, setFCampaign] = useState<FilterSelection>(null);
  const [fAssignee, setFAssignee] = useState<FilterSelection>(null);
  const [fBranch, setFBranch] = useState<FilterSelection>(null);
  const [fActivation, setFActivation] = useState<FilterSelection>(null);
  const [fCancellation, setFCancellation] = useState<FilterSelection>(null);
  const [draft, setDraft] = useState<LeadDraft>({
    name: "",
    phone: "",
    current_carrier: "",
    desired_device: "",
    desired_product: "",
    campaign_name: "",
    memo: "",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select(LEADS_SELECT)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // 기타인입(inquiries) 경량 집계 데이터 — 매트릭스 보드용
    (async () => {
      const { data } = await supabase
        .from("inquiries")
        .select("created_at,status,manager")
        .order("created_at", { ascending: false })
        .limit(5000);
      setInquiryRows((data ?? []) as { created_at: string; status: string | null; manager: string | null }[]);
    })();
    const ch = supabase
      .channel("leads-page-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Lead;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev];
          });
          // 전역 LeadsRealtimeNotifier 가 토스트/사운드를 단일 채널로 처리하므로 여기서는 데이터만 동기화.
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Lead;
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
        },
      )
      .subscribe();
    const ich = supabase
      .channel("inquiries-matrix-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as any;
            setInquiryRows((prev) => [{ created_at: r.created_at, status: r.status, manager: r.manager ?? null }, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as any;
            setInquiryRows((prev) =>
              prev.map((x) => (x.created_at === r.created_at ? { ...x, status: r.status, manager: r.manager ?? null } : x)),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ich);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notes for open lead
  useEffect(() => {
    if (!openLead) {
      setNotes([]);
      return;
    }
    setMemoDraft(openLead.memo ?? "");
    setEditName(openLead.name ?? "");
    setEditPhone(openLead.phone ?? "");
    setEditBirth(openLead.birth ?? "");
    (async () => {
      const [{ data: notesData }, { data: logsData }] = await Promise.all([
        supabase.from("lead_notes").select("*").eq("lead_id", openLead.id).order("created_at", { ascending: false }),
        supabase.from("lead_status_logs").select("*").eq("lead_id", openLead.id).order("changed_at", { ascending: false }),
      ]);
      setNotes((notesData ?? []) as LeadNote[]);
      setStatusLogs(logsData ?? []);
    })();
  }, [openLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 전역 토스트 알림 클릭 시 진입하는 ?tab=meta|dogmaru&highlight=<id> 동기화 ──
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "meta" || tab === "dogmaru" || tab === "udak" || tab === "other") {
      setSourceTab(tab as "meta" | "dogmaru" | "udak" | "other");
    }
    const hid = searchParams.get("highlight");
    if (hid) {
      setHighlightId(hid);
      const t = setTimeout(() => {
        setHighlightId(null);
        // URL 정리: 깜빡임이 끝나면 highlight 파라미터 제거
        const next = new URLSearchParams(searchParams);
        next.delete("highlight");
        setSearchParams(next, { replace: true });
      }, 6000);
      // 스크롤 포커스
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-lead-row="${hid}"]`);
        if (el && "scrollIntoView" in el) {
          (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      return () => clearTimeout(t);
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const getMonthStrF = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      // getMonth()는 0부터 시작(1월=0), toISOString은 UTC라 시차 보정
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    };
    const getWeekRangeF = (offset: number) => {
      const d = new Date(now);
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - day + offset * 7);
      const start = d.toISOString().slice(0, 10);
      const end = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
      return { start, end };
    };
    const inPeriod = (r: typeof rows[0]) => {
      if (period === "all") return true;
      const rd = r.registration_date;
      let iso = "";
      if (rd && rd.includes("/")) {
        const parts = rd.split("/");
        const m = parts[0].padStart(2, "0");
        const dy = parts[1]?.padStart(2, "0") ?? "01";
        iso = `2026-${m}-${dy}`;
      } else if (rd && rd.length >= 10) {
        iso = rd.slice(0, 10);
      } else {
        iso = (r.created_at ?? "").slice(0, 10);
      }
      if (period === "this_month") return iso.slice(0, 7) === getMonthStrF(0);
      if (period === "last_month") return iso.slice(0, 7) === getMonthStrF(-1);
      if (period === "this_week") { const w = getWeekRangeF(0); return iso >= w.start && iso <= w.end; }
      if (period === "last_week") { const w = getWeekRangeF(-1); return iso >= w.start && iso <= w.end; }
      if (period === "custom") return (!customStart || iso >= customStart) && (!customEnd || iso <= customEnd);
      return true;
    };
    return rows.filter((r) => {
      const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
      const isUdak = r.channel === "유닥";
      if (sourceTab === "dogmaru" && !isDogmaru) return false;
      if (sourceTab === "udak" && !isUdak) return false;
      if (sourceTab === "meta" && (isDogmaru || isUdak)) return false;
      if (sourceTab === "other" && (isDogmaru || isUdak)) return false;
      if (!inPeriod(r)) return false;
      // 도그마루: 단일 분류 함수로 정확히 하나의 탭에만 배치
      if (isDogmaru) {
        const tab = getDogmaruTabPC(r);
        if (pcCareTab === "all") { /* 전체 통과 */ }
        else if (pcCareTab === "new" && tab !== "신규 접수") return false;
        else if (pcCareTab === "absence" && tab !== "부재케어") return false;
        else if (pcCareTab === "recare" && tab !== "재케어") return false;
        else if (pcCareTab === "fail" && tab !== "실패") return false;
        else if (pcCareTab === "withdraw" && tab !== "개통철회") return false;
        else if (pcCareTab === "etc" && tab !== "기타") return false;
        else if (pcCareTab === "pending" && tab !== "개통대기") return false;
        else if (pcCareTab === "delivery" && tab !== "택배발송") return false;
        else if (pcCareTab === "subscribe" && tab !== "청약대기") return false;
        else if (pcCareTab === "complete" && tab !== "완료") return false;
        else if (pcCareTab === "happy_call" && r.happy_call !== "O") return false;
        else if (pcCareTab === "happy_call_result" && !r.happy_call_result) return false;
        else if (pcCareTab === "recare4happy" && !(r.happy_call === "O" && !r.happy_call_result)) return false;
      } else {
        // 메타 상태값 그대로 사용
        if (pcCareTab === "new" && r.status !== "신규 접수") return false;
        if (pcCareTab === "absence" && r.status !== "부재 중") return false;
        if (pcCareTab === "recare" && r.status !== "재케어") return false;
        if (pcCareTab === "care" && r.status !== "케어중") return false;
        if (pcCareTab === "cancel" && r.status !== "취소") return false;
        if (pcCareTab === "complete_meta" && r.status !== "개통 완료") return false;
        if (pcCareTab === "udak_success" && r.status !== "성공") return false;
        if (pcCareTab === "udak_fail" && r.status !== "실패") return false;
        if (pcCareTab === "udak_delivery" && r.status !== "택배발송") return false;
        if (pcCareTab === "udak_complete" && r.status !== "개통완료") return false;
      }
      if (q) {
        const hay = `${r.name ?? ""} ${r.phone ?? ""} ${r.customer_name ?? ""} ${r.customer_phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sourceTab === "meta") {
        if (!matchesFilter(r.status, fStatus)) return false;
        if (!matchesFilter(r.current_carrier, fCarrier)) return false;
        if (!matchesFilter(r.desired_product, fProduct)) return false;
        if (!matchesFilter(r.campaign_name, fCampaign)) return false;
        const assigneeName = r.assigned_to ? staff.find((s) => s.user_id === r.assigned_to)?.display_name ?? "" : "";
        if (!matchesFilter(assigneeName, fAssignee)) return false;
      } else if (sourceTab === "dogmaru") {
        if (!matchesFilter(r.branch_name, fBranch)) return false;
        if (!matchesFilter(r.activation_status, fActivation)) return false;
        if (!matchesFilter(r.cancellation_status, fCancellation)) return false;
      }
      return true;
    });
  }, [rows, search, sourceTab, period, customStart, customEnd, fStatus, fCarrier, fProduct, fCampaign, fAssignee, fBranch, fActivation, fCancellation, staff, pcCareTab]);

  // ── CSV 다운로드 ──
  const downloadCSV = (all: boolean) => {
    const data = all ? rows : filtered;
    const DQ = String.fromCharCode(34);
    const headers = ['접수일시','고객명','연락처','현재통신사','희망기종','희망상품','캠페인','담당자','상담상태','채널','메모'];
    const esc = (v: unknown) => { const s = String(v ?? '').replace(new RegExp(DQ,'g'), DQ+DQ); return DQ+s+DQ; };
    const getName = (id: string | null) => { if (!id) return ''; const f = staff.find((s:any)=>s.user_id===id||s.id===id); return f?.name??f?.full_name??id; };
    const csvRows = data.map(r => [
      r.registration_date??r.created_at?.slice(0,10)??'',
      r.customer_name??r.name??'',
      r.customer_phone??r.phone??'',
      r.current_carrier??'',
      r.desired_device??'',
      r.desired_product??'',
      r.campaign_name??'',
      getName(r.assignee_id??null),
      r.status??'',
      r.channel??'',
      r.memo??'',
    ].map(esc).join(','));
    const bom = '\uFEFF';
    const csv = bom + [headers.map(h=>DQ+h+DQ).join(','),...csvRows].join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const label = all ? '전체' : '필터';
    const dt = new Date().toISOString().slice(0,10);
    a.download = '리드_'+label+'_'+dt+'.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground/60">{label}</div>
      <div className="font-semibold text-foreground">{value || "-"}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  right,
}: {
  label: string;
  value: string | null;
  right?: { label: string; value: string | null };
}) {
  return (
    <div className={`grid divide-x divide-border border-b border-border last:border-b-0 ${right ? "grid-cols-2" : "grid-cols-1"}`}>
      <div className="p-3">
        <div className="text-[11px] font-semibold text-foreground/60 mb-0.5">{label}</div>
        <div className="text-sm font-semibold text-foreground">{value || "-"}</div>
      </div>
      {right && (
        <div className="p-3">
          <div className="text-[11px] font-semibold text-foreground/60 mb-0.5">{right.label}</div>
          <div className="text-sm font-semibold text-foreground">{right.value || "-"}</div>
        </div>
      )}
    </div>
  );
}


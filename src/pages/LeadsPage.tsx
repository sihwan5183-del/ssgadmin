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
import { UserCheck, PhoneCall, CheckCircle2, Plus, Search, RotateCw, Ban, XCircle } from "lucide-react";
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
    setStatusLoading(lead.id + status);
    await updateStatus(lead.id, status);
    setStatusLoading(null);
    setAbsenceModal(null);
    setRecareModal(null);
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

                  {/* 해피콜 */}
                  <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">📞 해피콜</div>
                      <div className="text-[10px] text-muted-foreground">해피콜 팀 작성</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call === "O" ? null : "O", (lead as any).happy_call_result)} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call === "O" ? "bg-emerald-100 text-emerald-700 border-emerald-400" : "bg-background border-border text-muted-foreground"}`}>✅ O (상담 원함)</button>
                      <button onClick={() => saveHappyCall(lead, (lead as any).happy_call === "X" ? null : "X", (lead as any).happy_call_result)} className={`flex-1 py-2.5 rounded-lg border text-xs font-bold transition-colors ${(lead as any).happy_call === "X" ? "bg-rose-100 text-rose-700 border-rose-400" : "bg-background border-border text-muted-foreground"}`}>❌ X (거절)</button>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{(lead as any).happy_call === "O" ? "✅ 인터넷 상담 받을게요!" : (lead as any).happy_call === "X" ? "❌ 필요 없어요" : "미설정"}</div>
                  </div>
                  {/* 영업 결과 */}
                  <div className={`p-3 rounded-xl border space-y-1.5 transition-opacity ${(lead as any).happy_call === "O" ? "border-border bg-muted/20 opacity-100" : "border-dashed border-border/40 bg-muted/10 opacity-40 pointer-events-none"}`}>
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
                  </div>

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
  estimated_fee_memo
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
      .channel("leads-rt")
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

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);

  const pagedFiltered = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // 필터/검색/탭 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setPage(0);
  }, [search, sourceTab, fStatus, fCarrier, fProduct, fCampaign, fAssignee, fBranch, fActivation, fCancellation]);

  // ── 일괄 선택/삭제 ──
  const filteredIds = useMemo(() => pagedFiltered.map((r) => r.id), [pagedFiltered]);
  const bulk = useBulkSelection<string>(filteredIds);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulkDelete() {
    setBulkBusy(true);
    const ids = bulk.selectedIds;
    const deleterName = user?.user_metadata?.display_name ?? user?.email ?? "unknown";
    const now = new Date().toISOString();

    // soft-delete: 실제 삭제 대신 deleted_at, deleted_by 마킹
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: now, deleted_by: deleterName })
      .in("id", ids);
    setBulkBusy(false);
    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    toast.success(`${ids.length}건이 휴지통으로 이동되었습니다`);
    setBulkDeleteOpen(false);
    bulk.clear();

    // 관리자(김시환)에게 푸시 알림
    try {
      await supabase.functions.invoke("leads-webhook", {
        body: {
          _admin_notify: true,
          type: "trash",
          table: "leads",
          count: ids.length,
          deleted_by: deleterName,
          deleted_at: now,
        },
      });
    } catch (_) {}
  }

  const sourceCounts = useMemo(() => {
    let dogmaru = 0;
    let meta = 0;
    let udak = 0;
    for (const r of rows) {
      if (r.channel === "유닥") udak++;
      else if (r.campaign_name === DOGMARU_CAMPAIGN) dogmaru++;
      else if (r.campaign_name) meta++;
    }
    return { meta, dogmaru, udak };
  }, [rows]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      todayNew: rows.filter((r) => r.created_at.slice(0, 10) === today).length,
      completed: rows.filter((r) => r.status === "개통 완료").length,
      newCount: rows.filter((r) => r.status === "신규 접수").length,
    };
  }, [rows]);

  // 도그마루 완료건 판단 (PC용)
  // memo + activation_status 기반 상태 자동 분류
  // 도그마루 건 하나를 정확히 하나의 탭으로 분류하는 단일 함수 (PC용)
  function getDogmaruTabPC(r: any): string {
    return getDogmaruTab(r);
  }

  // 탭 전환시 pcCareTab 리셋
  useEffect(() => { setPcCareTab("all"); }, [sourceTab]);

  // ── 경로별 성과 매트릭스 (메타 / 도그마루 / 기타) ──
  const matrix = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const getMonthStr = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    };
    const getWeekRange = (offset: number) => {
      const d = new Date(now);
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - day + offset * 7);
      const start = d.toISOString().slice(0, 10);
      const end = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
      return { start, end };
    };
    const inRange = (iso: string) => {
      if (period === "all") return true;
      if (period === "this_month") return iso.slice(0, 7) === getMonthStr(0);
      if (period === "last_month") return iso.slice(0, 7) === getMonthStr(-1);
      if (period === "this_week") { const w = getWeekRange(0); return iso.slice(0,10) >= w.start && iso.slice(0,10) <= w.end; }
      if (period === "last_week") { const w = getWeekRange(-1); return iso.slice(0,10) >= w.start && iso.slice(0,10) <= w.end; }
      if (period === "custom") return (!customStart || iso.slice(0,10) >= customStart) && (!customEnd || iso.slice(0,10) <= customEnd);
      return true;
    };
    const empty = () => ({ total: 0, today: 0, done: 0, recare: 0, absent: 0, fail: 0 });
    const meta = empty();
    const dogmaru = empty();
    const udak = empty();
    const other = empty();

    for (const r of rows) {
      const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
      const isUdakR = r.channel === "유닥" || r.channel === "메타광고";

      let dateIso = "";
      const rd = r.registration_date;
      if (rd && rd.includes("/")) {
        const parts = rd.split("/");
        const mo = parts[0].padStart(2, "0");
        const dy = parts[1]?.padStart(2, "0") ?? "01";
        dateIso = `2026-${mo}-${dy}`;
      } else if (rd && rd.length >= 10) {
        dateIso = rd.slice(0, 10);
      } else {
        dateIso = r.created_at.slice(0, 10);
      }
      if (!inRange(dateIso)) continue;

      const bucket = isDogmaru ? dogmaru : isUdakR ? udak : meta;
      bucket.total += 1;
      if (dateIso === today) bucket.today += 1;
      if (isDogmaru) {
        const tab = getDogmaruTab(r);
        if (tab === "완료") bucket.done += 1;
        else if (tab === "재케어") bucket.recare += 1;
        else if (tab === "부재케어") bucket.absent += 1;
        else if (tab === "실패") bucket.fail += 1;
      } else {
        if (r.status === "개통 완료") bucket.done += 1;
        if (r.status === "재케어") bucket.recare += 1;
        if (r.status === "부재 중") bucket.absent += 1;
        if (r.status === "실패" || r.status === "취소") bucket.fail += 1;
      }
    }
    for (const r of inquiryRows) {
      if (!inRange(r.created_at)) continue;
      other.total += 1;
      if (r.created_at.slice(0, 10) === today) other.today += 1;
      if (r.status === "개통완료") other.done += 1;
      if (r.status === "재케어") other.recare += 1;
      if (r.status === "부재") other.absent += 1;
      if (r.status === "실패" || r.status === "취소") other.fail += 1;
    }
    return { meta, dogmaru, udak, other };
  }, [rows, inquiryRows, period, customStart, customEnd, sourceTab]);

  // ── 직원별 성과 매트릭스 (담당자/매니저 단위 집계) ──
  const staffMatrix = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const getMonthStr2 = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    };
    const getWeekRange2 = (offset: number) => {
      const d = new Date(now);
      const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
      d.setDate(d.getDate() - day + offset * 7);
      const start = d.toISOString().slice(0, 10);
      const end = new Date(d.getTime() + 6 * 86400000).toISOString().slice(0, 10);
      return { start, end };
    };
    const inRange = (iso: string) => {
      if (period === "all") return true;
      if (period === "this_month") return iso.slice(0, 7) === getMonthStr2(0);
      if (period === "last_month") return iso.slice(0, 7) === getMonthStr2(-1);
      if (period === "this_week") { const w = getWeekRange2(0); return iso.slice(0,10) >= w.start && iso.slice(0,10) <= w.end; }
      if (period === "last_week") { const w = getWeekRange2(-1); return iso.slice(0,10) >= w.start && iso.slice(0,10) <= w.end; }
      if (period === "custom") return (!customStart || iso.slice(0,10) >= customStart) && (!customEnd || iso.slice(0,10) <= customEnd);
      return true;
    };
    const empty = () => ({ total: 0, today: 0, done: 0, recare: 0, absent: 0, fail: 0 });
    const map = new Map<string, ReturnType<typeof empty>>();
    const bump = (name: string) => {
      let b = map.get(name);
      if (!b) { b = empty(); map.set(name, b); }
      return b;
    };
    for (const r of rows) {
      if (!inRange(r.created_at)) continue;
      const name = r.assigned_to ? (staff.find((s) => s.user_id === r.assigned_to)?.display_name ?? "(미지정)") : "(미지정)";
      const b = bump(name);
      b.total += 1;
      if (r.created_at.slice(0, 10) === today) b.today += 1;
      if (r.status === "개통 완료") b.done += 1;
      if (r.status === "재케어") b.recare += 1;
      if (r.status === "부재 중") b.absent += 1;
      if (r.status === "실패" || r.status === "취소") b.fail += 1;
    }
    for (const r of inquiryRows) {
      if (!inRange(r.created_at)) continue;
      const name = (r.manager && r.manager.trim()) ? r.manager.trim() : "(미지정)";
      const b = bump(name);
      b.total += 1;
      if (r.created_at.slice(0, 10) === today) b.today += 1;
      if (r.status === "개통완료") b.done += 1;
      if (r.status === "재케어") b.recare += 1;
      if (r.status === "부재") b.absent += 1;
      if (r.status === "실패" || r.status === "취소") b.fail += 1;
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows, inquiryRows, period, customStart, customEnd, staff]);

  // 날짜 파싱 헬퍼
  const parseLeadDate = (r: typeof rows[0]) => {
    const rd = r.registration_date;
    if (rd && rd.includes("/")) {
      const parts = rd.split("/");
      const m = parts[0].padStart(2, "0");
      const dy = parts[1]?.padStart(2, "0") ?? "01";
      return `2026-${m}-${dy}`;
    }
    if (rd && rd.length >= 10) return rd.slice(0, 10);
    return (r.created_at ?? "").slice(0, 10);
  };

  // 메타 일별 추이 (최근 30일)
  const metaTrendData = useMemo(() => {
    const now = new Date();
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, label: `${d.getMonth()+1}/${d.getDate()}`, count: 0 });
    }
    for (const r of rows.filter(r => r.channel !== "유닥" && r.campaign_name !== DOGMARU_CAMPAIGN)) {
      const iso = parseLeadDate(r);
      const day = days.find(d => d.date === iso);
      if (day) day.count++;
    }
    return days;
  }, [rows]);

  // 도그마루 일별 추이 (최근 30일)
  const dogmaruTrendData = useMemo(() => {
    const now = new Date();
    const days: { date: string; label: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, label: `${d.getMonth()+1}/${d.getDate()}`, count: 0 });
    }
    for (const r of rows.filter(r => r.campaign_name === DOGMARU_CAMPAIGN)) {
      const iso = parseLeadDate(r);
      const day = days.find(d => d.date === iso);
      if (day) day.count++;
    }
    return days;
  }, [rows]);

  // ── 엑셀형 헤더 필터에 들어갈 고유값 (탭별로 분리해 메타↔도그마루 섞이지 않게) ──
  const metaRows = useMemo(() => rows.filter((r) => r.channel !== "유닥" && r.campaign_name !== DOGMARU_CAMPAIGN), [rows]);
  const dogmaruRows = useMemo(() => rows.filter((r) => r.campaign_name === DOGMARU_CAMPAIGN), [rows]);
  const udakRows = useMemo(() => rows.filter((r) => r.channel === "유닥"), [rows]);
  const valStatus = useMemo(() => metaRows.map((r) => r.status ?? ""), [metaRows]);
  const valCarrier = useMemo(() => metaRows.map((r) => r.current_carrier ?? ""), [metaRows]);
  const valProduct = useMemo(() => metaRows.map((r) => r.desired_product ?? ""), [metaRows]);
  const valCampaign = useMemo(() => metaRows.map((r) => r.campaign_name ?? ""), [metaRows]);
  const valAssignee = useMemo(
    () => metaRows.map((r) => (r.assigned_to ? staff.find((s) => s.user_id === r.assigned_to)?.display_name ?? "" : "")),
    [metaRows, staff],
  );
  const valBranch = useMemo(() => dogmaruRows.map((r) => r.branch_name ?? ""), [dogmaruRows]);
  const valActivation = useMemo(() => dogmaruRows.map((r) => r.activation_status ?? ""), [dogmaruRows]);
  const valCancellation = useMemo(() => dogmaruRows.map((r) => r.cancellation_status ?? ""), [dogmaruRows]);

  async function updateStatus(id: string, status: string) {
    const changedBy = user?.user_metadata?.display_name ?? user?.email ?? "unknown";

    // 부재케어 카운팅 - 기존 횟수 확인
    let absenceCount = 0;
    if (status === "부재케어") {
      const { count } = await supabase
        .from("lead_status_logs")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", id)
        .eq("status", "부재케어");
      absenceCount = (count ?? 0) + 1;
    }

    // 상태 업데이트
    const updateData: any = { status };
    // 부재케어면 메모에 횟수 자동 기록
    if (status === "부재케어") {
      const currentRow = rows.find(r => r.id === id);
      const baseMemo = (currentRow?.memo ?? "").replace(/부재\/\d+회/g, "").trim();
      updateData.memo = [baseMemo, `부재/${absenceCount}회`].filter(Boolean).join(" / ");
    }

    const { error } = await supabase.from("leads").update(updateData).eq("id", id);
    if (error) { toast.error(error.message); return; }

    // 상태 변경 로그 INSERT (기존 유지)
    await supabase.from("lead_status_logs").insert({
      lead_id: id,
      status,
      changed_by: changedBy,
    });

    // 영업 활동 리포트용 activity_logs INSERT (신규 — 기존 기능에 영향 없음)
    const currentRow = rows.find((r) => r.id === id);
    const previousStatus = currentRow?.status ?? null;
    const rowChannel = currentRow?.channel === "유닥" ? "udak"
      : currentRow?.campaign_name === "도그마루_홈캠" ? "dogmaru"
      : "meta";
    await logLeadStatusChange({
      leadId: id,
      staffId: user?.id ?? changedBy,
      staffName: changedBy,
      previousStatus,
      nextStatus: status,
      channel: rowChannel,
    });

    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...updateData } : r)));
    if (openLead?.id === id) setOpenLead({ ...openLead, ...updateData });
  }

  // 부재케어 카운트 수동 조정
  async function saveHappyCall(lead: Lead, happy_call: string | null, happy_call_result: string | null) {
    setHappyCallSaving(true);
    const changedBy = user?.user_metadata?.display_name ?? user?.email ?? "unknown";
    const { error } = await supabase.from("leads")
      .update({ happy_call, happy_call_result })
      .eq("id", lead.id);
    if (!error) {
      const logStatus = happy_call_result
        ? `영업:${happy_call_result}`
        : happy_call ? `해피콜:${happy_call}` : "해피콜/영업 초기화";
      await supabase.from("lead_status_logs").insert({
        lead_id: lead.id,
        status: logStatus,
        changed_by: changedBy,
      });
      toast.success("저장되었습니다 ✅");
      setRows((p) => p.map((r) => r.id === lead.id ? { ...r, happy_call, happy_call_result } : r));
      if (openLead?.id === lead.id) setOpenLead({ ...lead, happy_call, happy_call_result });
    }
    setHappyCallSaving(false);
  }

  async function adjustAbsenceCount(lead: Lead, delta: number) {
    const changedBy = user?.user_metadata?.display_name ?? user?.email ?? "unknown";
    const match = (lead.memo ?? "").match(/부재\/(\d+)회/);
    const current = match ? parseInt(match[1]) : 0;
    const next = Math.max(0, current + delta);
    const baseMemo = (lead.memo ?? "").replace(/부재\/\d+회\s*\/?/g, "").trim();
    const newMemo = next > 0 ? [baseMemo, `부재/${next}회`].filter(Boolean).join(" / ") : baseMemo;
    await supabase.from("leads").update({ memo: newMemo }).eq("id", lead.id);
    // 로그 기록
    await supabase.from("lead_status_logs").insert({
      lead_id: lead.id,
      status: delta > 0 ? `부재케어 +1 (${next}회)` : `부재케어 -1 (${next}회)`,
      changed_by: changedBy,
    });
    setRows(p => p.map(r => r.id === lead.id ? { ...r, memo: newMemo } : r));
    if (openLead?.id === lead.id) setOpenLead({ ...openLead, memo: newMemo });
  }

  async function updateAssignee(id: string, assigned_to: string | null) {
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, assigned_to } : r)));
    if (openLead?.id === id) setOpenLead({ ...openLead, assigned_to });
  }

  const staffName = (uid: string | null | undefined) =>
    staff.find((s) => s.user_id === uid)?.display_name ?? "";

  async function saveLeadInfo() {
    if (!openLead) return;
    setSavingLeadInfo(true);
    const { error } = await supabase
      .from("leads")
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim() || null,
        birth: editBirth.trim() || null,
      })
      .eq("id", openLead.id);
    setSavingLeadInfo(false);
    if (error) { toast.error("저장 실패: " + error.message); return; }
    const updated = { ...openLead, name: editName.trim() || null, phone: editPhone.trim() || null, birth: editBirth.trim() || null };
    setOpenLead(updated);
    setRows((p) => p.map((r) => (r.id === openLead.id ? { ...r, name: updated.name, phone: updated.phone, birth: updated.birth } : r)));
    toast.success("고객 정보가 저장되었습니다");
  }

  async function saveMemo() {
    if (!openLead) return;
    const { error } = await supabase
      .from("leads")
      .update({ memo: memoDraft })
      .eq("id", openLead.id);
    if (error) return toast.error(error.message);
    setOpenLead({ ...openLead, memo: memoDraft });
    setRows((p) => p.map((r) => (r.id === openLead.id ? { ...r, memo: memoDraft } : r)));
    toast.success("메모를 저장했습니다");
  }

  async function addNote() {
    if (!openLead || !newNote.trim()) return;
    const payload = {
      lead_id: openLead.id,
      author_id: user?.id ?? null,
      author_name:
        (user?.user_metadata?.display_name as string | undefined) ??
        user?.email ??
        null,
      content: newNote.trim(),
    };
    const { data, error } = await supabase
      .from("lead_notes")
      .insert(payload)
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setNotes((p) => [data as LeadNote, ...p]);
    setNewNote("");
  }

  async function createLead() {
    if (!draft.name && !draft.phone) {
      return toast.error("고객명 또는 연락처는 입력해야 합니다");
    }
    const { error } = await supabase.from("leads").insert({
      ...draft,
      status: "신규 접수",
      source: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("리드를 등록했습니다");
    setShowCreate(false);
    setDraft({
      name: "",
      phone: "",
      current_carrier: "",
      desired_device: "",
      desired_product: "",
      campaign_name: "",
      memo: "",
    });
    load();
  }

  // 모바일 뷰
  if (isMobile && !mobileFullView) {
    return <MobileLeadsView
      rows={rows}
      loading={loading}
      sourceTab={sourceTab}
      setSourceTab={setSourceTab}
      search={search}
      setSearch={setSearch}
      updateStatus={updateStatus}
      updateAssignee={updateAssignee}
      adjustAbsenceCount={adjustAbsenceCount}
      staff={staff}
      onSwitchToFull={() => setMobileFullView(true)}
      saveHappyCall={saveHappyCall}
    />;
  }

  return (
    <div className="p-6 space-y-5 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">잠재고객 관리</h1>
          <p className="text-sm text-foreground/70">
            메타 광고 등 외부 인입 리드를 통합 관리합니다.
          </p>
        </div>
        {sourceTab === "other" ? (
          <Button onClick={() => setIntakeFormOpen(true)}>
            <Plus className="size-4 mr-1" /> 인입 등록
          </Button>
        ) : (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-1" /> 리드 추가
          </Button>
        )}
      </div>

      {/* 종합 리드 성과 보드 — 경로별/기간별 매트릭스 */}
      <Card className="p-4">
        <div
          className="flex items-center justify-between gap-3 flex-wrap cursor-pointer mb-1"
          onClick={() => setDashOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">종합 리드 성과 보드</div>
            <div className="text-xs text-muted-foreground">
              {personalView ? "직원별 · 기간별 처리 현황" : "경로별 · 기간별 접수/개통 매트릭스"}
            </div>
            <span className={"text-xs text-muted-foreground transition-transform duration-200 inline-block " + (dashOpen ? "rotate-180" : "")}>▼</span>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-700">개인별 보기</span>
              <Switch
                checked={personalView}
                onCheckedChange={(v) => startTransition(() => setPersonalView(!!v))}
              />
            </label>
          </div>
        </div>

        {/* 아코디언 - 기간 필터 */}
        {dashOpen && (
          <div className="mt-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
                {([
                  { k: "all", l: "전체" },
                  { k: "this_month", l: "이번달" },
                  { k: "last_month", l: "저번달" },
                  { k: "this_week", l: "이번주" },
                  { k: "last_week", l: "지난주" },
                  { k: "custom", l: "기간설정" },
                ] as const).map((opt) => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => startTransition(() => setPeriod(opt.k))}
                    className={
                      "px-3 py-1.5 text-xs font-semibold rounded transition-colors " +
                      (period === opt.k
                        ? "bg-background text-slate-900 shadow-sm"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {period === "custom" && (
                <div className="flex items-center gap-1">
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background" />
                  <span className="text-xs text-muted-foreground">~</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background" />
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : personalView ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-2 px-2 min-w-[140px]">담당자</th>
                  <th className="text-right font-medium py-2 px-2">전체 접수</th>
                  <th className="text-right font-medium py-2 px-2">오늘 신규</th>
                  <th className="text-right font-medium py-2 px-2">개통 완료</th>
                  <th className="text-right font-medium py-2 px-2">재케어</th>
                  <th className="text-right font-medium py-2 px-2">부재</th>
                  <th className="text-right font-medium py-2 px-2">실패</th>
                </tr>
              </thead>
              <tbody className="tabular-nums text-slate-900">
                {staffMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-muted-foreground text-xs">
                      해당 기간에 처리된 리드가 없습니다.
                    </td>
                  </tr>
                ) : (
                  staffMatrix.map((s) => (
                    <tr key={s.name} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                      <td className="py-1.5 px-2 font-semibold">{s.name}</td>
                      <td className="text-right py-1.5 px-2">{s.total.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 text-orange-700">{s.today.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 text-emerald-700 font-semibold">{s.done.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2">{s.recare.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2">{s.absent.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-2 text-rose-600">{s.fail.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
        {/* Desktop/Tablet: 격자 매트릭스 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 px-2 w-32">지표</th>
                <th className="text-right font-medium py-2 px-2">메타</th>
                <th className="text-right font-medium py-2 px-2">도그마루</th>
                <th className="text-right font-medium py-2 px-2">유닥</th>
                <th className="text-right font-medium py-2 px-2">기타</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {([
                { label: "전체 접수", icon: UserCheck, key: "total" as const, tone: "text-primary" },
                { label: "오늘 신규", icon: PhoneCall, key: "today" as const, tone: "text-orange-600 dark:text-orange-400" },
                { label: "개통 완료", icon: CheckCircle2, key: "done" as const, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "재케어", icon: RotateCw, key: "recare" as const, tone: "text-zinc-600 dark:text-zinc-300" },
                { label: "부재", icon: Ban, key: "absent" as const, tone: "text-orange-600 dark:text-orange-400" },
                { label: "실패", icon: XCircle, key: "fail" as const, tone: "text-rose-600 dark:text-rose-400" },
              ]).map((row) => {
                const Icon = row.icon;
                const m = matrix.meta[row.key];
                const d = matrix.dogmaru[row.key];
                const u = matrix.udak[row.key];
                const o = matrix.other[row.key];
                return (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <Icon className={"size-4 " + row.tone} />
                        <span className="font-medium">{row.label}</span>
                      </div>
                    </td>
                    <td className="text-right py-1.5 px-2">{m.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{d.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{u.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{o.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: 세로형 스택 */}
        <div className="sm:hidden space-y-3">
          {([
            { label: "전체 접수", icon: UserCheck, key: "total" as const, tone: "text-primary" },
            { label: "오늘 신규", icon: PhoneCall, key: "today" as const, tone: "text-orange-600 dark:text-orange-400" },
            { label: "개통 완료", icon: CheckCircle2, key: "done" as const, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "재케어", icon: RotateCw, key: "recare" as const, tone: "text-zinc-600 dark:text-zinc-300" },
            { label: "부재", icon: Ban, key: "absent" as const, tone: "text-orange-600 dark:text-orange-400" },
            { label: "실패", icon: XCircle, key: "fail" as const, tone: "text-rose-600 dark:text-rose-400" },
          ]).map((row) => {
            const Icon = row.icon;
            const m = matrix.meta[row.key];
            const d = matrix.dogmaru[row.key];
            const u = matrix.udak[row.key];
            const o = matrix.other[row.key];
            const sum = m + d + u + o;
            return (
              <div key={row.key} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={"size-4 " + row.tone} />
                    <span className="text-sm font-semibold">{row.label}</span>
                  </div>
                  
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "메타", v: m },
                    { k: "도그마루", v: d },
                    { k: "기타", v: o },
                  ].map((c) => (
                    <div key={c.k} className="rounded-md bg-muted/50 py-1.5">
                      <div className="text-[10px] text-muted-foreground whitespace-pre-line leading-tight">{c.k}</div>
                      <div className="text-sm font-semibold tabular-nums">{c.v.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </Card>

      {/* Filters */}
      {sourceTab !== "other" && (
        <Card className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10 text-sm"
              placeholder="고객명 또는 휴대폰 번호로 검색…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-foreground/60">
            엑셀처럼 각 헤더의 <span className="font-semibold text-foreground/80">▼</span> 를 눌러 다중 선택으로 좁혀보세요.
          </div>
          <div className="ml-auto text-xs text-foreground/60 tabular-nums">
            {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}건
          </div>
        </Card>
      )}

      {/* Table */}
      <Tabs
        value={sourceTab}
        onValueChange={(v) =>
          startTransition(() => setSourceTab(v as "meta" | "dogmaru" | "udak" | "other"))
        }
      >
        <TabsList className="grid grid-cols-4 w-full max-w-3xl h-12 bg-muted/60 mb-3">
          <TabsTrigger value="meta" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            메타광고
            <Badge variant="secondary" className="ml-2 tabular-nums">{sourceCounts.meta}</Badge>
          </TabsTrigger>
          <TabsTrigger value="dogmaru" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            도그마루
            <Badge variant="secondary" className="ml-2 tabular-nums">{sourceCounts.dogmaru}</Badge>
          </TabsTrigger>
          <TabsTrigger value="udak" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            유닥
            <Badge variant="secondary" className="ml-2 tabular-nums">{sourceCounts.udak ?? 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="other" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            기타인입
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* PC 상태 탭 */}
      {sourceTab !== "other" && (() => {
        const tabRows = rows.filter(r => {
          const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
          const isUdakR = r.channel === "유닥";
          if (sourceTab === "dogmaru") return isDogmaru;
          if (sourceTab === "udak") return isUdakR;
          return !isDogmaru && !isUdakR;
        });
        // 도그마루 탭 카운트: effectiveStatus 기준 (DB status 우선, 없으면 memo 자동분류, 둘 다 없으면 신규 접수)
        const completeC = tabRows.filter(r => getDogmaruTabPC(r) === "완료").length;
        const pendingC = tabRows.filter(r => getDogmaruTabPC(r) === "개통대기").length;
        const deliveryC = tabRows.filter(r => getDogmaruTabPC(r) === "택배발송").length;
        const subscribeC = tabRows.filter(r => getDogmaruTabPC(r) === "청약대기").length;
        const newC = sourceTab === "dogmaru"
          ? tabRows.filter(r => getDogmaruTabPC(r) === "신규 접수").length
          : tabRows.filter(r => r.status === "신규 접수").length;
        const absenceC = tabRows.filter(r => getDogmaruTabPC(r) === "부재케어").length;
        const recareC = tabRows.filter(r => getDogmaruTabPC(r) === "재케어").length;
        const failC = tabRows.filter(r => getDogmaruTabPC(r) === "실패").length;
        const pcTabs: { key: string; label: string; color: string }[] = [
          { key: "all", label: "전체", color: "" },
          { key: "new", label: `신규 접수 ${newC}`, color: "blue-light" },
        ];
        if (sourceTab === "dogmaru") {
          pcTabs.push({ key: "absence", label: `부재케어 ${absenceC}`, color: "orange" });
          pcTabs.push({ key: "recare", label: `재케어 ${recareC}`, color: "purple" });
          pcTabs.push({ key: "fail", label: `실패 ${failC}`, color: "red" });
          const withdrawC = tabRows.filter(r => getDogmaruTabPC(r) === "개통철회").length;
          pcTabs.push({ key: "withdraw", label: `개통철회 ${withdrawC}`, color: "rose" });
          const etcC = tabRows.filter(r => getDogmaruTabPC(r) === "기타").length;
          pcTabs.push({ key: "etc", label: `기타 ${etcC}`, color: "gray" });
          pcTabs.push({ key: "delivery", label: `택배발송 ${deliveryC}`, color: "indigo" });
          pcTabs.push({ key: "subscribe", label: `청약대기 ${subscribeC}`, color: "cyan" });
          pcTabs.push({ key: "pending", label: `개통대기 ${pendingC}`, color: "teal" });
          pcTabs.push({ key: "complete", label: `완료 ${completeC}`, color: "blue" });
          const happyCallC = tabRows.filter(r => (r as any).happy_call === "O").length;
          const happyResultC = tabRows.filter(r => !!(r as any).happy_call_result).length;
          const recare4happyC = tabRows.filter(r => (r as any).happy_call === "O" && !(r as any).happy_call_result).length;
          pcTabs.push({ key: "happy_call", label: `해피콜 ${happyCallC}`, color: "green" });
          pcTabs.push({ key: "happy_call_result", label: `영업 ${happyResultC}`, color: "emerald" });
          pcTabs.push({ key: "recare4happy", label: `재케어대상 ${recare4happyC}`, color: "amber" });
        } else if (sourceTab === "udak") {
          const successC = tabRows.filter(r => r.status === "성공").length;
          const failC2 = tabRows.filter(r => r.status === "실패").length;
          const absUdakC = tabRows.filter(r => r.status === "부재케어").length;
          const recareUdakC = tabRows.filter(r => r.status === "재케어").length;
          const deliveryUdakC = tabRows.filter(r => r.status === "택배발송").length;
          const completeUdakC = tabRows.filter(r => r.status === "개통완료").length;
          pcTabs.push({ key: "udak_success", label: `성공 ${successC}`, color: "emerald" });
          pcTabs.push({ key: "udak_fail", label: `실패 ${failC2}`, color: "red" });
          pcTabs.push({ key: "absence", label: `부재케어 ${absUdakC}`, color: "orange" });
          pcTabs.push({ key: "recare", label: `재케어 ${recareUdakC}`, color: "purple" });
          pcTabs.push({ key: "udak_delivery", label: `택배발송 ${deliveryUdakC}`, color: "sky" });
          pcTabs.push({ key: "udak_complete", label: `개통완료 ${completeUdakC}`, color: "blue" });
        } else {
          // 메타 상태값 그대로
          const careC = tabRows.filter(r => r.status === "케어중").length;
          const absMetaC = tabRows.filter(r => r.status === "부재 중").length;
          const recareMetaC = tabRows.filter(r => r.status === "재케어").length;
          const cancelC = tabRows.filter(r => r.status === "취소").length;
          const completeMetaC = tabRows.filter(r => r.status === "개통 완료").length;
          pcTabs.push({ key: "care", label: `케어중 ${careC}`, color: "yellow" });
          pcTabs.push({ key: "absence", label: `부재 중 ${absMetaC}`, color: "orange" });
          pcTabs.push({ key: "recare", label: `재케어 ${recareMetaC}`, color: "purple" });
          pcTabs.push({ key: "cancel", label: `취소 ${cancelC}`, color: "gray" });
          pcTabs.push({ key: "complete_meta", label: `개통 완료 ${completeMetaC}`, color: "blue" });
        }
        function getTabClass(t: { key: string; color: string }) {
          if (pcCareTab !== t.key) return "bg-background text-muted-foreground border-border/60 hover:bg-muted/40";
          if (t.color === "blue-light") return "bg-blue-100 text-blue-700 border-blue-300";
          if (t.color === "yellow") return "bg-yellow-100 text-yellow-700 border-yellow-300";
          if (t.color === "gray") return "bg-gray-100 text-gray-600 border-gray-300";
          if (t.color === "rose") return "bg-rose-100 text-rose-700 border-rose-300";
          if (t.color === "orange") return "bg-orange-100 text-orange-700 border-orange-300";
          if (t.color === "purple") return "bg-purple-100 text-purple-700 border-purple-300";
          if (t.color === "red") return "bg-red-100 text-red-700 border-red-300";
          if (t.color === "indigo") return "bg-indigo-100 text-indigo-700 border-indigo-300";
          if (t.color === "cyan") return "bg-cyan-100 text-cyan-700 border-cyan-300";
          if (t.color === "teal") return "bg-teal-100 text-teal-700 border-teal-300";
          if (t.color === "blue") return "bg-blue-100 text-blue-700 border-blue-300";
          if (t.color === "green") return "bg-green-100 text-green-700 border-green-300";
          if (t.color === "emerald") return "bg-emerald-100 text-emerald-700 border-emerald-300";
          if (t.color === "amber") return "bg-amber-100 text-amber-700 border-amber-300";
          if (t.color === "sky") return "bg-sky-100 text-sky-700 border-sky-300";
          if (t.color === "emerald") return "bg-emerald-100 text-emerald-700 border-emerald-300";
          return "bg-primary text-primary-foreground border-primary";
        }
        return (
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {pcTabs.map(t => (
              <button key={t.key} onClick={() => setPcCareTab(t.key as any)}
                className={"px-3 py-1.5 rounded-full text-xs font-semibold border transition-all " + getTabClass(t)}>
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      {sourceTab === "other" ? (
        <div key="other-intake" className="animate-fade-in">
          <Suspense fallback={<IntakeSkeleton />}>
            <ChannelIntakePage
              embedded
              formOpen={intakeFormOpen}
              onFormOpenChange={setIntakeFormOpen}
            />
          </Suspense>
        </div>
      ) : (
      <Card key={sourceTab} className="overflow-hidden border-border animate-fade-in">
        {/* 탭별 일별 추이 차트 + 날짜 필터 */}
        {(sourceTab === "dogmaru" || sourceTab === "meta") && (
          <div className="border-b border-border">
            {/* 아코디언 헤더 */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
              onClick={() => setDashOpen(v => !v)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {sourceTab === "dogmaru" ? "도그마루" : "메타광고"} 일별 접수 추이 (최근 30일)
                </span>
                <span className={"text-xs text-muted-foreground transition-transform duration-200 inline-block " + (dashOpen ? "rotate-180" : "")}>▼</span>
              </div>
              {/* 기간 필터 */}
              <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                {([
                  { k: "all", l: "전체" },
                  { k: "this_month", l: "이번달" },
                  { k: "last_month", l: "저번달" },
                  { k: "this_week", l: "이번주" },
                  { k: "last_week", l: "지난주" },
                  { k: "custom", l: "기간설정" },
                ] as const).map((opt) => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => startTransition(() => setPeriod(opt.k))}
                    className={
                      "px-2.5 py-1 text-xs font-semibold rounded border transition-colors " +
                      (period === opt.k
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {opt.l}
                  </button>
                ))}
                {period === "custom" && (
                  <div className="flex items-center gap-1">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background" />
                    <span className="text-xs text-muted-foreground">~</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border border-border rounded px-2 py-1 bg-background" />
                  </div>
                )}
              </div>
            </div>
            {/* 차트 - 아코디언으로 열림 */}
            {dashOpen && (
              <div className="px-4 pb-4">
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart
                    data={sourceTab === "dogmaru" ? dogmaruTrendData : metaTrendData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={28} />
                    <Tooltip formatter={(v: number) => [v + "건", "접수"]} labelFormatter={(l) => l + "일"} contentStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={sourceTab === "dogmaru" ? "#ec4899" : "#6366f1"}
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: sourceTab === "dogmaru" ? "#ec4899" : "#6366f1", strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        {sourceTab === "dogmaru" ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 border-b-2 border-border hover:bg-muted/60">
                <TableHead className="w-10">
                  <Checkbox
                    checked={bulk.allOnPageSelected}
                    onCheckedChange={(v) => bulk.togglePage(!!v)}
                    aria-label="전체 선택"
                  />
                </TableHead>
                <TableHead className="text-foreground font-bold">접수 일자</TableHead>
                <TableHead className="text-foreground font-bold">고객 성명</TableHead>
                <TableHead className="text-foreground font-bold">연락처</TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="접수 지점명" values={valBranch} selected={fBranch} onChange={setFBranch} />
                </TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="개통 상태" values={valActivation} selected={fActivation} onChange={setFActivation} />
                </TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="해지 및 철회" values={valCancellation} selected={fCancellation} onChange={setFCancellation} />
                </TableHead>
                <TableHead className="text-foreground font-bold">가입번호</TableHead>
                <TableHead className="text-foreground font-bold">택배개통</TableHead>
                <TableHead className="text-foreground font-bold">비고</TableHead>
                <TableHead className="text-foreground font-bold w-16 text-center">해피콜</TableHead>
                <TableHead className="text-foreground font-bold w-16 text-center">영업</TableHead>
                <TableHead className="text-foreground font-bold w-20 text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-foreground/60">
                    불러오는 중…
                  </TableCell>
                </TableRow>
              )}
              {!loading && pagedFiltered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-foreground/60">
                    도그마루 시트에서 인입된 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {pagedFiltered.map((r) => {
                const item = toDogmaruItem(r);
                const isCancelled = !!item.cancellation_status;
                const isActivated = (item.activation_status ?? "").includes("개통완료");
                return (
                  <TableRow
                    key={item.id}
                    data-lead-row={item.id}
                    className={
                      "cursor-pointer border-b border-border hover:bg-muted/40 transition-colors " +
                      (highlightId === item.id ? "bg-amber-50 ring-2 ring-amber-400 animate-pulse" : "")
                    }
                    onClick={() => setOpenLead(item)}
                    data-state={bulk.isSelected(item.id) ? "selected" : undefined}
                  >
                    <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={bulk.isSelected(item.id)}
                        onCheckedChange={() => bulk.toggle(item.id)}
                        aria-label="행 선택"
                      />
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground font-medium py-1.5">
                      {item.registration_date ?? "-"}
                    </TableCell>
                    <TableCell className="font-bold text-foreground py-1.5">
                      {item.customer_name ?? "-"}
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground font-medium py-1.5">
                      {item.customer_phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-foreground py-1.5">{item.branch_name ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap py-1.5">
                      {item.activation_status ? (
                        <span
                          className={
                            "text-xs font-bold whitespace-nowrap " +
                            (isActivated
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-indigo-700 dark:text-indigo-300")
                          }
                        >
                          {item.activation_status}
                        </span>
                      ) : (
                        <span className="text-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-1.5">
                      {isCancelled ? (
                        <span className="text-xs font-bold whitespace-nowrap text-rose-700 dark:text-rose-300">
                          {item.cancellation_status}
                        </span>
                      ) : (
                        <span className="text-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground/80 py-1.5">
                      {item.activation_number ?? "-"}
                    </TableCell>
                    <TableCell className="text-foreground/80 py-1.5">
                      {item.pkg_number ?? "-"}
                    </TableCell>
                    <TableCell className="text-foreground/80 py-1.5 max-w-[200px] truncate">
                      {item.memo ?? "-"}
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      {(item as any).happy_call === "O" ? (
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-300">O</span>
                      ) : (item as any).happy_call === "X" ? (
                        <span className="inline-flex items-center justify-center size-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs border border-rose-300">X</span>
                      ) : <span className="text-muted-foreground text-[11px]">-</span>}
                    </TableCell>
                    <TableCell className="text-center py-1.5">
                      {(item as any).happy_call_result === "성공" ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-300">성공</span>
                      ) : (item as any).happy_call_result === "실패" ? (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-300">실패</span>
                      ) : <span className="text-muted-foreground text-[11px]">-</span>}
                    </TableCell>
                    <TableCell className="text-center py-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setOpenLead(item)}>
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 border-b-2 border-border hover:bg-muted/60">
              <TableHead className="w-10">
                <Checkbox
                  checked={bulk.allOnPageSelected}
                  onCheckedChange={(v) => bulk.togglePage(!!v)}
                  aria-label="전체 선택"
                />
              </TableHead>
              <TableHead className="text-foreground font-bold w-[130px] whitespace-nowrap py-2">접수 일시</TableHead>
              <TableHead className="text-foreground font-bold">고객명</TableHead>
              <TableHead className="text-foreground font-bold">연락처</TableHead>
              <TableHead className="text-foreground font-bold">
                <ColumnFilter label="현재 통신사" values={valCarrier} selected={fCarrier} onChange={setFCarrier} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-[160px] text-xs whitespace-nowrap">희망 기종</TableHead>
              <TableHead className="text-foreground font-bold w-[200px] text-xs whitespace-nowrap">
                <ColumnFilter label="희망 상품" values={valProduct} selected={fProduct} onChange={setFProduct} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-[120px] text-xs whitespace-nowrap">
                <ColumnFilter label="캠페인" values={valCampaign} selected={fCampaign} onChange={setFCampaign} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-32">
                <ColumnFilter label="담당자" values={valAssignee} selected={fAssignee} onChange={setFAssignee} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-28">
                <ColumnFilter label="상담 상태" values={valStatus} selected={fStatus} onChange={setFStatus} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-[200px]">메모</TableHead>
              {sourceTab !== "udak" && <TableHead className="text-foreground font-bold w-16 text-center">해피콜</TableHead>}
              {sourceTab !== "udak" && <TableHead className="text-foreground font-bold w-16 text-center">영업</TableHead>}
              {sourceTab === "udak" && <TableHead className="text-foreground font-bold w-16 text-center text-xs">2ND</TableHead>}
              {sourceTab === "udak" && <TableHead className="text-foreground font-bold w-16 text-center text-xs">인터넷</TableHead>}
              {sourceTab === "udak" && <TableHead className="text-foreground font-bold w-16 text-center text-xs">OTT</TableHead>}
              <TableHead className="text-foreground font-bold w-20 text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-10 text-foreground/60">
                  불러오는 중…
                </TableCell>
              </TableRow>
            )}
            {!loading && pagedFiltered.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-10 text-foreground/60">
                  표시할 리드가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {pagedFiltered.map((r) => (
              <TableRow
                key={r.id}
                data-lead-row={r.id}
                className={
                  "cursor-pointer border-b border-border hover:bg-muted/40 transition-colors " +
                  (highlightId === r.id ? "bg-amber-50 ring-2 ring-amber-400 animate-pulse" : "")
                }
                onClick={() => setOpenLead(r)}
                data-state={bulk.isSelected(r.id) ? "selected" : undefined}
              >
                <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={bulk.isSelected(r.id)}
                    onCheckedChange={() => bulk.toggle(r.id)}
                    aria-label="행 선택"
                  />
                </TableCell>
                <TableCell className="tabular-nums text-xs text-foreground font-medium whitespace-nowrap py-1.5">
                  {fmtCompactDate(r.created_at)}
                </TableCell>
                <TableCell className="font-bold text-foreground py-1.5 whitespace-nowrap">{r.name ?? "-"}</TableCell>
                <TableCell className="tabular-nums text-foreground font-medium py-1.5 whitespace-nowrap">{r.phone ?? "-"}</TableCell>
                <TableCell className="text-foreground py-1.5">{r.current_carrier ?? "-"}</TableCell>
                <TableCell className="text-foreground text-xs whitespace-nowrap py-1.5" title={r.desired_device ?? ""}>{r.desired_device ?? "-"}</TableCell>
                <TableCell className="text-foreground text-xs whitespace-nowrap py-1.5" title={r.desired_product ?? ""}>{r.desired_product ?? "-"}</TableCell>
                <TableCell className="text-xs text-foreground whitespace-nowrap py-1.5" title={r.campaign_name ?? ""}>
                  {r.campaign_name ?? "-"}
                  {sourceTab === "udak" && r.utm_campaign && (
                    <span className="ml-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200">{r.utm_campaign}</span>
                  )}
                </TableCell>
                <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={r.assigned_to ?? "none"}
                    onValueChange={(v) => updateAssignee(r.id, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="담당자 지정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">담당자 지정</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateStatus(r.id, v)}
                  >
                    <SelectTrigger
                      className={`h-8 text-xs ${STATUS_COLOR[r.status] ?? ""}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(r.campaign_name === "도그마루_홈캠" ? STATUS_OPTIONS_DOGMARU : (r.channel === "유닥" || r.channel === "메타광고") ? STATUS_OPTIONS_UDAK : STATUS_OPTIONS_META).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell
                  className="w-[200px] max-w-[200px] text-xs text-foreground whitespace-nowrap overflow-hidden text-ellipsis py-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenLead(r);
                  }}
                >
                  {(() => {
                    const absenceMatch = (r.memo ?? "").match(/부재\/(\d+)회/);
                    const absenceNum = absenceMatch ? parseInt(absenceMatch[1]) : 0;
                    return (
                      <div className="flex items-center gap-1.5">
                        {absenceNum > 0 && (
                          <span className="flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                            🚫 {absenceNum}회
                          </span>
                        )}
                        <span>{r.memo?.replace(/부재\/\d+회\s*\/?/g, "").trim() || <span className="italic text-foreground/40">메모 추가…</span>}</span>
                      </div>
                    );
                  })()}
                </TableCell>
                {sourceTab !== "udak" && (
                  <TableCell className="text-center py-1.5">
                    {r.happy_call === "O" ? (
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-300">O</span>
                    ) : r.happy_call === "X" ? (
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs border border-rose-300">X</span>
                    ) : <span className="text-muted-foreground text-[11px]">-</span>}
                  </TableCell>
                )}
                {sourceTab !== "udak" && (
                  <TableCell className="text-center py-1.5">
                    {r.happy_call_result === "성공" ? (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-300">성공</span>
                    ) : r.happy_call_result === "실패" ? (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] border border-rose-300">실패</span>
                    ) : <span className="text-muted-foreground text-[11px]">-</span>}
                  </TableCell>
                )}
                {sourceTab === "udak" && (() => {
                  const benefits = (r.additional_benefits ?? "").split(",").map(b => b.trim());
                  const has = (k: string) => benefits.includes(k);
                  const plan = r.desired_product ?? "";
                  const is95or115 = plan.includes("95") || plan.includes("115");
                  const ott = benefits.find(b => b.startsWith("ott_"));
                  const ottMap: Record<string,string> = { ott_disney:"디즈니+", ott_netflix:"넷플릭스", ott_tving:"티빙", ott_youtube:"유튜브" };
                  return (
                    <>
                      <TableCell className="text-center py-1.5 text-[10px]">
                        {is95or115 ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            {has("watch") && <span className="text-emerald-600 font-bold">⌚</span>}
                            {has("tab") && <span className="text-blue-600 font-bold">📱</span>}
                            {!has("watch") && !has("tab") && <span className="text-muted-foreground">-</span>}
                          </div>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-[10px]">
                        {is95or115 ? (
                          has("internet")
                            ? <span className="text-emerald-600 font-bold">O</span>
                            : <span className="text-rose-500 font-bold">X</span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-center py-1.5 text-[10px]">
                        {is95or115 && ott
                          ? <span className="text-purple-600 font-bold">{ottMap[ott] ?? ott}</span>
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </>
                  );
                })()}
                <TableCell className="text-center py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setOpenLead(r)}>
                    상세
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
        <PaginationBar
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onChange={setPage}
        />
      </Card>
      )}

      {/* Detail Sheet */}
      <Dialog open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {openLead && (
            <>
              {/* Title block */}
              <DialogHeader className="border-b border-border pb-4">
                <div className="text-xs font-semibold text-foreground/60">
                  인입 일시 ·{" "}
                  {new Date(openLead.created_at).toLocaleString("ko-KR")}
                </div>
                <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                  {openLead.name ?? "이름 없음"}
                  <Badge className={STATUS_COLOR[openLead.status] ?? ""}>
                    {openLead.status}
                  </Badge>
                </DialogTitle>
                <SheetDescription className="sr-only">
                  잠재고객 상세 정보
                </SheetDescription>
              </DialogHeader>

              {/* Info grid */}
              <div className="mt-5 rounded-lg border border-border overflow-hidden">

                {/* 유닥 스냅샷 카드 */}
                {(openLead.channel === "유닥" || openLead.channel === "메타광고") && openLead.desired_device && (
                  <div className="mx-3 my-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">📱</span>
                      <span className="font-bold text-sm">{openLead.desired_device}</span>
                      <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200">{openLead.channel}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {openLead.current_carrier && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">{openLead.current_carrier}</span>}
                      {openLead.storage && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">{openLead.storage}</span>}
                      {openLead.color && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">{openLead.color}</span>}
                      {openLead.desired_product && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">{openLead.desired_product}</span>}
                      {openLead.discount && <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-orange-200 font-medium">{openLead.discount}</span>}
                    </div>
                    {openLead.additional_benefits && (
                      <div className="flex flex-wrap gap-1">
                        {openLead.additional_benefits.split(",").filter(Boolean).map((b, i) => {
                          const bonusMap: Record<string,string> = {
                            watch:"갤럭시 워치", tab:"갤럭시 탭", internet:"인터넷",
                            ott_disney:"디즈니+", ott_netflix:"넷플릭스", ott_tving:"티빙", ott_youtube:"유튜브 프리미엄",
                          };
                          return <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium">🎁 {bonusMap[b.trim()] ?? b.trim()}</span>;
                        })}
                      </div>
                    )}
                    {openLead.estimated_fee && (
                      <div className="mt-2 pt-2 border-t border-orange-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-orange-700 font-semibold">💰 예상 월 부담금</span>
                          <span className="text-sm font-black text-orange-600">{openLead.estimated_fee.toLocaleString()}원/월</span>
                        </div>
                        {openLead.estimated_fee_memo && (
                          <div className="text-[10px] text-orange-500 mt-0.5 text-right">({openLead.estimated_fee_memo})</div>
                        )}
                      </div>
                    )}
                    {openLead.utm_campaign && <div className="mt-2 text-[10px] text-orange-500 font-medium">📣 {openLead.utm_campaign}</div>}
                  </div>
                )}
                {/* ── 편집 가능한 고객 기본 정보 ── */}
                <div className="p-3 border-b border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-foreground/60">고객 기본 정보</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs px-3" onClick={saveLeadInfo} disabled={savingLeadInfo}>
                      {savingLeadInfo ? "저장 중…" : "저장하기"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">고객명</label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-xs" placeholder="고객명" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">연락처</label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(formatPhone(e.target.value))} className="h-8 text-xs" type="tel" inputMode="numeric" maxLength={14} placeholder="010-0000-0000" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">생년월일 (6자리)</label>
                      <Input value={editBirth} onChange={(e) => setEditBirth(e.target.value.replace(/\D+/g, "").slice(0, 6))} className="h-8 text-xs" inputMode="numeric" maxLength={6} placeholder="900101" />
                    </div>
                  </div>
                </div>
                <InfoRow label="현재 통신사" value={openLead.current_carrier} right={{ label: "희망 기종", value: openLead.desired_device }} />
                <InfoRow label="희망 상품" value={openLead.desired_product} right={{ label: "인입 경로", value: openLead.campaign_name ?? openLead.source }} />
                {(openLead.storage || openLead.color) && (
                  <InfoRow label="용량" value={openLead.storage} right={{ label: "색상", value: openLead.color }} />
                )}
                {openLead.discount && (
                  <InfoRow label="할인방식" value={openLead.discount} right={{ label: "가입유형", value: openLead.jointype }} />
                )}
                {(openLead.birth || openLead.consult_time) && (
                  <InfoRow label="상담 희망 시간" value={openLead.consult_time} right={undefined} />
                )}
                {(openLead.channel || openLead.utm_campaign) && (
                  <InfoRow label="채널" value={openLead.channel} right={{ label: "UTM", value: openLead.utm_campaign }} />
                )}

                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3">
                    <div className="text-[11px] font-semibold text-foreground/60 mb-1">담당자</div>
                    <Select
                      value={openLead.assigned_to ?? "none"}
                      onValueChange={(v) => updateAssignee(openLead.id, v === "none" ? null : v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="담당자 지정" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">담당자 지정</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3">
                    <div className="text-[11px] font-semibold text-foreground/60 mb-1">상담 상태</div>
                    <Select
                      value={openLead.status}
                      onValueChange={(v) => updateStatus(openLead.id, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(openLead.campaign_name === "도그마루_홈캠" ? STATUS_OPTIONS_DOGMARU : (openLead.channel === "유닥" || openLead.channel === "메타광고") ? STATUS_OPTIONS_UDAK : STATUS_OPTIONS_META).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 해피콜 - 유닥/메타광고는 숨김 */}
              {(openLead.channel !== "유닥" && openLead.channel !== "메타광고") && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-foreground">📞 해피콜</div>
                  <div className="text-[10px] text-muted-foreground">해피콜 팀 작성</div>
                </div>
                <div className="flex gap-2">
                  {(["O", "X"] as const).map((v) => (
                    <button key={v} onClick={() => setOpenLead({ ...openLead, happy_call: openLead.happy_call === v ? null : v })}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-colors ${openLead.happy_call === v ? (v === "O" ? "bg-emerald-100 text-emerald-700 border-emerald-400" : "bg-rose-100 text-rose-700 border-rose-400") : "bg-background border-border text-muted-foreground hover:bg-muted/60"}`}>
                      {v === "O" ? "✅ O (상담 원함)" : "❌ X (거절)"}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">{openLead.happy_call === "O" ? "✅ 인터넷 상담 받을게요!" : openLead.happy_call === "X" ? "❌ 필요 없어요" : "미설정"}</span>
                  <div className="flex gap-2">
                    {openLead.happy_call && <button onClick={() => { setOpenLead({ ...openLead, happy_call: null }); saveHappyCall(openLead, null, openLead.happy_call_result); }} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/60">초기화</button>}
                    <button onClick={() => saveHappyCall(openLead, openLead.happy_call, openLead.happy_call_result)} disabled={happyCallSaving} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                      {happyCallSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              </div>
              )}
              {/* 영업 결과 - 유닥/메타광고는 숨김 */}
              {(openLead.channel !== "유닥" && openLead.channel !== "메타광고") && (
              <div className={`mt-2 p-4 rounded-xl border space-y-2 transition-opacity ${openLead.happy_call === "O" ? "border-border bg-muted/30 opacity-100" : "border-dashed border-border/50 bg-muted/10 opacity-40 pointer-events-none"}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-foreground">💼 영업 결과</div>
                  <div className="text-[10px] text-muted-foreground">해피콜 O인 경우만 활성</div>
                </div>
                <div className="flex gap-2">
                  {([["성공","bg-emerald-100 text-emerald-700 border-emerald-400"],["실패","bg-rose-100 text-rose-700 border-rose-400"],["부재","bg-orange-100 text-orange-700 border-orange-400"]] as const).map(([v, ac]) => (
                    <button key={v} onClick={() => setOpenLead({ ...openLead, happy_call_result: openLead.happy_call_result === v ? null : v })}
                      className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-colors ${openLead.happy_call_result === v ? ac : "bg-background border-border text-muted-foreground"}`}>
                      {v === "성공" ? "✅ 성공" : v === "실패" ? "❌ 실패" : "📵 부재"}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">{openLead.happy_call_result ? `현재: ${openLead.happy_call_result}` : "⚠️ 미설정 — 재케어 대상"}</span>
                  <div className="flex gap-2">
                    {openLead.happy_call_result && <button onClick={() => { setOpenLead({ ...openLead, happy_call_result: null }); saveHappyCall(openLead, openLead.happy_call, null); }} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/60">초기화</button>}
                    <button onClick={() => saveHappyCall(openLead, openLead.happy_call, openLead.happy_call_result)} disabled={happyCallSaving} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                      {happyCallSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              </div>
              )}

              {/* Consultation memo feed */}
              <div className="mt-6">
                <div className="text-sm font-bold text-foreground mb-2">상담 메모</div>
                {/* 부재케어 카운터 */}
                <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-2.5 border border-orange-200 mb-3">
                  <span className="text-xs font-semibold text-orange-700 flex-shrink-0">🚫 부재케어</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => adjustAbsenceCount(openLead, -1)}
                      className="size-7 rounded-full bg-white border border-orange-300 text-orange-700 font-bold active:scale-90 transition-transform flex items-center justify-center"
                    >−</button>
                    <span className="text-base font-bold text-orange-700 min-w-[2rem] text-center">
                      {(() => { const m = (openLead.memo ?? "").match(/부재\/(\d+)회/); return (m ? m[1] : 0) + "회"; })()}
                    </span>
                    <button
                      onClick={() => adjustAbsenceCount(openLead, 1)}
                      className="size-7 rounded-full bg-white border border-orange-300 text-orange-700 font-bold active:scale-90 transition-transform flex items-center justify-center"
                    >+</button>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  {(openLead.channel !== "유닥" && openLead.channel !== "메타광고") && (
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => {
                        const date = openLead.registration_date ?? openLead.created_at?.slice(0,10) ?? "";
                        const month = date ? date.slice(5,7).replace(/^0/, "") : "0";
                        const day = date ? date.slice(8,10).replace(/^0/, "") : "0";
                        const msg = `고객님 안녕하세요.\n${month}월 ${day}일 설치하신 홈캠 관련하여 해피콜 연락드린 유플러스 상담원 입니다\n*추가적인 문의사항은 편히 연락 남겨주세요`;
                        const phone = (openLead.phone ?? "").replace(/[^0-9]/g, "");
                        window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, "_blank");
                      }}
                      className="flex-1 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                    >📞 해피콜 문자</button>
                    <button
                      onClick={() => {
                        const date = openLead.registration_date ?? openLead.created_at?.slice(0,10) ?? "";
                        const month = date ? date.slice(5,7).replace(/^0/, "") : "0";
                        const day = date ? date.slice(8,10).replace(/^0/, "") : "0";
                        const msg = `고객님 안녕하세요.\n${month}월 ${day}일 설치하신 홈캠 관련하여 해피콜 연락드렸으나 부재로 문자 남깁니다\n*통화 가능하신 시간 남겨주시면 연락드리겠습니다`;
                        const phone = (openLead.phone ?? "").replace(/[^0-9]/g, "");
                        window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`, "_blank");
                      }}
                      className="flex-1 py-2 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 text-xs font-semibold hover:bg-orange-100 transition-colors"
                    >📵 부재중 문자</button>
                  </div>
                  )}
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="새로운 상담 내용을 입력하세요"
                    rows={3}
                    className="bg-background"
                  />
                  <div className="text-right mt-2">
                    <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                      메모 저장
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(() => {
                    // 노트 + 상태 로그 합쳐서 시간순 정렬
                    const allItems = [
                      ...notes.map(n => ({ type: "note" as const, id: n.id, at: n.created_at, author: n.author_name, content: n.content })),
                      ...statusLogs.map(l => ({ type: "status" as const, id: l.id, at: l.changed_at, author: l.changed_by, content: l.status })),
                    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
                    return (
                      <>
                        <div className="text-xs font-semibold text-foreground/70">
                          누적 상담 이력 ({allItems.length})
                        </div>
                        {allItems.length === 0 && (
                          <div className="text-sm text-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
                            아직 기록된 상담 이력이 없습니다.
                          </div>
                        )}
                        <ol className="relative border-l-2 border-border ml-2 space-y-3">
                          {allItems.map(item => (
                            <li key={item.type + item.id} className="ml-4">
                              <div className={"absolute -left-[7px] mt-1.5 size-3 rounded-full border-2 border-background " + (item.type === "status" ? "bg-orange-400" : "bg-primary")} />
                              <div className={"rounded-lg border p-3 " + (item.type === "status" ? "bg-orange-50 border-orange-200" : "bg-background border-border")}>
                                <div className="text-[11px] text-foreground/60 flex justify-between font-medium">
                                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                                    {item.author ?? "—"}
                                    {item.type === "status" && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">상태변경</span>
                                    )}
                                  </span>
                                  <span>{new Date(item.at).toLocaleString("ko-KR")}</span>
                                </div>
                                <div className={"whitespace-pre-wrap mt-1.5 text-sm " + (item.type === "status" ? "font-semibold text-orange-700" : "text-foreground")}>
                                  {item.type === "status" ? "→ " + item.content : item.content}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Lead Sheet */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>리드 수동 추가</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            {DRAFT_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">메모</label>
              <Textarea
                rows={3}
                value={draft.memo}
                onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                취소
              </Button>
              <Button onClick={createLead}>등록</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {sourceTab !== "other" && (
        <>
          <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteOpen(true)}
              className="h-10 lg:h-8"
            >
              <Trash2 className="size-4 lg:size-3.5 mr-1" /> 선택 삭제
            </Button>
          </BulkActionBar>
          <BulkDeleteDialog
            open={bulkDeleteOpen}
            onOpenChange={setBulkDeleteOpen}
            count={bulk.selectedCount}
            itemLabel="건의 잠재고객을 삭제하시겠습니까?"
            onConfirm={bulkDelete}
            loading={bulkBusy}
            confirmLabel="삭제"
          />
        </>
      )}
      </div>
  );
}

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

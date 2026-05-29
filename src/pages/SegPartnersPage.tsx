import { useMemo, useState, lazy, Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Search, TrendingUp, Calendar as CalIcon, Users, AlertTriangle } from "lucide-react";
import { useSegPartners, useSegActivities, type SegPartner, type SegActivity } from "@/hooks/useSegPartners";
import { PartnerFormDialog } from "@/components/seg/PartnerFormDialog";
import { PartnerDetailDrawer } from "@/components/seg/PartnerDetailDrawer";
import { QuickScheduleDialog } from "@/components/seg/QuickScheduleDialog";
import { ApartmentPostingQuickDialog } from "@/components/seg/ApartmentPostingQuickDialog";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { useSearchParams } from "react-router-dom";

// 통합 화면 내부에 임베드 — 무거운 컴포넌트는 lazy
const SegCalendarPage = lazy(() => import("./SegCalendarPage"));
const ApartmentPage = lazy(() => import("./ApartmentPage"));

const STATUS_LABEL: Record<string, string> = { active: "진행중", paused: "보류", ended: "종료" };
// 상태/뱃지: 배경/테두리 제거, 블랙 텍스트로 통일
const CLEAN_STATUS_CLS = "text-foreground text-[11px] font-medium";

export default function SegPartnersPage() {
  const { partners } = useSegPartners();
  const { activities, refresh: refreshActivities } = useSegActivities();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contractFilter, setContractFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [aptFormOpen, setAptFormOpen] = useState(false);
  const [storefrontOpen, setStorefrontOpen] = useState(false);
  const [selected, setSelected] = useState<SegPartner | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: "partners" | "apartment" | "storefront" =
    tabParam === "apartment" ? "apartment" : tabParam === "storefront" ? "storefront" : "partners";
  const [tab, setTab] = useState<"partners" | "apartment" | "storefront">(initialTab);
  const onTabChange = (v: string) => {
    const next: "partners" | "apartment" | "storefront" =
      v === "apartment" ? "apartment" : v === "storefront" ? "storefront" : "partners";
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };
  const headerCta =
    tab === "apartment"
      ? { label: "아파트게시 등록", onClick: () => setAptFormOpen(true) }
      : tab === "storefront"
      ? { label: "점두활동 등록", onClick: () => setStorefrontOpen(true) }
      : { label: "제휴업체 등록", onClick: () => setFormOpen(true) };

  const filtered = useMemo(() => {
    return partners.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (contractFilter !== "all" && p.contract_type !== contractFilter) return false;
      if (categoryFilter !== "all") {
        const cat = (p.custom_fields as any)?.activity_category;
        if (cat !== categoryFilter) return false;
      }
      if (q.trim()) {
        const s = q.toLowerCase();
        return (
          p.company_name.toLowerCase().includes(s) ||
          (p.contact_name ?? "").toLowerCase().includes(s) ||
          (p.contact_phone ?? "").includes(s)
        );
      }
      return true;
    });
  }, [partners, q, statusFilter, contractFilter, categoryFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const today = format(now, "yyyy-MM-dd");

    const newThisMonth = partners.filter((p) =>
      p.contract_date && isWithinInterval(parseISO(p.contract_date), { start: monthStart, end: monthEnd })
    ).length;
    const active = partners.filter((p) => p.status === "active").length;
    const upcoming = activities.filter((a) => !a.is_completed && a.next_action_date && a.next_action_date >= today).length;
    const overdue = activities.filter((a) => !a.is_completed && a.next_action_date && a.next_action_date < today).length;
    return { newThisMonth, active, upcoming, overdue, total: partners.length };
  }, [partners, activities]);

  const contractTypes = useMemo(() => {
    const set = new Set(partners.map((p) => p.contract_type).filter(Boolean) as string[]);
    return Array.from(set);
  }, [partners]);

  const activityCategories = useMemo(() => {
    const base = ["자체 점두행사", "법인 MOU", "아파트 게시판", "기타"];
    const set = new Set<string>(base);
    partners.forEach((p) => {
      const c = (p.custom_fields as any)?.activity_category;
      if (c && typeof c === "string") set.add(c);
    });
    return Array.from(set);
  }, [partners]);

  return (
    <div className="p-3 sm:p-5 space-y-3 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">SEG. 활동 관리</h1>
            <p className="text-xs text-muted-foreground">통합 영업 캘린더 · 제휴 업체 · 아파트 게시 현황을 한 화면에서 관리합니다.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={headerCta.onClick} className="shadow-sm">
            <Plus className="size-4 mr-1" /> {headerCta.label}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox icon={Users} label="전체 업체" value={stats.total} />
        <StatBox icon={TrendingUp} label="이번 달 신규 계약" value={stats.newThisMonth} tone="success" />
        <StatBox icon={Building2} label="진행중 업체" value={stats.active} tone="primary" />
        <StatBox icon={CalIcon} label="예정 활동" value={stats.upcoming} tone="info" />
        <StatBox icon={AlertTriangle} label="기한 초과" value={stats.overdue} tone="danger" />
      </div>

      {/* ── 상단 고정형 SEG 통합 영업 캘린더 ── */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">캘린더 로딩 중…</div>}>
          <div className="-mt-2">
            <SegCalendarPage />
          </div>
        </Suspense>
      </Card>

      {/* ── 하단 탭 (3대 핵심 활동) ── */}
      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl h-11">
          <TabsTrigger value="partners" className="text-sm font-semibold">제휴업체 목록</TabsTrigger>
          <TabsTrigger value="apartment" className="text-sm font-semibold">아파트 게시</TabsTrigger>
          <TabsTrigger value="storefront" className="text-sm font-semibold">점두 활동</TabsTrigger>
        </TabsList>

        <TabsContent value="partners" className="mt-4 space-y-3">
          <Card className="p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="업체명, 담당자, 연락처 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">진행중</SelectItem>
            <SelectItem value="paused">보류</SelectItem>
            <SelectItem value="ended">종료</SelectItem>
          </SelectContent>
        </Select>
        <Select value={contractFilter} onValueChange={setContractFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 계약유형</SelectItem>
            {contractTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">활동 분류별 보기</SelectItem>
            {activityCategories.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
          </Card>

          {/* 엑셀식 가로 리스트 */}
          <Card className="overflow-hidden border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-slate-700">
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">업체명</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">활동 분류</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">제휴 유형</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">담당자</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">연락처</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">계약일자</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap text-right">활동수</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">진행상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                        등록된 업체가 없습니다. 우측 상단 [신규 업체] 버튼으로 추가하세요.
                      </td>
                    </tr>
                  )}
                  {filtered.map((p) => {
                    const partnerActs = activities.filter((a) => a.partner_id === p.id);
                    const today = format(new Date(), "yyyy-MM-dd");
                    const overdue = partnerActs.find((a) => !a.is_completed && a.next_action_date && a.next_action_date < today);
                    const category = (p.custom_fields as any)?.activity_category as string | undefined;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => { setSelected(p); setDrawerOpen(true); }}
                        className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50/70 transition-colors text-slate-900"
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-semibold">{p.company_name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{category ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.contract_type ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{p.contact_name ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{p.contact_phone ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{p.contract_date ?? "-"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums">{partnerActs.length}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-slate-900 font-medium">{STATUS_LABEL[p.status] ?? p.status}</span>
                          {overdue && <span className="ml-2 text-rose-600 text-xs">기한 초과</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="apartment" className="mt-4">
          <Card className="p-0 overflow-hidden border-slate-200">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">아파트 게시 현황 로딩 중…</div>}>
              <ApartmentPage />
            </Suspense>
          </Card>
        </TabsContent>

        <TabsContent value="storefront" className="mt-4">
          <StorefrontActivityTable
            activities={activities}
            partners={partners}
          />
        </TabsContent>
      </Tabs>

      <PartnerFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <PartnerDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} partner={selected} />
      <ApartmentPostingQuickDialog open={aptFormOpen} onOpenChange={setAptFormOpen} />
      <QuickScheduleDialog
        open={storefrontOpen}
        onOpenChange={setStorefrontOpen}
        defaultDate={format(new Date(), "yyyy-MM-dd")}
        editing={null}
        onSaved={refreshActivities}
      />
    </div>
  );
}

function StorefrontActivityTable({
  activities,
  partners,
}: {
  activities: SegActivity[];
  partners: SegPartner[];
}) {
  const partnerMap = useMemo(() => {
    const m = new Map<string, SegPartner>();
    partners.forEach((p) => m.set(p.id, p));
    return m;
  }, [partners]);

  const rows = useMemo(() => {
    const KW = ["점두", "가판", "판촉", "매장 앞", "스트리트"];
    return activities.filter((a) => {
      const partner = partnerMap.get(a.partner_id);
      const partnerCat = (partner?.custom_fields as any)?.activity_category as string | undefined;
      if (partnerCat === "자체 점두행사") return true;
      const haystack = `${a.activity_type ?? ""} ${a.title ?? ""} ${a.content ?? ""} ${a.location ?? ""}`;
      return KW.some((k) => haystack.includes(k));
    });
  }, [activities, partnerMap]);

  return (
    <Card className="overflow-hidden border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-slate-700">
              <th className="px-3 py-2 font-semibold whitespace-nowrap">활동일자</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">시간</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">업체/매장</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">행사 유형</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">제목</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">장소</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">담당자</th>
              <th className="px-3 py-2 font-semibold whitespace-nowrap">진행상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  등록된 점두 활동이 없습니다. 제휴업체 상세에서 활동을 [자체 점두행사] 분류로 기록하면 자동 집계됩니다.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const partner = partnerMap.get(a.partner_id);
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors text-slate-900">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{a.activity_date}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{a.activity_time ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{partner?.company_name ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.activity_type ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.title ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.location ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{a.assignee_name ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-slate-900 font-medium">
                      {a.is_completed ? "완료" : "진행중"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatBox({ icon: Icon, label, value, tone = "muted" }: { icon: any; label: string; value: number; tone?: string }) {
  const cls = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    info: "from-blue-500/15 to-blue-500/5 text-blue-600",
    danger: "from-rose-500/15 to-rose-500/5 text-rose-600",
    muted: "from-muted to-muted/40 text-muted-foreground",
  }[tone] ?? "from-muted to-muted/40 text-muted-foreground";
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className={`size-10 rounded-xl bg-gradient-to-br ${cls} grid place-items-center`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}
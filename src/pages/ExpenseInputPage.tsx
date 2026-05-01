import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, PlusCircle, Megaphone, Receipt, Download, Building2, Banknote, Wallet, TrendingUp, Coins, Sparkles, Repeat, CalendarClock, Pencil, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { Switch } from "@/components/ui/switch";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, AD_SPEND_COLUMNS } from "@/lib/excelExport";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { PurgeByFilterDialog, type PurgeFilter } from "@/components/common/PurgeByFilterDialog";
import { useRole } from "@/hooks/useRole";

const PAGE_SIZE = 25;

interface ExpenseRow {
  id: string;
  created_by: string;
  spend_date: string;
  spend_month: string | null;
  category: string;
  media: string;
  expense_type: string | null;
  channel: string | null;
  amount: number;
  campaign: string | null;
  note: string | null;
  payment_method?: string | null;
  card_name?: string | null;
  card_last4?: string | null;
}

const formatKRW = (n: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n);

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * 로컬 타임존 기준 YYYY-MM-DD 문자열로 변환.
 * `Date.toISOString()` 는 UTC 기준이라 KST(+09:00) 환경에서 자정이 전날로 밀리는
 * 버그(예: 28일 선택 → 27일 저장)를 방지하기 위해 로컬 컴포넌트를 직접 조립한다.
 */
const toLocalISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function ExpenseInputPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { options: MEDIA_OPTIONS } = useFieldOptions("media");
  const { options: CHANNELS } = useFieldOptions("channel");
  const { options: EXPENSE_TYPES } = useFieldOptions("expense_type");
  const { options: FIXED_EXPENSE_TYPES } = useFieldOptions("fixed_expense_type");

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"광고비" | "기타지출" | "고정지출">("광고비");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const { startDate, endDate, label: periodLabel } = usePeriod();

  // bulk
  const bulk = useBulkSelection<string>(rows.map((r) => r.id));
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("ad_spend").delete().in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    toast.success(`${bulk.selectedIds.length}건 삭제됨`);
    setBulkDeleteOpen(false);
    bulk.clear();
    fetchRows();
  };

  // sales 자동 집계 — 기간 합계 + 오늘 현금시재
  const [salesAgg, setSalesAgg] = useState({
    distributor: 0,
    cash: 0,
    receivable: 0,
    todayCash: 0,
    todayReceivable: 0,
  });
  useEffect(() => {
    (async () => {
      const today = todayISO();
      // 기간 합계
      const { data: periodData } = await supabase
        .from("sales")
        .select("distributor_amount, cash_support_amount, cash_open, receivable_amount, receivable_paid")
        .gte("open_date", startDate)
        .lte("open_date", endDate);
      // 오늘 현금시재 (open_date=오늘 & cash_open) + (receivable_paid=오늘)
      const { data: todayData } = await supabase
        .from("sales")
        .select("cash_support_amount, cash_open, receivable_amount, receivable_paid, open_date")
        .or(`open_date.eq.${today},receivable_paid.eq.${today}`);

      const agg = { distributor: 0, cash: 0, receivable: 0, todayCash: 0, todayReceivable: 0 };
      (periodData ?? []).forEach((r: any) => {
        agg.distributor += Number(r.distributor_amount ?? 0);
        if (r.cash_open) agg.cash += Number(r.cash_support_amount ?? 0);
        if (r.receivable_paid) agg.receivable += Number(r.receivable_amount ?? 0);
      });
      (todayData ?? []).forEach((r: any) => {
        if (r.cash_open && r.open_date === today) agg.todayCash += Number(r.cash_support_amount ?? 0);
        if (r.receivable_paid === today) agg.todayReceivable += Number(r.receivable_amount ?? 0);
      });
      setSalesAgg(agg);
    })();
  }, [startDate, endDate]);

  const [adForm, setAdForm] = useState({
    spend_date: todayISO(),
    end_date: todayISO(),
    media: "",
    channel: "",
    amount: "",          // 입력 금액 (모드에 따라 일별 또는 총액)
    amount_mode: "total" as "daily" | "total", // 입력 모드
    total_override: "",  // daily 모드 시 사용자가 수기로 수정한 최종 합산 금액
    total_overridden: false,
    campaign: "",
    note: "",
    payment_method: "",
    card_name: "",
    card_last4: "",
  });

  const [etcForm, setEtcForm] = useState({
    spend_date: todayISO(),
    expense_type: "",
    amount: "",
    campaign: "",
    note: "",
    payment_method: "",
    card_name: "",
    card_last4: "",
  });

  const [fixedForm, setFixedForm] = useState({
    spend_date: todayISO(),
    expense_type: "",
    amount: "",
    vendor: "",
    note: "",
    auto_register: true,
    day_of_month: 1,
    payment_method: "",
    card_name: "",
    card_last4: "",
  });

  // recurring expense templates
  interface RecurringRow {
    id: string;
    created_by: string;
    expense_type: string;
    amount: number;
    vendor: string | null;
    note: string | null;
    active: boolean;
    auto_register: boolean;
    day_of_month: number;
    last_generated_month: string | null;
  }
  const [recurring, setRecurring] = useState<RecurringRow[]>([]);
  const fetchRecurring = async () => {
    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setRecurring((data ?? []) as RecurringRow[]);
  };
  useEffect(() => {
    fetchRecurring();
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("ad_spend")
      .select("*", { count: "exact" })
      .gte("spend_date", startDate)
      .lte("spend_date", endDate)
      .order("spend_date", { ascending: false })
      .range(from, to);
    if (error) toast.error("불러오기 실패: " + error.message);
    else {
      setRows((data ?? []) as ExpenseRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate]);

  useEffect(() => {
    setPage(0);
  }, [startDate, endDate]);

  const handleExport = async () => {
    const { data, error } = await supabase
      .from("ad_spend")
      .select("*")
      .gte("spend_date", startDate)
      .lte("spend_date", endDate)
      .order("spend_date", { ascending: false });
    if (error) return toast.error("엑셀 내보내기 실패: " + error.message);
    exportToExcel(data ?? [], AD_SPEND_COLUMNS, `지출내역_${periodLabel.replace(/\s/g, "")}`, "지출");
  };

  const totals = useMemo(() => {
    const ad = rows.filter((r) => r.category === "광고비");
    const etc = rows.filter((r) => r.category === "기타지출");
    const fixed = rows.filter((r) => r.category === "고정지출");
    const sum = (xs: ExpenseRow[]) => xs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const adTotal = sum(ad);
    const etcTotal = sum(etc);
    const fixedTotal = sum(fixed);
    const byMedia = ad.reduce<Record<string, number>>((acc, r) => {
      acc[r.media] = (acc[r.media] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    const byType = etc.reduce<Record<string, number>>((acc, r) => {
      const k = r.expense_type ?? "기타";
      acc[k] = (acc[k] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    const byFixed = fixed.reduce<Record<string, number>>((acc, r) => {
      const k = r.expense_type ?? r.media ?? "기타";
      acc[k] = (acc[k] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    return { adTotal, etcTotal, fixedTotal, byMedia, byType, byFixed, total: adTotal + etcTotal + fixedTotal };
  }, [rows]);

  const submitAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!adForm.media || !adForm.amount || !adForm.spend_date) {
      toast.error("집행일·매체·금액은 필수입니다");
      return;
    }
    if (adForm.end_date && adForm.end_date < adForm.spend_date) {
      toast.error("종료일은 집행일 이후여야 합니다");
      return;
    }
    const start = new Date(adForm.spend_date + "T00:00:00");
    const end = new Date((adForm.end_date || adForm.spend_date) + "T00:00:00");
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const inputAmount = Number(adForm.amount.replace(/[^0-9.-]/g, "")) || 0;
    // daily 모드에서 사용자가 [최종 합산 금액]을 수기로 수정한 경우 그 값을 우선 사용
    const overrideTotal = Number((adForm.total_override || "").replace(/[^0-9.-]/g, "")) || 0;
    const useOverride = adForm.amount_mode === "daily" && adForm.total_overridden && overrideTotal > 0;
    const totalAmount = useOverride
      ? overrideTotal
      : adForm.amount_mode === "total"
        ? inputAmount
        : inputAmount * days;
    const dailyAmount = useOverride
      ? Math.round(overrideTotal / days)
      : adForm.amount_mode === "daily"
        ? inputAmount
        : Math.round(inputAmount / days);

    // 기간 동안 매일 ad_spend 행을 생성하여 일자별로 자동 분산
    const inserts = [] as any[];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      // 로컬 기준으로 변환해야 KST 자정이 전날(UTC) 로 밀리지 않는다.
      const dateISO = toLocalISO(d);
      inserts.push({
        created_by: user.id,
        category: "광고비",
        spend_date: dateISO,
        spend_month: dateISO.slice(0, 7),
        media: adForm.media,
        channel: adForm.channel || null,
        amount: dailyAmount,
        campaign: adForm.campaign || null,
        payment_method: adForm.payment_method || null,
        card_name: adForm.card_name || null,
        card_last4: adForm.card_last4 || null,
        note:
          (adForm.note ? adForm.note + " · " : "") +
          (days > 1
            ? `[기간분산 ${adForm.spend_date}~${adForm.end_date} · 일${dailyAmount.toLocaleString()}원 / 총${totalAmount.toLocaleString()}원]`
            : ""),
      });
    }
    setSaving(true);
    const { error } = await supabase.from("ad_spend").insert(inserts);
    setSaving(false);
    if (error) return toast.error("저장 실패: " + error.message);
    toast.success(
      days > 1
        ? `${days}일에 걸쳐 일별 ${dailyAmount.toLocaleString()}원씩 자동 분산 저장됨 (총 ${totalAmount.toLocaleString()}원)`
        : "광고비가 저장되었습니다",
    );
    setAdForm({ spend_date: todayISO(), end_date: todayISO(), media: "", channel: "", amount: "", amount_mode: "total", total_override: "", total_overridden: false, campaign: "", note: "", payment_method: "", card_name: "", card_last4: "" });
    fetchRows();
  };

  const submitEtc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!etcForm.expense_type || !etcForm.amount || !etcForm.spend_date) {
      toast.error("집행일·항목·금액은 필수입니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ad_spend").insert({
      created_by: user.id,
      category: "기타지출",
      spend_date: etcForm.spend_date,
      spend_month: etcForm.spend_date.slice(0, 7),
      media: etcForm.expense_type,
      expense_type: etcForm.expense_type,
      channel: null,
      amount: Number(etcForm.amount.replace(/[^0-9.-]/g, "")) || 0,
      campaign: etcForm.campaign || null,
      payment_method: etcForm.payment_method || null,
      card_name: etcForm.card_name || null,
      card_last4: etcForm.card_last4 || null,
      note: etcForm.note || null,
    });
    setSaving(false);
    if (error) return toast.error("저장 실패: " + error.message);
    toast.success("지출이 저장되었습니다");
    setEtcForm({ spend_date: todayISO(), expense_type: "", amount: "", campaign: "", note: "", payment_method: "", card_name: "", card_last4: "" });
    fetchRows();
  };

  const submitFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fixedForm.expense_type || !fixedForm.amount || !fixedForm.spend_date) {
      toast.error("집행일·항목·금액은 필수입니다");
      return;
    }
    setSaving(true);
    const amount = Number(fixedForm.amount.replace(/[^0-9.-]/g, "")) || 0;
    const { error } = await supabase.from("ad_spend").insert({
      created_by: user.id,
      category: "고정지출",
      spend_date: fixedForm.spend_date,
      spend_month: fixedForm.spend_date.slice(0, 7),
      media: fixedForm.expense_type,
      expense_type: fixedForm.expense_type,
      channel: null,
      amount,
      campaign: fixedForm.vendor || null,
      payment_method: fixedForm.payment_method || null,
      card_name: fixedForm.card_name || null,
      card_last4: fixedForm.card_last4 || null,
      note: fixedForm.note || null,
    });
    if (error) {
      setSaving(false);
      return toast.error("저장 실패: " + error.message);
    }

    // Optionally save as recurring template
    if (fixedForm.auto_register) {
      const monthKey = fixedForm.spend_date.slice(0, 7);
      await supabase.from("recurring_expenses").insert({
        created_by: user.id,
        expense_type: fixedForm.expense_type,
        amount,
        vendor: fixedForm.vendor || null,
        note: fixedForm.note || null,
        active: true,
        auto_register: true,
        day_of_month: Math.min(28, Math.max(1, fixedForm.day_of_month || 1)),
        last_generated_month: monthKey,
      });
      toast.success("고정지출 저장 + 매월 자동 등록 템플릿 추가");
      fetchRecurring();
    } else {
      toast.success("고정지출이 저장되었습니다");
    }
    setSaving(false);
    setFixedForm({ spend_date: todayISO(), expense_type: "", amount: "", vendor: "", note: "", auto_register: true, day_of_month: 1, payment_method: "", card_name: "", card_last4: "" });
    fetchRows();
  };

  const toggleRecurringActive = async (r: RecurringRow) => {
    const { error } = await supabase
      .from("recurring_expenses")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else fetchRecurring();
  };

  const deleteRecurring = async (id: string) => {
    if (!confirm("이 자동등록 템플릿을 삭제할까요?")) return;
    const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("삭제됨"); fetchRecurring(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 지출 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("ad_spend").delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else {
      toast.success("삭제되었습니다");
      fetchRows();
    }
  };

  // 수정 다이얼로그
  const [editRow, setEditRow] = useState<ExpenseRow | null>(null);
  const [editForm, setEditForm] = useState<{
    spend_date: string; media: string; expense_type: string; channel: string;
    amount: string; campaign: string; note: string;
    payment_method: string; card_name: string; card_last4: string;
  }>({
    spend_date: "", media: "", expense_type: "", channel: "",
    amount: "", campaign: "", note: "",
    payment_method: "", card_name: "", card_last4: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  const openEdit = (r: ExpenseRow) => {
    setEditRow(r);
    setEditForm({
      spend_date: r.spend_date,
      media: r.media ?? "",
      expense_type: r.expense_type ?? "",
      channel: r.channel ?? "",
      amount: String(r.amount ?? ""),
      campaign: r.campaign ?? "",
      note: r.note ?? "",
      payment_method: r.payment_method ?? "",
      card_name: r.card_name ?? "",
      card_last4: r.card_last4 ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    const amount = Number((editForm.amount || "").replace(/[^0-9.-]/g, "")) || 0;
    const { error } = await supabase
      .from("ad_spend")
      .update({
        spend_date: editForm.spend_date,
        spend_month: editForm.spend_date.slice(0, 7),
        media: editForm.media || editForm.expense_type,
        expense_type: editForm.expense_type || null,
        channel: editForm.channel || null,
        amount,
        campaign: editForm.campaign || null,
        note: editForm.note || null,
        payment_method: editForm.payment_method || null,
        card_name: editForm.card_name || null,
        card_last4: editForm.card_last4 || null,
      })
      .eq("id", editRow.id);
    setEditSaving(false);
    if (error) return toast.error("수정 실패: " + error.message);
    toast.success("수정되었습니다");
    setEditRow(null);
    fetchRows();
  };

  return (
    <div>
      <Header
        title="지출 비용 입력"
        subtitle="광고비와 그 외 운영 지출을 모두 기록하면 지출/ROI 대시보드에 자동 반영됩니다"
        showScopeToggle={false}
        showPeriodFilter
      />

      {/* 핵심 KPI: 총지출 / 실질마진 / 오늘 현금시재 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-5 glass border-expense/30 bg-[hsl(var(--expense-soft))]/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5 text-expense" /> 총 지출 (실시간)
          </div>
          <div className="mt-2 text-3xl font-bold text-expense tabular-nums">
            {formatKRW(totals.total + salesAgg.distributor + salesAgg.receivable)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            광고비 + 기타지출 + <span className="text-foreground">유통망 지원금</span> + <span className="text-foreground">고객입금(고객 지급)</span>
          </div>
        </Card>

        <Card className="p-5 glass border-primary/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary-glow" /> 실질 마진 (현금흐름 기준)
          </div>
          <div className="mt-2 text-3xl font-bold text-gradient tabular-nums">
            {formatKRW(-(salesAgg.distributor + salesAgg.receivable + totals.adTotal))}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            − (유통망지원금 + 고객입금 + 마케팅비) · 리베이트는 정산 후 합산
          </div>
        </Card>

        <Card className="p-5 glass border-revenue/30 bg-[hsl(var(--revenue-soft))]/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-revenue" /> 오늘 현금 시재 (보유해야 할 금액)
          </div>
          <div className="mt-2 text-3xl font-bold text-revenue tabular-nums">
            {formatKRW(salesAgg.todayCash)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            오늘 현금개통 {formatKRW(salesAgg.todayCash)} · 고객이 매장에 납부한 현금
          </div>
        </Card>
      </div>

      {/* 세부 분류 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground">전체 지출 누적</div>
          <div className="mt-2 text-2xl font-bold text-gradient">{formatKRW(totals.total)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">광고+기타 (수동 입력만)</div>
        </Card>
        <Card className="p-5 glass">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Megaphone className="size-3.5" /> 광고비
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(totals.adTotal)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">매체별 마케팅 집행</div>
        </Card>
        <Card className="p-5 glass">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Receipt className="size-3.5" /> 기타 지출
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(totals.etcTotal)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">임대료 · 통신비 · 운영비 등</div>
        </Card>
        <Card className="p-5 glass border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Repeat className="size-3.5" /> 고정지출
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(totals.fixedTotal)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">SaaS · 렌탈 · 구독 등 매월 반복</div>
        </Card>
        <Card className="p-5 glass border-expense/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="size-3.5" /> 유통망 지원금 (지출)
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(salesAgg.distributor)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">실적 자동 집계 · 지출 합산</div>
        </Card>
        <Card className="p-5 glass border-expense/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="size-3.5" /> 고객입금 금액 (지출)
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(salesAgg.receivable)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">우리가 고객에게 지급 · 지출 합산</div>
        </Card>
        <Card className="p-5 glass border-primary/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Banknote className="size-3.5" /> 현금개통 금액 (시재)
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{formatKRW(salesAgg.cash)}</div>
          <div className="text-[11px] text-muted-foreground mt-1">고객이 현금 완납 · 매장 시재 유입</div>
        </Card>
      </div>

      <Card className="p-6 glass mb-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "광고비" | "기타지출" | "고정지출")}>
          <TabsList className="mb-5">
            <TabsTrigger value="광고비" className="gap-2">
              <Megaphone className="size-4" /> 광고비
            </TabsTrigger>
            <TabsTrigger value="기타지출" className="gap-2">
              <Receipt className="size-4" /> 기타 지출
            </TabsTrigger>
            <TabsTrigger value="고정지출" className="gap-2">
              <Repeat className="size-4" /> 고정지출
            </TabsTrigger>
          </TabsList>

          <TabsContent value="광고비">
            <form onSubmit={submitAd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>집행일 (시작) *</Label>
                <Input type="date" value={adForm.spend_date}
                  onChange={(e) => setAdForm({ ...adForm, spend_date: e.target.value })} />
              </div>
              <div>
                <Label>종료일</Label>
                <Input type="date" value={adForm.end_date} min={adForm.spend_date}
                  onChange={(e) => setAdForm({ ...adForm, end_date: e.target.value })} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  기간 입력 시 일자별로 자동 분산되어 저장됩니다
                </p>
              </div>
              <div>
                <Label>매체 *</Label>
                <Select value={adForm.media} onValueChange={(v) => setAdForm({ ...adForm, media: v })}>
                  <SelectTrigger><SelectValue placeholder="매체 선택" /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>인입 경로 (선택)</Label>
                <Select value={adForm.channel} onValueChange={(v) => setAdForm({ ...adForm, channel: v })}>
                  <SelectTrigger><SelectValue placeholder="해당 채널" /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금액 입력 방식 *</Label>
                <Select
                  value={adForm.amount_mode}
                  onValueChange={(v: "daily" | "total") => setAdForm({ ...adForm, amount_mode: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">최종 합산 금액 (총액 입력)</SelectItem>
                    <SelectItem value="daily">일별 소진 금액 (매일 동일)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  {adForm.amount_mode === "daily" ? "일별 소진 금액 (₩) *" : "최종 합산 금액 (₩) *"}
                </Label>
                <Input inputMode="numeric" placeholder="예: 500000"
                  value={adForm.amount}
                  onChange={(e) => setAdForm({ ...adForm, amount: e.target.value })} />
                {(() => {
                  const start = new Date(adForm.spend_date + "T00:00:00");
                  const end = new Date((adForm.end_date || adForm.spend_date) + "T00:00:00");
                  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
                  const amt = Number((adForm.amount || "").replace(/[^0-9.-]/g, "")) || 0;
                  if (!amt || days < 1) return null;
                  const daily = adForm.amount_mode === "daily" ? amt : Math.round(amt / days);
                  const total = adForm.amount_mode === "total" ? amt : amt * days;
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                      {days}일 · 일별 ₩{daily.toLocaleString()} · 총 ₩{total.toLocaleString()}
                    </p>
                  );
                })()}
              </div>
              {adForm.amount_mode === "daily" && (() => {
                const start = new Date(adForm.spend_date + "T00:00:00");
                const end = new Date((adForm.end_date || adForm.spend_date) + "T00:00:00");
                const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
                const dailyAmt = Number((adForm.amount || "").replace(/[^0-9.-]/g, "")) || 0;
                const autoTotal = dailyAmt * days;
                const displayValue = adForm.total_overridden
                  ? adForm.total_override
                  : (autoTotal ? String(autoTotal) : "");
                return (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      최종 합산 금액 (₩)
                      {adForm.total_overridden && (
                        <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">수기 수정됨</span>
                      )}
                    </Label>
                    <Input
                      inputMode="numeric"
                      placeholder="자동 계산"
                      value={displayValue}
                      onChange={(e) => setAdForm({ ...adForm, total_override: e.target.value, total_overridden: true })}
                    />
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        ※ 기간에 따라 자동 계산되나, 실제 집행액에 맞게 직접 수정 가능합니다.
                      </p>
                      {adForm.total_overridden && (
                        <button
                          type="button"
                          className="text-[10px] text-primary underline shrink-0"
                          onClick={() => setAdForm({ ...adForm, total_override: "", total_overridden: false })}
                        >
                          자동계산 복귀
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="md:col-span-2">
                <Label>캠페인명</Label>
                <Input placeholder="예: 11월 신규개통 프로모션"
                  value={adForm.campaign}
                  onChange={(e) => setAdForm({ ...adForm, campaign: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> 결제수단</Label>
                <Select value={adForm.payment_method} onValueChange={(v) => setAdForm({ ...adForm, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="선택 (신용카드/체크/이체/현금)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="신용카드">신용카드</SelectItem>
                    <SelectItem value="체크카드">체크카드</SelectItem>
                    <SelectItem value="계좌이체">계좌이체</SelectItem>
                    <SelectItem value="현금">현금</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>카드명</Label>
                <Input placeholder="예: 현대카드"
                  value={adForm.card_name}
                  onChange={(e) => setAdForm({ ...adForm, card_name: e.target.value })} />
              </div>
              <div>
                <Label>카드번호 끝 4자리</Label>
                <Input inputMode="numeric" maxLength={4} placeholder="예: 1234"
                  value={adForm.card_last4}
                  onChange={(e) => setAdForm({ ...adForm, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>메모</Label>
                <Textarea rows={2} placeholder="집행 채널 세부, 소재, 타겟 등"
                  value={adForm.note}
                  onChange={(e) => setAdForm({ ...adForm, note: e.target.value })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                <Button type="submit" disabled={saving} className="gap-2">
                  <PlusCircle className="size-4" />
                  {saving ? "저장 중..." : "광고비 저장"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="기타지출">
            <form onSubmit={submitEtc} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>집행일 *</Label>
                <Input type="date" value={etcForm.spend_date}
                  onChange={(e) => setEtcForm({ ...etcForm, spend_date: e.target.value })} />
              </div>
              <div>
                <Label>지출 항목 *</Label>
                <Select value={etcForm.expense_type}
                  onValueChange={(v) => setEtcForm({ ...etcForm, expense_type: v })}>
                  <SelectTrigger><SelectValue placeholder="항목 선택" /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>금액 (₩) *</Label>
                <Input inputMode="numeric" placeholder="예: 1500000"
                  value={etcForm.amount}
                  onChange={(e) => setEtcForm({ ...etcForm, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>거래처 / 적요</Label>
                <Input placeholder="예: ○○부동산 11월 임대료"
                  value={etcForm.campaign}
                  onChange={(e) => setEtcForm({ ...etcForm, campaign: e.target.value })} />
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> 결제수단</Label>
                <Select value={etcForm.payment_method} onValueChange={(v) => setEtcForm({ ...etcForm, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="신용카드">신용카드</SelectItem>
                    <SelectItem value="체크카드">체크카드</SelectItem>
                    <SelectItem value="계좌이체">계좌이체</SelectItem>
                    <SelectItem value="현금">현금</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>카드명</Label>
                <Input placeholder="예: 현대카드"
                  value={etcForm.card_name}
                  onChange={(e) => setEtcForm({ ...etcForm, card_name: e.target.value })} />
              </div>
              <div>
                <Label>카드번호 끝 4자리</Label>
                <Input inputMode="numeric" maxLength={4} placeholder="예: 1234"
                  value={etcForm.card_last4}
                  onChange={(e) => setEtcForm({ ...etcForm, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>메모</Label>
                <Textarea rows={2} placeholder="결제수단, 영수증 번호 등"
                  value={etcForm.note}
                  onChange={(e) => setEtcForm({ ...etcForm, note: e.target.value })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                <Button type="submit" disabled={saving} className="gap-2">
                  <PlusCircle className="size-4" />
                  {saving ? "저장 중..." : "지출 저장"}
                </Button>
              </div>
            </form>
            <p className="text-[11px] text-muted-foreground mt-3">
              💡 항목 종류를 추가/수정하려면 좌측 메뉴 <span className="text-foreground font-medium">입력 항목 관리 → 지출 항목</span>에서 변경하세요.
            </p>
          </TabsContent>

          <TabsContent value="고정지출">
            <form onSubmit={submitFixed} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>집행일 *</Label>
                <Input type="date" value={fixedForm.spend_date}
                  onChange={(e) => setFixedForm({ ...fixedForm, spend_date: e.target.value })} />
              </div>
              <div>
                <Label>고정지출 항목 *</Label>
                <Select value={fixedForm.expense_type}
                  onValueChange={(v) => setFixedForm({ ...fixedForm, expense_type: v })}>
                  <SelectTrigger><SelectValue placeholder="항목 선택" /></SelectTrigger>
                  <SelectContent>
                    {FIXED_EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>월 고정 금액 (₩) *</Label>
                <Input inputMode="numeric" placeholder="예: 29000"
                  value={fixedForm.amount}
                  onChange={(e) => setFixedForm({ ...fixedForm, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>거래처 / 서비스명</Label>
                <Input placeholder="예: Adobe Creative Cloud"
                  value={fixedForm.vendor}
                  onChange={(e) => setFixedForm({ ...fixedForm, vendor: e.target.value })} />
              </div>
              <div>
                <Label>매월 자동 등록일</Label>
                <Input type="number" min={1} max={28}
                  value={fixedForm.day_of_month}
                  onChange={(e) => setFixedForm({ ...fixedForm, day_of_month: Number(e.target.value) })} />
                <p className="text-[10px] text-muted-foreground mt-1">매월 해당일에 자동 생성 (1~28)</p>
              </div>
              <div>
                <Label className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> 결제수단</Label>
                <Select value={fixedForm.payment_method} onValueChange={(v) => setFixedForm({ ...fixedForm, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="신용카드">신용카드</SelectItem>
                    <SelectItem value="체크카드">체크카드</SelectItem>
                    <SelectItem value="계좌이체">계좌이체</SelectItem>
                    <SelectItem value="현금">현금</SelectItem>
                    <SelectItem value="자동이체">자동이체</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>카드명</Label>
                <Input placeholder="예: 현대카드"
                  value={fixedForm.card_name}
                  onChange={(e) => setFixedForm({ ...fixedForm, card_name: e.target.value })} />
              </div>
              <div>
                <Label>카드번호 끝 4자리</Label>
                <Input inputMode="numeric" maxLength={4} placeholder="예: 1234"
                  value={fixedForm.card_last4}
                  onChange={(e) => setFixedForm({ ...fixedForm, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label>메모</Label>
                <Textarea rows={2} placeholder="결제수단, 계정, 갱신 주기 등"
                  value={fixedForm.note}
                  onChange={(e) => setFixedForm({ ...fixedForm, note: e.target.value })} />
              </div>
              <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={fixedForm.auto_register}
                    onCheckedChange={(v) => setFixedForm({ ...fixedForm, auto_register: v })} />
                  <span className="flex items-center gap-1.5">
                    <Repeat className="size-3.5 text-primary" />
                    매월 자동 등록 (템플릿 저장)
                  </span>
                </label>
                <Button type="submit" disabled={saving} className="gap-2">
                  <PlusCircle className="size-4" />
                  {saving ? "저장 중..." : "고정지출 저장"}
                </Button>
              </div>
            </form>
            <p className="text-[11px] text-muted-foreground mt-3">
              💡 항목 종류는 <span className="text-foreground font-medium">입력 항목 관리 → 고정지출 항목</span>에서 직접 추가/수정/삭제할 수 있습니다.
            </p>

            {/* 자동 등록 템플릿 목록 */}
            <div className="mt-6 border-t border-border/50 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CalendarClock className="size-4 text-primary" />
                  매월 자동 등록 템플릿 ({recurring.length})
                </h4>
              </div>
              {recurring.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">아직 등록된 자동 템플릿이 없습니다</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-2 pr-3">항목</th>
                        <th className="text-left py-2 pr-3">거래처</th>
                        <th className="text-right py-2 pr-3">월 금액</th>
                        <th className="text-center py-2 pr-3">등록일</th>
                        <th className="text-center py-2 pr-3">최근 생성월</th>
                        <th className="text-center py-2 pr-3">활성</th>
                        <th className="text-right py-2 pr-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurring.map((r) => (
                        <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="py-2 pr-3 font-medium">{r.expense_type}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{r.vendor ?? "-"}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatKRW(Number(r.amount))}</td>
                          <td className="py-2 pr-3 text-center text-muted-foreground">매월 {r.day_of_month}일</td>
                          <td className="py-2 pr-3 text-center text-muted-foreground">{r.last_generated_month ?? "-"}</td>
                          <td className="py-2 pr-3 text-center">
                            <Switch checked={r.active} onCheckedChange={() => toggleRecurringActive(r)} />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            {(user?.id === r.created_by || isAdmin) && (
                              <Button variant="ghost" size="icon" onClick={() => deleteRecurring(r.id)} className="size-8">
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Megaphone className="size-3.5" /> 매체별 광고비 합계
            <span className="ml-auto text-[11px] tabular-nums text-foreground">{formatKRW(totals.adTotal)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byMedia).length === 0 && (
              <span className="text-sm text-muted-foreground">아직 데이터가 없습니다</span>
            )}
            {Object.entries(totals.byMedia)
              .sort((a, b) => b[1] - a[1])
              .map(([m, v]) => (
                <Badge key={m} variant="outline" className="text-xs">
                  {m} · <span className="ml-1 font-semibold text-foreground">{formatKRW(v)}</span>
                </Badge>
              ))}
          </div>
        </Card>
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Receipt className="size-3.5" /> 항목별 기타지출 합계
            <span className="ml-auto text-[11px] tabular-nums text-foreground">{formatKRW(totals.etcTotal)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byType).length === 0 && (
              <span className="text-sm text-muted-foreground">아직 데이터가 없습니다</span>
            )}
            {Object.entries(totals.byType)
              .sort((a, b) => b[1] - a[1])
              .map(([t, v]) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t} · <span className="ml-1 font-semibold text-foreground">{formatKRW(v)}</span>
                </Badge>
              ))}
          </div>
        </Card>
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Repeat className="size-3.5" /> 항목별 고정지출 합계
            <span className="ml-auto text-[11px] tabular-nums text-foreground">{formatKRW(totals.fixedTotal)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals.byFixed).length === 0 && (
              <span className="text-sm text-muted-foreground">아직 데이터가 없습니다</span>
            )}
            {Object.entries(totals.byFixed)
              .sort((a, b) => b[1] - a[1])
              .map(([t, v]) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t} · <span className="ml-1 font-semibold text-foreground">{formatKRW(v)}</span>
                </Badge>
              ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold">지출 내역 — {periodLabel}</h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="size-4" /> 엑셀로 내보내기
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={() => setPurgeOpen(true)}
                disabled={total === 0}
              >
                <Trash2 className="size-4" /> 기간 전체삭제
              </Button>
            )}
            <span className="text-xs text-muted-foreground">총 {total.toLocaleString()}건</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border/50">
              <tr>
                <th className="w-8 py-2 pr-2">
                  <Checkbox checked={bulk.allOnPageSelected} onCheckedChange={(v) => bulk.togglePage(!!v)} />
                </th>
                <th className="text-left py-2 pr-3">집행일</th>
                <th className="text-left py-2 pr-3">분류</th>
                <th className="text-left py-2 pr-3">매체/항목</th>
                <th className="text-left py-2 pr-3">인입경로</th>
                <th className="text-left py-2 pr-3">캠페인/적요</th>
                <th className="text-left py-2 pr-3 whitespace-nowrap">결제수단</th>
                <th className="text-right py-2 pr-3">금액</th>
                <th className="text-right py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {/* 실적(sales) 자동 집계 — 분류 요약 행 */}
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td />
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground" /> 총 유통망지원금
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">sales.distributor_amount 합계</td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.distributor)}</td>
                <td />
              </tr>
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td />
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Banknote className="size-3.5 text-muted-foreground" /> 현금개통
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">cash_open=true 건의 cash_support_amount 합계</td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.cash)}</td>
                <td />
              </tr>
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td />
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-muted-foreground" /> 입금금액
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">receivable_paid 입력된 건의 receivable_amount 합계</td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.receivable)}</td>
                <td />
              </tr>

              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">불러오는 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">등록된 지출이 없습니다</td></tr>
              ) : (
                rows.map((r) => {
                  const sel = bulk.isSelected(r.id);
                  const cardLabel = r.card_name
                    ? `${r.card_name}${r.card_last4 ? `-${r.card_last4}` : ""}`
                    : (r.payment_method ?? "");
                  return (
                    <tr key={r.id} className={`border-b border-border/30 hover:bg-muted/30 ${sel ? "bg-primary/5" : ""}`} data-state={sel ? "selected" : undefined}>
                      <td className="py-2 pr-2"><Checkbox checked={sel} onCheckedChange={() => bulk.toggle(r.id)} /></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.spend_date}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline"
                          className={`text-[10px] ${
                            r.category === "광고비" ? "border-primary/40 text-primary"
                            : r.category === "고정지출" ? "border-revenue/40 text-revenue"
                            : "border-muted-foreground/40"
                          }`}>
                          {r.category}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 font-medium whitespace-nowrap">{r.expense_type ?? r.media}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.channel ?? "-"}</td>
                      <td className="py-2 pr-3 text-muted-foreground truncate max-w-[240px]">{r.campaign ?? "-"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-foreground">
                        {cardLabel ? (
                          <span className="inline-flex items-center gap-1 text-foreground font-medium">
                            <CreditCard className="size-3 text-muted-foreground" />
                            {cardLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold text-expense">
                        {formatKRW(Number(r.amount))}
                      </td>
                      <td className="py-2 pr-3 text-right whitespace-nowrap">
                        {(user?.id === r.created_by || isAdmin) && (
                          <div className="inline-flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(r)} className="size-8" title="수정">
                              <Pencil className="size-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="size-8" title="삭제">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </Card>

      {isAdmin && (
        <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
          <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
            <Trash2 className="size-3.5 mr-1" /> 선택 삭제
          </Button>
        </BulkActionBar>
      )}

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={bulk.selectedCount}
        itemLabel="건의 지출 내역을 삭제하시겠습니까?"
        onConfirm={bulkDelete}
        loading={bulkBusy}
        confirmLabel="삭제"
      />

      <PurgeByFilterDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        filter={{
          table: "ad_spend",
          filters: [
            { column: "spend_date", op: "gte", value: startDate },
            { column: "spend_date", op: "lte", value: endDate },
            ...(tab === "광고비" ? [{ column: "category", op: "eq" as const, value: "광고비" }] : []),
            ...(tab === "기타지출" ? [{ column: "category", op: "eq" as const, value: "기타지출" }] : []),
            ...(tab === "고정지출" ? [{ column: "category", op: "eq" as const, value: "고정지출" }] : []),
          ],
          summary: `집행일 ${startDate} ~ ${endDate} · 분류=${tab}`,
        }}
        onDone={fetchRows}
      />

      {/* 지출 수정 다이얼로그 */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>지출 내역 수정 {editRow ? `· ${editRow.category}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>집행일</Label>
              <Input type="date" value={editForm.spend_date}
                onChange={(e) => setEditForm({ ...editForm, spend_date: e.target.value })} />
            </div>
            <div>
              <Label>매체/항목</Label>
              <Input value={editForm.media}
                onChange={(e) => setEditForm({ ...editForm, media: e.target.value })} />
            </div>
            <div>
              <Label>인입 경로</Label>
              <Input value={editForm.channel}
                onChange={(e) => setEditForm({ ...editForm, channel: e.target.value })} />
            </div>
            <div>
              <Label>금액 (₩)</Label>
              <Input inputMode="numeric" value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>캠페인 / 적요</Label>
              <Input value={editForm.campaign}
                onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-1.5"><CreditCard className="size-3.5" /> 결제수단</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm({ ...editForm, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="신용카드">신용카드</SelectItem>
                  <SelectItem value="체크카드">체크카드</SelectItem>
                  <SelectItem value="계좌이체">계좌이체</SelectItem>
                  <SelectItem value="자동이체">자동이체</SelectItem>
                  <SelectItem value="현금">현금</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>카드명</Label>
              <Input placeholder="예: 현대카드" value={editForm.card_name}
                onChange={(e) => setEditForm({ ...editForm, card_name: e.target.value })} />
            </div>
            <div>
              <Label>카드번호 끝 4자리</Label>
              <Input inputMode="numeric" maxLength={4} placeholder="예: 1234"
                value={editForm.card_last4}
                onChange={(e) => setEditForm({ ...editForm, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
            </div>
            <div className="md:col-span-2">
              <Label>메모</Label>
              <Textarea rows={3} value={editForm.note}
                onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>취소</Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? "저장 중..." : "수정 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

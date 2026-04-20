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
import { Trash2, PlusCircle, Megaphone, Receipt, Download, Building2, Banknote, Wallet, TrendingUp, Coins, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
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
}

const formatKRW = (n: number) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ExpenseInputPage() {
  const { user } = useAuth();
  const { options: MEDIA_OPTIONS } = useFieldOptions("media");
  const { options: CHANNELS } = useFieldOptions("channel");
  const { options: EXPENSE_TYPES } = useFieldOptions("expense_type");

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"광고비" | "기타지출">("광고비");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const { startDate, endDate, label: periodLabel } = usePeriod();

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
    media: "",
    channel: "",
    amount: "",
    campaign: "",
    note: "",
  });

  const [etcForm, setEtcForm] = useState({
    spend_date: todayISO(),
    expense_type: "",
    amount: "",
    campaign: "",
    note: "",
  });

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
    const sum = (xs: ExpenseRow[]) => xs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const adTotal = sum(ad);
    const etcTotal = sum(etc);
    const byMedia = ad.reduce<Record<string, number>>((acc, r) => {
      acc[r.media] = (acc[r.media] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    const byType = etc.reduce<Record<string, number>>((acc, r) => {
      const k = r.expense_type ?? "기타";
      acc[k] = (acc[k] ?? 0) + Number(r.amount || 0);
      return acc;
    }, {});
    return { adTotal, etcTotal, byMedia, byType, total: adTotal + etcTotal };
  }, [rows]);

  const submitAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!adForm.media || !adForm.amount || !adForm.spend_date) {
      toast.error("집행일·매체·금액은 필수입니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("ad_spend").insert({
      created_by: user.id,
      category: "광고비",
      spend_date: adForm.spend_date,
      spend_month: adForm.spend_date.slice(0, 7),
      media: adForm.media,
      channel: adForm.channel || null,
      amount: Number(adForm.amount.replace(/[^0-9.-]/g, "")) || 0,
      campaign: adForm.campaign || null,
      note: adForm.note || null,
    });
    setSaving(false);
    if (error) return toast.error("저장 실패: " + error.message);
    toast.success("광고비가 저장되었습니다");
    setAdForm({ spend_date: todayISO(), media: "", channel: "", amount: "", campaign: "", note: "" });
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
      note: etcForm.note || null,
    });
    setSaving(false);
    if (error) return toast.error("저장 실패: " + error.message);
    toast.success("지출이 저장되었습니다");
    setEtcForm({ spend_date: todayISO(), expense_type: "", amount: "", campaign: "", note: "" });
    fetchRows();
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
        <Tabs value={tab} onValueChange={(v) => setTab(v as "광고비" | "기타지출")}>
          <TabsList className="mb-5">
            <TabsTrigger value="광고비" className="gap-2">
              <Megaphone className="size-4" /> 광고비
            </TabsTrigger>
            <TabsTrigger value="기타지출" className="gap-2">
              <Receipt className="size-4" /> 기타 지출
            </TabsTrigger>
          </TabsList>

          <TabsContent value="광고비">
            <form onSubmit={submitAd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>집행일 *</Label>
                <Input type="date" value={adForm.spend_date}
                  onChange={(e) => setAdForm({ ...adForm, spend_date: e.target.value })} />
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
                <Label>금액 (₩) *</Label>
                <Input inputMode="numeric" placeholder="예: 500000"
                  value={adForm.amount}
                  onChange={(e) => setAdForm({ ...adForm, amount: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>캠페인명</Label>
                <Input placeholder="예: 11월 신규개통 프로모션"
                  value={adForm.campaign}
                  onChange={(e) => setAdForm({ ...adForm, campaign: e.target.value })} />
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
        </Tabs>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 glass">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Megaphone className="size-3.5" /> 매체별 광고비 합계
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
      </div>

      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold">지출 내역 — {periodLabel}</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="size-4" /> 엑셀로 내보내기
            </Button>
            <span className="text-xs text-muted-foreground">총 {total.toLocaleString()}건</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border/50">
              <tr>
                <th className="text-left py-2 pr-3">집행일</th>
                <th className="text-left py-2 pr-3">분류</th>
                <th className="text-left py-2 pr-3">매체/항목</th>
                <th className="text-left py-2 pr-3">인입경로</th>
                <th className="text-left py-2 pr-3">캠페인/적요</th>
                <th className="text-right py-2 pr-3">금액</th>
                <th className="text-right py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {/* 실적(sales) 자동 집계 — 분류 요약 행 */}
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Building2 className="size-3.5 text-muted-foreground" /> 총 유통망지원금
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">sales.distributor_amount 합계</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.distributor)}</td>
                <td />
              </tr>
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Banknote className="size-3.5 text-muted-foreground" /> 현금개통
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">cash_open=true 건의 cash_support_amount 합계</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.cash)}</td>
                <td />
              </tr>
              <tr className="border-b border-border/40 bg-primary/[0.05]">
                <td className="py-2 pr-3 text-xs text-muted-foreground">기간 합계</td>
                <td className="py-2 pr-3">
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">자동집계</Badge>
                </td>
                <td className="py-2 pr-3 font-medium flex items-center gap-1.5">
                  <Wallet className="size-3.5 text-muted-foreground" /> 입금금액
                </td>
                <td className="py-2 pr-3 text-muted-foreground">-</td>
                <td className="py-2 pr-3 text-muted-foreground text-xs">receivable_paid 입력된 건의 receivable_amount 합계</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold">{formatKRW(salesAgg.receivable)}</td>
                <td />
              </tr>

              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">불러오는 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">등록된 지출이 없습니다</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30">
                    <td className="py-2 pr-3">{r.spend_date}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline"
                        className={`text-[10px] ${r.category === "광고비" ? "border-primary/40 text-primary" : "border-muted-foreground/40"}`}>
                        {r.category}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 font-medium">{r.expense_type ?? r.media}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.channel ?? "-"}</td>
                    <td className="py-2 pr-3 text-muted-foreground truncate max-w-[240px]">{r.campaign ?? "-"}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold text-expense">
                      {formatKRW(Number(r.amount))}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {user?.id === r.created_by && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="size-8">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </Card>
    </div>
  );
}

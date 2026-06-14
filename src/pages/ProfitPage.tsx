import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useIncentivePolicies } from "@/hooks/useIncentivePolicies";
import { useNetFeeFormula, sumRevenue, sumOffer } from "@/hooks/useNetFeeFormula";
import { calcFullIncentive, DEFAULT_LINKAGE } from "@/lib/incentiveEngine";
import { Lock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from "recharts";

type Sale = {
  id: string;
  open_date: string | null;
  open_month: string | null;
  manager: string | null;
  device_model: string | null;
  product: string | null;
  sale_type: string | null;
  net_fee: number | null;
  unit_price: number | null;
  vas_fee: number | null;
  distributor_amount: number | null;
  extra_subsidy: number | null;
  cash_support_amount: number | null;
  customer_support_amount: number | null;
  corp_card_amount: number | null;
  receivable_amount: number | null;
  trade_in_confirmed: number | null;
  trade_in_enabled: boolean;
  bundle: string | null;
  has_offer?: boolean;
  custom_fields: Record<string, any>;
};

// 이상 건 감지
type AnomalyFlag = { emoji: string; label: string };

function detectAnomalies(s: Sale & { netFee?: number }): AnomalyFlag[] {
  const flags: AnomalyFlag[] = [];
  const dbNet = s.net_fee ?? 0;
  const calcNet = s.netFee ?? 0;
  const unit = s.unit_price ?? 0;
  const dist = s.distributor_amount ?? 0;

  // 1. DB net_fee와 계산값이 500원 이상 차이 (직접 입력 의심)
  if (unit > 0 && Math.abs(dbNet - calcNet) > 500) {
    flags.push({ emoji: "⚠️", label: `net_fee 불일치 (DB:${dbNet.toLocaleString()} / 계산:${Math.round(calcNet).toLocaleString()})` });
  }
  // 2. DB net_fee가 비정상적으로 큼 (100만 초과)
  if (dbNet > 1_000_000) {
    flags.push({ emoji: "🚨", label: `DB net_fee 비정상 과다 (${dbNet.toLocaleString()}원)` });
  }
  // 3. 계산 net_fee가 -50만 미만
  if (calcNet < -500_000) {
    flags.push({ emoji: "🔴", label: `순마진 과다 손실 (${Math.round(calcNet).toLocaleString()}원)` });
  }
  // 4. distributor_amount = 0인데 unit_price > 0
  if (dist === 0 && unit > 0) {
    flags.push({ emoji: "❓", label: "유통망 지급액 0원 (누락 의심)" });
  }
  // 5. open_date NULL
  if (!s.open_date) {
    flags.push({ emoji: "📭", label: "개통일 미입력" });
  }
  return flags;
}

const won = (n: number) =>
  n >= 10000
    ? `${(n / 10000).toFixed(1)}만`
    : `${Math.round(n).toLocaleString()}원`;

const wonFull = (n: number) => `${Math.round(n).toLocaleString()}원`;

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];

type Period = "this_month" | "last_month" | "3months" | "all";

export default function ProfitPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { policies } = useIncentivePolicies();
  const { calc: calcNetFee } = useNetFeeFormula();
  const navigate = useNavigate();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [mgPage, setMgPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("id, open_date, open_month, manager, device_model, product, sale_type, net_fee, unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, customer_support_amount, corp_card_amount, receivable_amount, trade_in_confirmed, trade_in_enabled, bundle, custom_fields")
        .order("open_date", { ascending: false });
      setSales((data as Sale[]) ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const now = new Date();
  const getMonthStr = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const filtered = useMemo(() => {
    setPage(0);
    return sales.filter((s) => {
      const m = (s.open_month ?? s.open_date ?? "").slice(0, 7);
      if (period === "this_month") return m === getMonthStr(0);
      if (period === "last_month") return m === getMonthStr(-1);
      if (period === "3months") return m >= getMonthStr(-2) && m <= getMonthStr(0);
      return true;
    });
  }, [sales, period]);

  // 건별 수익 계산
  const saleRows = useMemo(() => {
    return filtered.map((s) => {
      const revenue = sumRevenue(s as any);
      const offer = sumOffer(s as any);
      // 항상 공식으로 재계산 (DB net_fee 직접입력 오류 방지)
      // DB값은 이상 감지 비교용으로만 보존 (s.net_fee)
      const netFee = calcNetFee(s as any);

      // 직원 인센티브 계산
      const saleForIncentive = {
        id: s.id,
        open_date: s.open_date,
        device_model: s.device_model,
        product: s.product,
        sale_type: s.sale_type,
        net_fee: netFee,
        bundle: s.bundle,
        has_offer: s.has_offer,
      };
      const incentiveResult = calcFullIncentive([saleForIncentive], policies, DEFAULT_LINKAGE, 0);
      const incentive = incentiveResult.total;
      const companyProfit = netFee - incentive;

      return {
        ...s,
        revenue,
        offer,
        netFee,
        incentive,
        companyProfit,
      };
    });
  }, [filtered, policies, calcNetFee]);

  // 요약 지표
  const summary = useMemo(() => {
    const totalRevenue = saleRows.reduce((s, r) => s + r.revenue, 0);
    const totalOffer = saleRows.reduce((s, r) => s + r.offer, 0);
    const totalNetFee = saleRows.reduce((s, r) => s + r.netFee, 0);
    const totalIncentive = saleRows.reduce((s, r) => s + r.incentive, 0);
    const totalProfit = saleRows.reduce((s, r) => s + r.companyProfit, 0);
    return { totalRevenue, totalOffer, totalNetFee, totalIncentive, totalProfit, count: saleRows.length };
  }, [saleRows]);

  // 직원별 집계
  const byManager = useMemo(() => {
    const map: Record<string, { name: string; count: number; netFee: number; incentive: number; profit: number }> = {};
    for (const r of saleRows) {
      const name = r.manager ?? "미배정";
      if (!map[name]) map[name] = { name, count: 0, netFee: 0, incentive: 0, profit: 0 };
      map[name].count++;
      map[name].netFee += r.netFee;
      map[name].incentive += r.incentive;
      map[name].profit += r.companyProfit;
    }
    return Object.values(map).sort((a, b) => b.profit - a.profit);
  }, [saleRows]);

  // 일별 추이 (선택 기간)
  const byDay = useMemo(() => {
    const map: Record<string, { date: string; label: string; netFee: number; incentive: number; profit: number; count: number }> = {};
    for (const r of saleRows) {
      const date = r.open_date?.slice(0, 10) ?? "";
      if (!date) continue;
      const d = new Date(date);
      const label = `${d.getMonth()+1}/${d.getDate()}`;
      if (!map[date]) map[date] = { date, label, netFee: 0, incentive: 0, profit: 0, count: 0 };
      map[date].netFee += r.netFee;
      map[date].incentive += r.incentive;
      map[date].profit += r.companyProfit;
      map[date].count++;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [saleRows]);

  // 월별 추이 (전체 기간)
  const byMonth = useMemo(() => {
    const map: Record<string, { month: string; netFee: number; incentive: number; profit: number; count: number }> = {};
    for (const s of sales) {
      const m = (s.open_month ?? s.open_date ?? "").slice(0, 7);
      if (!m) continue;
      const netFee = s.net_fee ?? calcNetFee(s as any);
      const sfi = { id: s.id, open_date: s.open_date, device_model: s.device_model, product: s.product, sale_type: s.sale_type, net_fee: netFee, bundle: s.bundle };
      const inc = calcFullIncentive([sfi], policies, DEFAULT_LINKAGE, 0).total;
      if (!map[m]) map[m] = { month: m, netFee: 0, incentive: 0, profit: 0, count: 0 };
      map[m].netFee += netFee;
      map[m].incentive += inc;
      map[m].profit += netFee - inc;
      map[m].count++;
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  }, [sales, policies, calcNetFee]);

  if (roleLoading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  if (!isAdmin) return (
    <div>
      <Header title="수익 분석" subtitle="관리자 전용 페이지입니다" />
      <Card className="p-10 text-center max-w-lg mx-auto mt-10">
        <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-lg mb-1">관리자 전용</h3>
        <p className="text-sm text-muted-foreground">수익 분석은 관리자만 볼 수 있습니다.</p>
      </Card>
    </div>
  );

  return (
    <div>
      <Header title="수익 분석" subtitle="판매 건별 순수익 · 인센티브 · 회사 실이익 분석" />
      <div className="p-6 space-y-6">

        {/* 기간 필터 */}
        <div className="flex items-center gap-2">
          {([
            { k: "this_month", l: "이번달" },
            { k: "last_month", l: "저번달" },
            { k: "3months", l: "최근 3개월" },
            { k: "all", l: "전체" },
          ] as const).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setPeriod(opt.k)}
              className={
                "px-3 py-1.5 text-xs font-semibold rounded border transition-colors " +
                (period === opt.k
                  ? "bg-primary text-white border-primary"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {opt.l}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">{summary.count}건</span>
        </div>

        {/* 이상 건 요약 배너 */}
        {(() => {
          const anomalyRows = saleRows.filter(r => detectAnomalies(r).length > 0);
          if (anomalyRows.length === 0) return null;
          return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
              <span className="text-lg">⚠️</span>
              <div>
                <span className="font-semibold text-amber-800">이상 건 {anomalyRows.length}건 감지됨</span>
                <span className="text-amber-600 text-xs ml-2">아래 목록에서 이모지로 표시된 행을 확인하세요</span>
              </div>
            </div>
          );
        })()}

        {/* 핵심 지표 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "총 수익", value: summary.totalRevenue, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "총 지출", value: summary.totalOffer, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "순마진(net_fee)", value: summary.totalNetFee, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "인센티브 지급", value: summary.totalIncentive, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "회사 실이익", value: summary.totalProfit, color: summary.totalProfit >= 0 ? "text-blue-600" : "text-red-600", bg: summary.totalProfit >= 0 ? "bg-blue-50" : "bg-red-50" },
          ].map(({ label, value, color, bg }) => (
            <Card key={label} className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={`text-xl font-bold ${color}`}>{wonFull(value)}</div>
            </Card>
          ))}
        </div>

        {/* 일별 추이 차트 */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-4">
            일별 수익 추이
            <span className="text-xs text-muted-foreground font-normal ml-2">({period === "this_month" ? "이번달" : period === "last_month" ? "저번달" : period === "3months" ? "최근 3개월" : "전체"})</span>
          </div>
          {byDay.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">해당 기간 데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byDay} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={Math.floor(byDay.length / 10)} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => won(v)} width={48} />
                <Tooltip
                  formatter={(v: number, name: string) => [wonFull(v), name]}
                  labelFormatter={(l) => l + "일"}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend />
                <Line type="monotone" dataKey="netFee" name="순마진" stroke="#6366f1" strokeWidth={2} dot={{ r: 2.5, fill: "#6366f1", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="incentive" name="인센티브" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5, fill: "#f59e0b", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="profit" name="회사실이익" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* 월별 추이 차트 */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-4">월별 수익 추이 (최근 6개월)</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(2)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => won(v)} width={50} />
              <Tooltip formatter={(v: number, name: string) => [wonFull(v), name]} />
              <Legend />
              <Bar dataKey="netFee" name="순마진" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="incentive" name="인센티브" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="profit" name="회사실이익" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 직원별 집계 */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-4">직원별 수익 기여도</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-2">담당자</th>
                  <th className="text-right py-2 px-2">판매건수</th>
                  <th className="text-right py-2 px-2">순마진 합계</th>
                  <th className="text-right py-2 px-2">인센티브</th>
                  <th className="text-right py-2 px-2 font-bold text-foreground">회사 실이익</th>
                  <th className="text-right py-2 px-2">건당 이익</th>
                </tr>
              </thead>
              <tbody>
                {byManager.map((r, i) => (
                  <tr key={r.name} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 px-2 font-medium flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      {r.name}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">{r.count}건</td>
                    <td className="text-right py-2 px-2 tabular-nums text-indigo-600">{wonFull(r.netFee)}</td>
                    <td className="text-right py-2 px-2 tabular-nums text-amber-600">-{wonFull(r.incentive)}</td>
                    <td className={`text-right py-2 px-2 tabular-nums font-bold ${r.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {wonFull(r.profit)}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-muted-foreground text-xs">
                      {r.count > 0 ? wonFull(r.profit / r.count) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 건별 상세 */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-4">판매 건별 수익 상세</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2 px-2">개통일</th>
                  <th className="text-left py-2 px-2">담당자</th>
                  <th className="text-left py-2 px-2">단말/상품</th>
                  <th className="text-right py-2 px-2">순마진</th>
                  <th className="text-right py-2 px-2">인센티브</th>
                  <th className="text-right py-2 px-2 font-bold text-foreground">실이익</th>
                  <th className="text-center py-2 px-2">상세</th>
                </tr>
              </thead>
              <tbody>
                {saleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r) => {
                  const anomalies = detectAnomalies(r);
                  const hasAnomaly = anomalies.length > 0;
                  return (
                  <>
                    <tr
                      key={r.id}
                      className={`border-b border-border/40 hover:bg-muted/30 cursor-pointer ${hasAnomaly ? "bg-amber-50/60" : ""}`}
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <td className="py-2 px-2 tabular-nums text-xs">{r.open_date?.slice(0, 10) ?? "-"}</td>
                      <td className="py-2 px-2">{r.manager ?? "-"}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">
                        <span>{r.device_model ?? r.product ?? "-"}</span>
                        {hasAnomaly && (
                          <span
                            className="ml-1.5 cursor-help"
                            title={anomalies.map(a => `${a.emoji} ${a.label}`).join("\n")}
                          >
                            {anomalies.map(a => a.emoji).join("")}
                          </span>
                        )}
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-indigo-600">{wonFull(r.netFee)}</td>
                      <td className="text-right py-2 px-2 tabular-nums text-amber-600">-{wonFull(r.incentive)}</td>
                      <td className={`text-right py-2 px-2 tabular-nums font-bold ${r.companyProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {wonFull(r.companyProfit)}
                      </td>
                      <td className="text-center py-2 px-2">
                        {expandedId === r.id ? <ChevronUp className="size-3.5 mx-auto" /> : <ChevronDown className="size-3.5 mx-auto" />}
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr key={r.id + "_detail"} className="bg-muted/20">
                        <td colSpan={7} className="px-4 py-3">
                          {hasAnomaly && (
                            <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                              <div className="text-xs font-semibold text-amber-800 mb-1">⚠️ 이상 항목 감지</div>
                              {anomalies.map((a, i) => (
                                <div key={i} className="text-xs text-amber-700">{a.emoji} {a.label}</div>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground mb-1">수익 항목</div>
                              <div className="flex justify-between"><span className="text-muted-foreground">단가표</span><span>{wonFull(r.unit_price ?? 0)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">부가서비스</span><span>{wonFull(r.vas_fee ?? 0)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">미수금</span><span>{wonFull(r.receivable_amount ?? 0)}</span></div>
                              <div className="flex justify-between font-semibold border-t pt-1"><span>수익 합계</span><span className="text-indigo-600">{wonFull(r.revenue)}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground mb-1">지출 항목</div>
                              <div className="flex justify-between"><span className="text-muted-foreground">유통망</span><span>{wonFull(r.distributor_amount ?? 0)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">현금개통</span><span>{wonFull(r.cash_support_amount ?? 0)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">추가지원금</span><span>{wonFull(r.extra_subsidy ?? 0)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">고객지원금</span><span>{wonFull(r.customer_support_amount ?? 0)}</span></div>
                              <div className="flex justify-between font-semibold border-t pt-1"><span>지출 합계</span><span className="text-rose-600">{wonFull(r.offer)}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground mb-1">수익 계산</div>
                              <div className="flex justify-between"><span className="text-muted-foreground">순마진(net_fee)</span><span className="text-indigo-600">{wonFull(r.netFee)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">인센티브</span><span className="text-amber-600">-{wonFull(r.incentive)}</span></div>
                              <div className="flex justify-between font-bold border-t pt-1"><span>회사 실이익</span><span className={r.companyProfit >= 0 ? "text-emerald-600" : "text-red-500"}>{wonFull(r.companyProfit)}</span></div>
                            </div>
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground mb-1">판매 정보</div>
                              <div className="flex justify-between"><span className="text-muted-foreground">상품</span><span>{r.product ?? "-"}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">판매유형</span><span>{r.sale_type ?? "-"}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">단말</span><span>{r.device_model ?? "-"}</span></div>
                              <div className="pt-2 border-t mt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); navigate(`/input?edit=${r.id}`); }}
                                  className="w-full text-xs px-2 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                                >
                                  📋 실적 건 바로가기 →
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                  );
                })}
              </tbody>
            </table>
            {/* 페이지네이션 */}
            {saleRows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, saleRows.length)}건 / 전체 {saleRows.length}건
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 text-xs rounded border border-border/60 disabled:opacity-30 hover:bg-muted/40"
                  >
                    ← 이전
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold">
                    {page + 1} / {Math.ceil(saleRows.length / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(saleRows.length / PAGE_SIZE) - 1, p + 1))}
                    disabled={(page + 1) * PAGE_SIZE >= saleRows.length}
                    className="px-3 py-1 text-xs rounded border border-border/60 disabled:opacity-30 hover:bg-muted/40"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 개인별 수익 기여도 */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-4">개인별 수익 기여도</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {byManager.map((m) => (
              <div
                key={m.name}
                onClick={() => { setSelectedManager(m.name); setMgPage(0); }}
                className={`rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md ${m.profit >= 0 ? "bg-emerald-50/50 border-emerald-200 hover:border-emerald-400" : "bg-red-50/50 border-red-200 hover:border-red-400"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.count}건</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">순마진</span>
                    <span className={`font-medium tabular-nums ${m.netFee >= 0 ? "text-indigo-600" : "text-red-500"}`}>
                      {wonFull(m.netFee)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">인센티브</span>
                    <span className="text-amber-600 tabular-nums">-{wonFull(m.incentive)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                    <span>회사 실이익</span>
                    <span className={`tabular-nums ${m.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {wonFull(m.profit)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 개인 상세 모달 */}
        {selectedManager && (() => {
          const mgRows = saleRows.filter(r => r.manager === selectedManager);
          const mgSummary = {
            count: mgRows.length,
            netFee: mgRows.reduce((s, r) => s + r.netFee, 0),
            incentive: mgRows.reduce((s, r) => s + r.incentive, 0),
            profit: mgRows.reduce((s, r) => s + r.companyProfit, 0),
          };
          const monthMap: Record<string, { month: string; netFee: number; profit: number; count: number }> = {};
          for (const r of mgRows) {
            const m = r.open_date?.slice(0, 7) ?? "";
            if (!m) continue;
            if (!monthMap[m]) monthMap[m] = { month: m, netFee: 0, profit: 0, count: 0 };
            monthMap[m].netFee += r.netFee;
            monthMap[m].profit += r.companyProfit;
            monthMap[m].count++;
          }
          // 전체 기간 월별도 포함
          for (const s of sales.filter(s => s.manager === selectedManager)) {
            const m = (s.open_month ?? s.open_date ?? "").slice(0, 7);
            if (!m || monthMap[m]) continue;
            monthMap[m] = { month: m, netFee: 0, profit: 0, count: 0 };
          }
          const monthData = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
          const MG_PAGE = 20;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setSelectedManager(null); setMgPage(0); }}>
              <div className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-background border-b px-6 py-4 flex items-center justify-between rounded-t-2xl">
                  <div>
                    <div className="font-bold text-lg">{selectedManager}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{period === "this_month" ? "이번달" : period === "last_month" ? "저번달" : period === "3months" ? "최근 3개월" : "전체"} 기준</div>
                  </div>
                  <button onClick={() => { setSelectedManager(null); setMgPage(0); }} className="text-muted-foreground hover:text-foreground text-xl font-bold px-2">✕</button>
                </div>

                <div className="p-6 space-y-6">
                  {/* 요약 */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "판매건수", value: `${mgSummary.count}건`, color: "text-foreground" },
                      { label: "순마진", value: wonFull(mgSummary.netFee), color: mgSummary.netFee >= 0 ? "text-indigo-600" : "text-red-500" },
                      { label: "인센티브", value: `-${wonFull(mgSummary.incentive)}`, color: "text-amber-600" },
                      { label: "회사 실이익", value: wonFull(mgSummary.profit), color: mgSummary.profit >= 0 ? "text-emerald-600" : "text-red-500" },
                    ].map(c => (
                      <div key={c.label} className="rounded-xl border bg-muted/20 p-3 text-center">
                        <div className="text-xs text-muted-foreground mb-1">{c.label}</div>
                        <div className={`font-bold text-sm tabular-nums ${c.color}`}>{c.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* 월별 추이 차트 */}
                  {monthData.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">월별 추이</div>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={monthData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
                          <Tooltip formatter={(v: number) => wonFull(v)} labelFormatter={v => `${v}월`} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                          <Line type="monotone" dataKey="netFee" name="순마진" stroke="#6366f1" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="profit" name="회사실이익" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* 건별 목록 */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">건별 상세 ({mgRows.length}건)</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b">
                          <th className="text-left py-1.5 px-2">개통일</th>
                          <th className="text-left py-1.5 px-2">단말/상품</th>
                          <th className="text-right py-1.5 px-2">순마진</th>
                          <th className="text-right py-1.5 px-2">실이익</th>
                          <th className="text-center py-1.5 px-2">이동</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mgRows.slice(mgPage * MG_PAGE, (mgPage + 1) * MG_PAGE).map(r => (
                          <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-1.5 px-2 tabular-nums">{r.open_date?.slice(0, 10) ?? "-"}</td>
                            <td className="py-1.5 px-2">{r.device_model ?? r.product ?? "-"}</td>
                            <td className={`text-right py-1.5 px-2 tabular-nums ${r.netFee >= 0 ? "text-indigo-600" : "text-red-500"}`}>{wonFull(r.netFee)}</td>
                            <td className={`text-right py-1.5 px-2 tabular-nums font-bold ${r.companyProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{wonFull(r.companyProfit)}</td>
                            <td className="text-center py-1.5 px-2">
                              <button onClick={() => navigate(`/input?edit=${r.id}`)} className="text-primary hover:underline">→</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {mgRows.length > MG_PAGE && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">{mgPage * MG_PAGE + 1}–{Math.min((mgPage + 1) * MG_PAGE, mgRows.length)} / {mgRows.length}건</span>
                        <div className="flex gap-2">
                          <button onClick={() => setMgPage(p => Math.max(0, p - 1))} disabled={mgPage === 0} className="px-2 py-1 text-xs rounded border disabled:opacity-30">← 이전</button>
                          <button onClick={() => setMgPage(p => Math.min(Math.ceil(mgRows.length / MG_PAGE) - 1, p + 1))} disabled={(mgPage + 1) * MG_PAGE >= mgRows.length} className="px-2 py-1 text-xs rounded border disabled:opacity-30">다음 →</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

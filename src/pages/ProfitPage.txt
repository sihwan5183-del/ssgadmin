import { useState, useEffect, useMemo } from "react";
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

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      const netFee = s.net_fee ?? calcNetFee(s as any);

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
                {saleRows.slice(0, 50).map((r) => (
                  <>
                    <tr
                      key={r.id}
                      className="border-b border-border/40 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      <td className="py-2 px-2 tabular-nums text-xs">{r.open_date?.slice(0, 10) ?? "-"}</td>
                      <td className="py-2 px-2">{r.manager ?? "-"}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{r.device_model ?? r.product ?? "-"}</td>
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
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
            {saleRows.length > 50 && (
              <div className="text-center text-xs text-muted-foreground mt-3">
                상위 50건만 표시 (전체 {saleRows.length}건)
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}

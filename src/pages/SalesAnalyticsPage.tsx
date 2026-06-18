import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { sumRevenue, sumOffer } from "@/hooks/useNetFeeFormula";
import { Lock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Sale = {
  id: string;
  open_date: string | null;
  open_month: string | null;
  channel: string | null;
  manager: string | null;
  device_model: string | null;
  sale_type: string | null;
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
  voucher_returned: string | null;
  custom_fields: Record<string, any>;
};

type Period = "this_month" | "last_month" | "3months" | "6months" | "12months" | "all";
type Granularity = "day" | "week" | "month";
type Breakdown = "none" | "channel" | "manager" | "sale_type" | "device_model";
type Metric = "revenue" | "offer" | "profit";

const won = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만` : `${Math.round(n).toLocaleString()}원`;
const wonFull = (n: number) => `${Math.round(n).toLocaleString()}원`;

// 판매실적장표(SalesLedgerPage)와 동일한 5대 수익 / 5대 오퍼 계산 로직을 그대로 재사용
// (src/hooks/useNetFeeFormula.ts) — 총수익 - 지출(총오퍼) = 순이익
const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];
const OTHER_COLOR = "#94a3b8";

const normalizeSaleType = (st: string | null) => {
  const s = (st ?? "").trim();
  if (!s) return "미분류";
  return s.replace("USIM ", "").replace("기기변경", "기변").replace("번호이동", "MNP");
};

// 해당 날짜가 속한 주의 월요일(YYYY-MM-DD) 반환
const mondayOf = (dateStr: string) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

const weekLabel = (mondayStr: string) => {
  const mon = new Date(mondayStr + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()}~${sun.getMonth() + 1}/${sun.getDate()}`;
};

const METRIC_META: Record<Metric, { label: string; color: string }> = {
  revenue: { label: "총수익", color: "#6366f1" },
  offer: { label: "지출(총오퍼)", color: "#f43f5e" },
  profit: { label: "순이익", color: "#10b981" },
};

const BREAKDOWN_META: Record<Breakdown, string> = {
  none: "전체",
  channel: "경로별",
  manager: "담당자별",
  sale_type: "판매유형별",
  device_model: "단말기별",
};

const PERIOD_LABEL: Record<Period, string> = {
  this_month: "이번달",
  last_month: "저번달",
  "3months": "최근 3개월",
  "6months": "최근 6개월",
  "12months": "최근 12개월",
  all: "전체",
};

export default function SalesAnalyticsPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("3months");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [breakdown, setBreakdown] = useState<Breakdown>("none");
  const [metric, setMetric] = useState<Metric>("revenue");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select(
          "id, open_date, open_month, channel, manager, device_model, sale_type, unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, customer_support_amount, corp_card_amount, receivable_amount, trade_in_confirmed, trade_in_enabled, voucher_returned, custom_fields"
        )
        .is("deleted_at", null)
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

  // 기간 필터 + 건별 지표(총수익/지출/순이익) 계산
  const saleRows = useMemo(() => {
    return sales
      .filter((s) => {
        const m = (s.open_month ?? s.open_date ?? "").slice(0, 7);
        if (!m) return false;
        if (period === "this_month") return m === getMonthStr(0);
        if (period === "last_month") return m === getMonthStr(-1);
        if (period === "3months") return m >= getMonthStr(-2) && m <= getMonthStr(0);
        if (period === "6months") return m >= getMonthStr(-5) && m <= getMonthStr(0);
        if (period === "12months") return m >= getMonthStr(-11) && m <= getMonthStr(0);
        return true;
      })
      .map((s) => {
        const revenue = sumRevenue(s as any);
        const offer = sumOffer(s as any);
        const profit = Math.round(revenue - offer);
        const dateKey = s.open_date?.slice(0, 10) ?? "";
        return {
          ...s,
          revenue,
          offer,
          profit,
          channelVal: (s.channel ?? "").trim() || "미분류",
          managerVal: (s.manager ?? "").trim() || "미배정",
          saleTypeVal: normalizeSaleType(s.sale_type),
          deviceVal: (s.device_model ?? "").trim() || "미분류",
          dateKey,
          weekKey: dateKey ? mondayOf(dateKey) : "",
          monthKey: (s.open_month ?? s.open_date ?? "").slice(0, 7),
        };
      });
  }, [sales, period]);

  // 핵심 지표 (선택 기간 전체 합계)
  const summary = useMemo(() => {
    const totalRevenue = saleRows.reduce((s, r) => s + r.revenue, 0);
    const totalOffer = saleRows.reduce((s, r) => s + r.offer, 0);
    const totalProfit = saleRows.reduce((s, r) => s + r.profit, 0);
    return { totalRevenue, totalOffer, totalProfit, count: saleRows.length };
  }, [saleRows]);

  type Row = (typeof saleRows)[number];
  const metricValueOf = (r: Row) => (metric === "revenue" ? r.revenue : metric === "offer" ? r.offer : r.profit);
  const breakdownKeyOf = (r: Row) => {
    if (breakdown === "channel") return r.channelVal;
    if (breakdown === "manager") return r.managerVal;
    if (breakdown === "sale_type") return r.saleTypeVal;
    if (breakdown === "device_model") return r.deviceVal;
    return "전체";
  };

  // 구분 상위 카테고리 (선택 지표 기준 상위 6개, 나머지는 "기타")
  const topCategories = useMemo(() => {
    if (breakdown === "none") return [];
    const totals: Record<string, number> = {};
    for (const r of saleRows) {
      const k = breakdownKeyOf(r);
      totals[k] = (totals[k] ?? 0) + metricValueOf(r);
    }
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleRows, breakdown, metric]);

  const colorOf = (name: string) => {
    if (name === "기타") return OTHER_COLOR;
    const idx = topCategories.indexOf(name);
    return idx >= 0 ? COLORS[idx % COLORS.length] : OTHER_COLOR;
  };

  const groupKeyOf = (r: Row) => (granularity === "day" ? r.dateKey : granularity === "week" ? r.weekKey : r.monthKey);
  const labelOf = (key: string) => {
    if (!key) return "";
    if (granularity === "day") {
      const d = new Date(key + "T00:00:00");
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }
    if (granularity === "week") return weekLabel(key);
    return key.slice(2).replace("-", "."); // "2026-06" -> "26.06"
  };

  // 추이 차트용 집계 (기간 단위 x 구분)
  const chartData = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of saleRows) {
      const gk = groupKeyOf(r);
      if (!gk) continue;
      if (!map[gk]) {
        map[gk] = { key: gk, label: labelOf(gk), total: 0, count: 0 };
        if (breakdown !== "none") {
          for (const c of topCategories) map[gk][c] = 0;
          map[gk]["기타"] = 0;
        }
      }
      const v = metricValueOf(r);
      map[gk].total += v;
      map[gk].count += 1;
      if (breakdown !== "none") {
        const cat = breakdownKeyOf(r);
        const bucket = topCategories.includes(cat) ? cat : "기타";
        map[gk][bucket] += v;
      }
    }
    return Object.values(map).sort((a: any, b: any) => a.key.localeCompare(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleRows, granularity, breakdown, topCategories, metric]);

  // 구분별 합계 (상세 리스트)
  const breakdownTable = useMemo(() => {
    if (breakdown === "none") return [];
    const totals: Record<string, { value: number; count: number }> = {};
    for (const r of saleRows) {
      const cat = breakdownKeyOf(r);
      const bucket = topCategories.includes(cat) ? cat : "기타";
      if (!totals[bucket]) totals[bucket] = { value: 0, count: 0 };
      totals[bucket].value += metricValueOf(r);
      totals[bucket].count += 1;
    }
    const grand = Object.values(totals).reduce((s, v) => s + v.value, 0) || 1;
    return Object.entries(totals)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, v]) => ({ name, ...v, pct: (v.value / grand) * 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleRows, breakdown, metric, topCategories]);

  if (roleLoading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  if (!isAdmin) {
    return (
      <div>
        <Header title="판매 분석" subtitle="관리자 전용 페이지입니다" />
        <Card className="p-10 text-center max-w-lg mx-auto mt-10">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">관리자 전용</h3>
          <p className="text-sm text-muted-foreground">판매 분석은 관리자만 볼 수 있습니다.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Header title="판매 분석" subtitle="일/주/월별 판매 추이 · 경로·담당자·판매유형·단말기별 분석" />
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-10">불러오는 중...</div>
        ) : (
          <>
            {/* 기간 필터 */}
            <div className="flex items-center gap-2 flex-wrap">
              {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setPeriod(k)}
                  className={
                    "px-3 py-1.5 text-xs font-semibold rounded border transition-colors " +
                    (period === k
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:text-foreground")
                  }
                >
                  {PERIOD_LABEL[k]}
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">{summary.count}건</span>
            </div>

            {/* 핵심 지표 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "총수익", value: summary.totalRevenue, color: "text-indigo-600" },
                { label: "지출(총오퍼)", value: summary.totalOffer, color: "text-rose-600" },
                {
                  label: "순이익",
                  value: summary.totalProfit,
                  color: summary.totalProfit >= 0 ? "text-emerald-600" : "text-red-600",
                },
                { label: "판매 건수", value: summary.count, color: "text-foreground", isCount: true },
              ].map(({ label, value, color, isCount }: any) => (
                <Card key={label} className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div className={`text-xl font-bold ${color}`}>
                    {isCount ? `${value.toLocaleString()}건` : wonFull(value)}
                  </div>
                </Card>
              ))}
            </div>

            {/* 추이 차트 */}
            <Card className="p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(
                    [
                      { k: "day", l: "일별" },
                      { k: "week", l: "주별" },
                      { k: "month", l: "월별" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.k}
                      onClick={() => setGranularity(opt.k)}
                      className={
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors " +
                        (granularity === opt.k ? "bg-background shadow text-foreground" : "text-muted-foreground")
                      }
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={
                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors " +
                        (metric === m ? "bg-background shadow text-foreground" : "text-muted-foreground")
                      }
                    >
                      {METRIC_META[m].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground mr-1">구분:</span>
                {(Object.keys(BREAKDOWN_META) as Breakdown[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBreakdown(b)}
                    className={
                      "px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors " +
                      (breakdown === b
                        ? "bg-primary/10 border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground")
                    }
                  >
                    {BREAKDOWN_META[b]}
                  </button>
                ))}
              </div>

              {chartData.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-10">해당 기간 데이터 없음</div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(chartData.length / 14))}
                    />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => won(v)} width={50} />
                    <Tooltip formatter={(v: number, name: string) => [wonFull(v), name]} contentStyle={{ fontSize: 11 }} />
                    {breakdown !== "none" && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {breakdown === "none" ? (
                      <Bar dataKey="total" name={METRIC_META[metric].label} fill={METRIC_META[metric].color} radius={[3, 3, 0, 0]} />
                    ) : (
                      <>
                        {topCategories.map((cat) => (
                          <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={colorOf(cat)} />
                        ))}
                        <Bar dataKey="기타" name="기타" stackId="a" fill={OTHER_COLOR} radius={[3, 3, 0, 0]} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* 구분별 합계 리스트 */}
            {breakdown !== "none" && breakdownTable.length > 0 && (
              <Card className="p-4">
                <div className="text-sm font-semibold mb-3">
                  {BREAKDOWN_META[breakdown]} {METRIC_META[metric].label} 합계
                  <span className="text-xs text-muted-foreground font-normal ml-2">({PERIOD_LABEL[period]})</span>
                </div>
                <div className="space-y-2">
                  {breakdownTable.map((row) => (
                    <div key={row.name} className="flex items-center gap-3">
                      <span
                        className="inline-block size-2.5 rounded-full shrink-0"
                        style={{ background: colorOf(row.name) }}
                      />
                      <span className="text-sm font-medium w-28 truncate" title={row.name}>
                        {row.name}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.pct))}%`, background: colorOf(row.name) }}
                        />
                      </div>
                      <span className="text-sm tabular-nums font-semibold w-24 text-right">{wonFull(row.value)}</span>
                      <span className="text-xs text-muted-foreground w-14 text-right">{row.count}건</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">{row.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

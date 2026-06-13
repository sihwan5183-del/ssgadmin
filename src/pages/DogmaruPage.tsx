import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { TrendingUp, Users, CheckCircle2, Package, MapPin, Calendar, AlertCircle } from "lucide-react";

type Lead = {
  id: string;
  registration_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  branch_name: string | null;
  activation_status: string | null;
  cancellation_status: string | null;
  activation_number: string | null;
  pkg_number: string | null;
  memo: string | null;
  created_at: string;
};

type Period = "all" | "this_month" | "last_month" | "this_week" | "last_week" | "custom";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

const getDateStr = (d: Date) => d.toISOString().slice(0, 10);

const getWeekRange = (offset: number) => {
  const d = new Date();
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - day + offset * 7);
  const start = getDateStr(d);
  const end = getDateStr(new Date(d.getTime() + 6 * 86400000));
  return { start, end };
};

const getMonthStr = (offset: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 7);
};

export default function DogmaruPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("leads")
        .select("id, registration_date, customer_name, customer_phone, branch_name, activation_status, cancellation_status, activation_number, pkg_number, memo, created_at")
        .eq("campaign_name", "도그마루_홈캠")
        .order("created_at", { ascending: false });
      setLeads((data as Lead[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const inRange = (lead: Lead) => {
    const raw = lead.registration_date ?? lead.created_at;
    if (!raw) return true;
    const iso = raw.length === 10 ? raw : raw.slice(0, 10);
    if (period === "all") return true;
    if (period === "this_month") return iso.slice(0, 7) === getMonthStr(0);
    if (period === "last_month") return iso.slice(0, 7) === getMonthStr(-1);
    if (period === "this_week") { const w = getWeekRange(0); return iso >= w.start && iso <= w.end; }
    if (period === "last_week") { const w = getWeekRange(-1); return iso >= w.start && iso <= w.end; }
    if (period === "custom") return (!customStart || iso >= customStart) && (!customEnd || iso <= customEnd);
    return true;
  };

  const filtered = useMemo(() => leads.filter(inRange), [leads, period, customStart, customEnd]);

  const total = filtered.length;
  const activated = filtered.filter(l => l.activation_status && l.activation_status.includes("완료")).length;
  const pending = filtered.filter(l => !l.activation_status || l.activation_status === "").length;
  const cancelled = filtered.filter(l => l.cancellation_status && l.cancellation_status.trim() !== "").length;
  const activationRate = total > 0 ? Math.round((activated / total) * 100) : 0;

  // 월별 추이
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const raw = l.registration_date ?? l.created_at;
      if (!raw) return;
      const m = raw.slice(0, 7);
      map[m] = (map[m] ?? 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month: month.slice(2), count }));
  }, [leads]);

  // 주별 추이 (최근 8주)
  const weeklyData = useMemo(() => {
    const weeks: { label: string; start: string; end: string }[] = [];
    for (let i = 7; i >= 0; i--) {
      const w = getWeekRange(-i);
      const d = new Date(w.start);
      weeks.push({ label: `${d.getMonth() + 1}/${d.getDate()}주`, start: w.start, end: w.end });
    }
    return weeks.map(w => ({
      label: w.label,
      count: leads.filter(l => {
        const raw = l.registration_date ?? l.created_at;
        if (!raw) return false;
        const iso = raw.slice(0, 10);
        return iso >= w.start && iso <= w.end;
      }).length,
    }));
  }, [leads]);

  // 지점별
  const branchData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => {
      const b = l.branch_name ?? "미입력";
      map[b] = (map[b] ?? 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([branch, count]) => ({ branch, count }));
  }, [filtered]);

  // 개통방식 (택배개통 vs 기사개통)
  const pkgData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => {
      const p = l.pkg_number ?? "미입력";
      map[p] = (map[p] ?? 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // 이슈 현황 (비고)
  const issueData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(l => {
      if (!l.memo || l.memo.trim() === "") return;
      const m = l.memo.trim();
      map[m] = (map[m] ?? 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8).map(([issue, count]) => ({ issue, count }));
  }, [filtered]);

  const periodLabels: Record<Period, string> = {
    all: "전체",
    this_month: "이번달",
    last_month: "저번달",
    this_week: "이번주",
    last_week: "지난주",
    custom: "기간설정",
  };

  if (loading) return (
    <div className="min-h-screen bg-background">
      <Header title="도그마루 대시보드" />
      <div className="flex items-center justify-center h-64 text-muted-foreground">로딩 중...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header title="도그마루 대시보드" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* 기간 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            {(["all", "this_month", "last_month", "this_week", "last_week", "custom"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={
                  "px-3 py-1.5 text-xs font-semibold rounded transition-colors " +
                  (period === p ? "bg-background text-slate-900 shadow-sm" : "text-muted-foreground hover:text-foreground")
                }
              >
                {periodLabels[p]}
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

        {/* 핵심 지표 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: "전체 접수", value: total, color: "text-indigo-600", bg: "bg-indigo-50" },
            { icon: CheckCircle2, label: "개통 완료", value: activated, color: "text-emerald-600", bg: "bg-emerald-50" },
            { icon: TrendingUp, label: "개통률", value: activationRate + "%", color: "text-pink-600", bg: "bg-pink-50" },
            { icon: AlertCircle, label: "해지/철회", value: cancelled, color: "text-rose-600", bg: "bg-rose-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`${bg} p-2.5 rounded-lg`}>
                <Icon className={`size-5 ${color}`} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-2xl font-bold text-foreground">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 월별/주별 추이 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="size-4 text-indigo-500" />
              <span className="font-semibold text-sm">월별 접수 추이</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="접수" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4 text-pink-500" />
              <span className="font-semibold text-sm">주별 접수 추이 (최근 8주)</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} name="접수" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 지점별 / 개통방식 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="size-4 text-amber-500" />
              <span className="font-semibold text-sm">지점별 접수 현황</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={branchData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="branch" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} name="접수">
                  {branchData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Package className="size-4 text-teal-500" />
              <span className="font-semibold text-sm">개통방식 현황</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pkgData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pkgData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 이슈 현황 */}
        {issueData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="size-4 text-rose-500" />
              <span className="font-semibold text-sm">비고 이슈 현황</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {issueData.map(({ issue, count }) => (
                <div key={issue} className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
                  <span className="text-xs text-rose-700 font-medium">{issue}</span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-100 rounded-full px-1.5">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 개통 상태별 현황 */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="font-semibold text-sm">개통 상태별 현황</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const map: Record<string, number> = {};
              filtered.forEach(l => {
                const s = l.activation_status ?? "미입력";
                map[s] = (map[s] ?? 0) + 1;
              });
              return Object.entries(map).sort(([, a], [, b]) => b - a).map(([status, count], i) => (0
                  <div className="text-lg font-bold" style={{ color: COLORS[i % COLORS.length] }}>{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{status}</div>
                </div>
              ));
            })()}
          </div>
        </div>

      </div>
    </div>
  );
}

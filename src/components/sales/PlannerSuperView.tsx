import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Download, Search, Eye, Lock, Unlock, ShieldCheck, FileWarning,
  Inbox, ClipboardCheck, RotateCcw, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { sumRevenue, sumOffer } from "@/hooks/useNetFeeFormula";

type Tab = "submitted" | "revision" | "approved";

interface Row {
  id: string;
  customer_name: string | null;
  device_model: string | null;
  manager: string | null;
  channel: string | null;
  open_date: string | null;
  net_fee: number | null;
  distributor_amount: number | null;
  extra_subsidy: number | null;
  cash_support_amount: number | null;
  customer_support_amount: number | null;
  corp_card_amount: number | null;
  unit_price: number | null;
  vas_fee: number | null;
  receivable_amount: number | null;
  trade_in_enabled: boolean | null;
  trade_in_confirmed: number | null;
  custom_fields: Record<string, any> | null;
  approval_status: string | null;
  locked: boolean | null;
  pending_resolved: boolean | null;
  created_by: string;
  updated_at: string;
}

const TAB_FILTER: Record<Tab, string[]> = {
  submitted: ["승인대기"],
  revision: ["수정요청", "반려"],
  approved: ["확정"],
};

const TAB_META: Record<Tab, { label: string; Icon: any; color: string }> = {
  submitted: { label: "미검수", Icon: Inbox, color: "hsl(38 92% 55%)" },
  revision: { label: "수정요청", Icon: RotateCcw, color: "hsl(0 75% 55%)" },
  approved: { label: "검수완료", Icon: ClipboardCheck, color: "hsl(158 65% 45%)" },
};

const fmt = (n: number | null) => (n ?? 0).toLocaleString("ko-KR");
const rebateOf = (r: Row) => sumRevenue(r as any);
const offerOf = (r: Row) => sumOffer(r as any);
const profit = (r: Row) => rebateOf(r) - offerOf(r);

type SortKey = "updated" | "rebate" | "profit";

const csvEscape = (v: any) => {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

/**
 * 영업기획팀 슈퍼 뷰 — 본사 통합 판매원장 관제
 * - [미검수 / 수정요청 / 검수완료] 탭으로 워크큐 분리
 * - 매장(담당자) 필터, 통합 검색, CSV 추출
 * - 일괄 Lock(기획팀 즉시 확정), Lock 해제(대표 전용)
 * - 매장 이름 클릭 시 해당 매장 직원 뷰 임퍼소네이션
 */
export const PlannerSuperView = () => {
  const { isAdmin, roles } = useRole();
  const isCEO = roles.includes("ceo") || roles.includes("admin");
  const isPlanner = roles.includes("planner") || isCEO;
  const { startImpersonation } = useViewScope();

  const [tab, setTab] = useState<Tab>("submitted");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("updated");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, device_model, manager, channel, open_date, net_fee, distributor_amount, extra_subsidy, cash_support_amount, customer_support_amount, corp_card_amount, unit_price, vas_fee, receivable_amount, trade_in_enabled, trade_in_confirmed, custom_fields, approval_status, locked, pending_resolved, created_by, updated_at"
      )
      .in("approval_status", TAB_FILTER[tab])
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Row[]);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // sales 변경 실시간 반영
    const ch = supabase
      .channel("planner-superview-" + tab)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const stores = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.manager && set.add(r.manager));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (storeFilter !== "all" && r.manager !== storeFilter) return false;
      if (!q) return true;
      return [r.customer_name, r.device_model, r.manager, r.channel]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    if (sortKey === "rebate") {
      result.sort((a, b) => rebateOf(b) - rebateOf(a));
    } else if (sortKey === "profit") {
      result.sort((a, b) => profit(b) - profit(a));
    }
    return result;
  }, [rows, search, storeFilter, sortKey]);

  const counts = useMemo(() => ({
    submitted: rows.filter((r) => TAB_FILTER.submitted.includes(r.approval_status ?? "")).length,
    revision: rows.filter((r) => TAB_FILTER.revision.includes(r.approval_status ?? "")).length,
    approved: rows.filter((r) => TAB_FILTER.approved.includes(r.approval_status ?? "")).length,
  }), [rows]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const totalNet = filtered.reduce((s, r) => s + rebateOf(r), 0);
    const totalProfit = filtered.reduce((s, r) => s + profit(r), 0);
    const today = new Date().toISOString().slice(0, 10);
    const todayRows = filtered.filter((r) => r.open_date === today);
    const todayRebate = todayRows.reduce((s, r) => s + rebateOf(r), 0);
    const todayProfit = todayRows.reduce((s, r) => s + profit(r), 0);
    return { total, totalNet, totalProfit, todayRebate, todayProfit, todayCount: todayRows.length };
  }, [filtered]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 일괄 [확정 + Lock] 처리합니다. 진행하시겠습니까?`)) return;
    const { error } = await supabase
      .from("sales")
      .update({ approval_status: "확정" })
      .in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`${selected.size}건 확정 완료`);
    load();
  };

  const bulkUnlock = async () => {
    if (!isCEO) return toast.error("Lock 해제는 대표 권한입니다");
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건의 Lock을 해제합니다. 정산 기준이 변경될 수 있습니다. 진행하시겠습니까?`)) return;
    const { error } = await supabase
      .from("sales")
      .update({ approval_status: "승인대기" })
      .in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`${selected.size}건 Lock 해제`);
    load();
  };

  const exportCSV = () => {
    const header = ["고객명", "단말기", "매장(담당)", "채널", "개통일", "리베이트", "오퍼", "최종수익", "상태", "Lock"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      lines.push(
        [
          r.customer_name,
          r.device_model,
          r.manager,
          r.channel,
          r.open_date,
          r.net_fee,
          r.distributor_amount,
          profit(r),
          r.approval_status,
          r.locked ? "LOCKED" : "",
        ].map(csvEscape).join(",")
      );
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `판매원장_${TAB_META[tab].label}_${d}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length}건 CSV 다운로드`);
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      {/* 헤더 카드 */}
      <Card className="p-5 glass border-primary/30">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Building2 className="size-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              영업기획팀 슈퍼 뷰
              <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-[10px]">
                본사 통합 관제
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              30개 매장 전체 실적을 워크큐로 정리 · 일괄 확정/Lock · 매장별 임퍼소네이션
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground">총 {summary.total}건</span>
              {isPlanner && (
                <span className="font-bold text-foreground tabular-nums">
                  리베이트 {fmt(summary.totalNet)}원
                </span>
              )}
              {isPlanner && (
                <span className={"font-bold tabular-nums " + (summary.totalProfit < 0 ? "text-destructive" : "text-success")}>
                  순수익 {fmt(summary.totalProfit)}원
                </span>
              )}
            </div>
            {isPlanner && (
              <div className="flex flex-col items-end pl-3 border-l border-border/40">
                <span className="text-[10px] text-muted-foreground">오늘 {summary.todayCount}건</span>
                <span className="font-bold text-primary tabular-nums">
                  리베이트 {fmt(summary.todayRebate)}원
                </span>
                <span className={"font-bold tabular-nums " + (summary.todayProfit < 0 ? "text-destructive" : "text-success")}>
                  순수익 {fmt(summary.todayProfit)}원
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 탭 + 액션바 */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {(Object.keys(TAB_META) as Tab[]).map((k) => {
              const M = TAB_META[k];
              const Icon = M.Icon;
              return (
                <TabsTrigger key={k} value={k} className="gap-2">
                  <Icon className="size-4" style={{ color: M.color }} />
                  {M.label}
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
                    style={{ background: `${M.color}20`, color: M.color }}
                  >
                    {counts[k]}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객·모델·매장 검색…"
              className="h-9 pl-8 w-[220px]"
            />
          </div>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="매장 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">매장 전체</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">최신순</SelectItem>
              <SelectItem value="rebate">리베이트 높은순</SelectItem>
              <SelectItem value="profit">순수익 높은순</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1.5">
            <Download className="size-3.5" /> CSV 추출
          </Button>
          {selected.size > 0 && (
            <>
              {tab !== "approved" && (
                <Button size="sm" onClick={bulkApprove} className="gap-1.5 bg-success hover:bg-success/90">
                  <ShieldCheck className="size-3.5" /> {selected.size}건 일괄 확정
                </Button>
              )}
              {tab === "approved" && isCEO && (
                <Button size="sm" variant="destructive" onClick={bulkUnlock} className="gap-1.5">
                  <Unlock className="size-3.5" /> {selected.size}건 Lock 해제
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="px-3 py-2.5 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-3 py-2.5 text-left">고객</th>
                <th className="px-3 py-2.5 text-left">단말기</th>
                <th className="px-3 py-2.5 text-left">매장 / 채널</th>
                {isPlanner && <th className="px-3 py-2.5 text-right">리베이트</th>}
                {isPlanner && <th className="px-3 py-2.5 text-right">오퍼</th>}
                {isPlanner && <th className="px-3 py-2.5 text-right">최종 순수익</th>}
                <th className="px-3 py-2.5 text-left">상태</th>
                <th className="px-3 py-2.5 text-right">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isPlanner ? 9 : 6} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={isPlanner ? 9 : 6} className="text-center py-10 text-muted-foreground">
                  {tab === "submitted" ? "✨ 검수 대기 중인 실적이 없습니다" : tab === "revision" ? "수정요청 항목이 없습니다" : "확정된 실적이 없습니다"}
                </td></tr>
              ) : (
                filtered.map((r) => {
                  const p = profit(r);
                  const reb = rebateOf(r);
                  const off = offerOf(r);
                  return (
                    <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleOne(r.id)}
                          className="size-4 accent-primary"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {r.customer_name ?? "(이름없음)"}
                        <div className="text-[10px] text-muted-foreground">{r.open_date ?? "-"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{r.device_model ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.manager ? (
                          <button
                            onClick={() => startImpersonation(r.manager!)}
                            className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
                            title="이 매장 직원 뷰로 미리보기"
                          >
                            {r.manager}
                            <Eye className="size-3" />
                          </button>
                        ) : "-"}
                        <div className="text-[10px] text-muted-foreground">{r.channel ?? "-"}</div>
                      </td>
                      {isPlanner && (
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{fmt(reb)}
                        </td>
                      )}
                      {isPlanner && (
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          -{fmt(off)}
                        </td>
                      )}
                      {isPlanner && (
                        <td className={"px-3 py-2.5 text-right font-mono font-bold text-xs tabular-nums " + (p < 0 ? "text-destructive" : "text-primary")}>
                          {fmt(p)}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-xs">
                        <Badge
                          variant="outline"
                          className={
                            r.approval_status === "확정" ? "border-success/40 bg-success/10 text-success" :
                              r.approval_status === "수정요청" || r.approval_status === "반려" ? "border-destructive/40 bg-destructive/10 text-destructive" :
                                "border-warning/40 bg-warning/10 text-warning"
                          }
                        >
                          {r.locked && <Lock className="size-3 mr-1" />}
                          {r.approval_status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to={`/activities?sale=${r.id}`}
                          className="inline-flex items-center text-xs text-primary hover:underline gap-0.5"
                        >
                          상세 <ChevronRight className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

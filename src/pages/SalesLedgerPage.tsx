import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Pencil, X, Download, Search, ShieldAlert, Hash, Wallet as WalletIcon, Gift, TrendingUp, Banknote, AlertTriangle, Plus } from "lucide-react";
import { maskPhone, maskName } from "@/lib/maskPii";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS } from "@/lib/excelExport";
import { cn } from "@/lib/utils";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";

const PAGE_SIZE = 25;

/* ---------- animated counter ---------- */
function useAnimatedNumber(target: number, duration = 400) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = display;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return display;
}

type SaleRow = {
  id: string;
  created_by: string;
  seq: number | null;
  channel: string | null;
  manager: string | null;
  open_date: string | null;
  product: string | null;
  sale_type: string | null;
  status: string | null;
  customer_name: string | null;
  phone: string | null;
  device_model: string | null;
  unit_price: number | null;
  voucher: string | null;
  voucher_returned: string | null;
  receivable_amount: number | null;
  receivable_paid: string | null;
  distributor_amount: number | null;
  extra_subsidy: number | null;
  cash_support_amount: number | null;
  pending_items?: string[] | null;
  pending_resolved?: boolean | null;
  moyo_excluded: boolean | null;
};

const SalesLedgerPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { startDate, endDate, label: periodLabel } = usePeriod();
  const quickExport = useQuickExport();
  const { options: STATUSES } = useFieldOptions("status");
  const { options: CHANNELS } = useFieldOptions("channel");

  // Fetch distinct managers from sales
  const [managers, setManagers] = useState<string[]>([]);
  useEffect(() => {
    supabase.from("sales").select("manager").gte("open_date", startDate).lte("open_date", endDate).then(({ data }) => {
      const unique = [...new Set((data ?? []).map((r: any) => r.manager).filter(Boolean))].sort() as string[];
      setManagers(unique);
    });
  }, [startDate, endDate]);

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [managerFilter, setManagerFilter] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<"unpaid" | "unreturned" | null>(null);
  const [dbSummary, setDbSummary] = useState({ count: 0, totalRebate: 0, totalOffer: 0, totalProfit: 0 });
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unreturnedCount, setUnreturnedCount] = useState(0);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const sp = searchParams.get("status");
    if (sp) setStatusFilter(sp);
  }, []);

  const offerOf = (r: SaleRow) =>
    (r.distributor_amount ?? 0) + (r.extra_subsidy ?? 0) + (r.cash_support_amount ?? 0);
  const profitOf = (r: SaleRow) => (r.unit_price ?? 0) - offerOf(r);

  const filteredRows = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    let result = rows;
    if (quickFilter === "unpaid") {
      result = result.filter((r) => (r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료");
    } else if (quickFilter === "unreturned") {
      result = result.filter((r) => r.voucher && r.voucher.trim() !== "" && r.voucher_returned !== "유");
    }
    if (!q) return result;
    return result.filter((r) => {
      const name = (r.customer_name ?? "").toLowerCase();
      const phone = (r.phone ?? "").replace(/[^0-9]/g, "");
      return name.includes(q) || phone.includes(q.replace(/[^0-9]/g, ""));
    });
  }, [rows, searchQ, quickFilter]);

  const load = useCallback(async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("sales")
      .select("*", { count: "exact" })
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (statusFilter) query = query.eq("status", statusFilter);
    if (managerFilter) query = query.eq("manager", managerFilter);
    if (channelFilter) query = query.eq("channel", channelFilter);
    const { data, error, count } = await query
      .order("open_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) { toast.error("목록 불러오기 실패"); return; }
    setRows((data ?? []) as SaleRow[]);
    setTotal(count ?? 0);
  }, [page, startDate, endDate, statusFilter, managerFilter, channelFilter]);

  const loadSummary = useCallback(async () => {
    let query = supabase
      .from("sales")
      .select("unit_price, distributor_amount, extra_subsidy, cash_support_amount")
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (statusFilter) query = query.eq("status", statusFilter);
    if (managerFilter) query = query.eq("manager", managerFilter);
    if (channelFilter) query = query.eq("channel", channelFilter);
    const { data } = await query;
    const r = data ?? [];
    const totalRebate = r.reduce((s, x) => s + (x.unit_price ?? 0), 0);
    const totalOffer = r.reduce((s, x) => s + (x.distributor_amount ?? 0) + (x.extra_subsidy ?? 0) + (x.cash_support_amount ?? 0), 0);
    setDbSummary({ count: r.length, totalRebate, totalOffer, totalProfit: totalRebate - totalOffer });

    const { count: uc } = await supabase.from("sales").select("id", { count: "exact", head: true })
      .gte("open_date", startDate).lte("open_date", endDate).gt("receivable_amount", 0).neq("receivable_paid", "완료");
    setUnpaidCount(uc ?? 0);
    const { count: urc } = await supabase.from("sales").select("id", { count: "exact", head: true })
      .gte("open_date", startDate).lte("open_date", endDate).neq("voucher", "").not("voucher", "is", null).neq("voucher_returned", "유");
    setUnreturnedCount(urc ?? 0);
  }, [startDate, endDate, statusFilter, managerFilter, channelFilter]);

  useEffect(() => { load(); loadSummary(); }, [load, loadSummary]);
  useEffect(() => { setPage(0); }, [startDate, endDate, statusFilter, managerFilter, channelFilter]);

  const animCount = useAnimatedNumber(dbSummary.count);
  const animRebate = useAnimatedNumber(dbSummary.totalRebate);
  const animOffer = useAnimatedNumber(dbSummary.totalOffer);
  const animProfit = useAnimatedNumber(dbSummary.totalProfit);

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected((prev) => {
    if (allSelected) { const n = new Set(prev); filteredRows.forEach((r) => n.delete(r.id)); return n; }
    const n = new Set(prev); filteredRows.forEach((r) => n.add(r.id)); return n;
  });
  const toggleOne = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleExport = async () => {
    let query = supabase.from("sales").select("*").gte("open_date", startDate).lte("open_date", endDate);
    if (statusFilter) query = query.eq("status", statusFilter);
    if (managerFilter) query = query.eq("manager", managerFilter);
    if (channelFilter) query = query.eq("channel", channelFilter);
    const { data, error } = await query.order("open_date", { ascending: false });
    if (error) return toast.error("엑셀 내보내기 실패");
    exportToExcel(data ?? [], SALES_COLUMNS, `실적장표_${periodLabel.replace(/\s/g, "")}`, "실적");
  };

  const handleExportOffers = async () => {
    const { data, error } = await supabase.from("sales")
      .select("seq, open_date, channel, manager, customer_name, phone, product, sale_type, device_model, rate_plan, unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, receivable_paid, cash_open, cash_bank, cash_account, cash_holder, voucher, voucher_returned, net_fee, approval_status, note")
      .gte("open_date", startDate).lte("open_date", endDate).order("open_date", { ascending: false });
    if (error) return toast.error("오퍼 내보내기 실패");
    const filtered = (data ?? []).filter((r: any) =>
      Number(r.distributor_amount ?? 0) > 0 || Number(r.extra_subsidy ?? 0) > 0 || Number(r.cash_support_amount ?? 0) > 0 ||
      Number(r.receivable_amount ?? 0) > 0 || r.cash_open === true || (r.voucher && String(r.voucher).trim() !== "")
    );
    const mapped = filtered.map((r: any) => ({ ...r, cash_open: r.cash_open ? "Y" : "" }));
    exportToExcel(mapped, OFFER_COLUMNS, `오퍼_지원금관리_${periodLabel.replace(/\s/g, "")}`, "오퍼관리");
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from("sales").delete().in("id", Array.from(selected));
    if (error) return toast.error("선택 삭제 실패");
    toast.success(`${selected.size}건 삭제 완료`);
    setSelected(new Set());
    load(); loadSummary();
  };

  const deleteAllInPeriod = async () => {
    const { error, count } = await supabase.from("sales").delete({ count: "exact" }).gte("open_date", startDate).lte("open_date", endDate);
    if (error) return toast.error("전체 삭제 실패");
    toast.success(`${count ?? 0}건 삭제 완료`);
    setSelected(new Set());
    load(); loadSummary();
  };

  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠어요?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error("삭제 실패");
    toast.success("삭제 완료");
    load(); loadSummary();
  };

  return (
    <>
      <Header title="판매원장 관리" subtitle={`${periodLabel} · 개통일 기준 판매 데이터 조회·관리`} showPeriodFilter />

      {/* ── 필터 바 ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={statusFilter ?? "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? null : v)}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="상태 전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">상태 전체</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={managerFilter ?? "__all__"} onValueChange={(v) => setManagerFilter(v === "__all__" ? null : v)}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="직원 전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">직원 전체</SelectItem>
            {managers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter ?? "__all__"} onValueChange={(v) => setChannelFilter(v === "__all__" ? null : v)}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="채널 전체" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">채널 전체</SelectItem>
            {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Badge variant="outline" className={cn("gap-1 cursor-pointer transition-colors", quickFilter === "unpaid" ? "border-destructive/60 text-destructive bg-destructive/15" : "border-border/40 text-muted-foreground hover:bg-muted/40")} onClick={() => setQuickFilter(quickFilter === "unpaid" ? null : "unpaid")}>
          💰 미수금 {unpaidCount > 0 && `(${unpaidCount})`}
        </Badge>
        <Badge variant="outline" className={cn("gap-1 cursor-pointer transition-colors", quickFilter === "unreturned" ? "border-destructive/60 text-destructive bg-destructive/15" : "border-border/40 text-muted-foreground hover:bg-muted/40")} onClick={() => setQuickFilter(quickFilter === "unreturned" ? null : "unreturned")}>
          🎫 미반납 {unreturnedCount > 0 && `(${unreturnedCount})`}
        </Badge>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="고객명 또는 연락처 검색…" className="h-9 pl-9 bg-input/60 text-xs" />
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5"><Download className="size-3.5" /> 엑셀</Button>
          <Button variant="outline" size="sm" onClick={handleExportOffers} className="gap-1.5 border-amber-400 text-amber-700"><Download className="size-3.5" /> 오퍼</Button>
          <Link to="/downloads"><Button variant="outline" size="sm" className="gap-1.5"><Download className="size-3.5" /> 다운로드 센터</Button></Link>
          <Button size="sm" onClick={() => navigate("/input")} className="gap-1.5"><Plus className="size-3.5" /> 실적 입력</Button>
        </div>
      </div>

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <SummaryCard icon={Hash} label="총 판매 건수" value={`${animCount.toLocaleString()}건`} accent="primary" />
        <SummaryCard icon={WalletIcon} label="총 리베이트" value={`${animRebate.toLocaleString("ko-KR")}원`} accent="secondary" />
        <SummaryCard icon={Gift} label="총 오퍼(지원금)" value={`${animOffer.toLocaleString("ko-KR")}원`} accent="warning" />
        <SummaryCard icon={TrendingUp} label="총 최종 수익" value={`${animProfit.toLocaleString("ko-KR")}원`} accent={animProfit >= 0 ? "success" : "destructive"} />
        <SummaryCard icon={Banknote} label="미수금 건" value={`${unpaidCount}건`} accent={unpaidCount > 0 ? "destructive" : "primary"} />
        <SummaryCard icon={Gift} label="상품권 미반납" value={`${unreturnedCount}건`} accent={unreturnedCount > 0 ? "destructive" : "primary"} />
      </div>

      {/* ── 관리자 삭제 ── */}
      {isAdmin && (
        <div className="flex gap-2 mb-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={selected.size === 0} className="rounded-xl gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="size-4" /> 선택 삭제 ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-destructive" /> 선택한 {selected.size}건을 삭제합니다</AlertDialogTitle>
                <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSelected} className="bg-destructive text-destructive-foreground">삭제 진행</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl gap-2 border-destructive/60 text-destructive hover:bg-destructive/15">
                <ShieldAlert className="size-4" /> 전체 데이터 삭제
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2"><ShieldAlert className="size-5 text-destructive" /> 정말로 모든 데이터를 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>현재 기간({periodLabel})의 <strong className="text-destructive">{total.toLocaleString()}건</strong> 모든 판매 데이터가 영구 삭제됩니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllInPeriod} className="bg-destructive text-destructive-foreground">모두 삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ── 테이블 ── */}
      <section className="glass-strong rounded-2xl p-5 shadow-card-elevated">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b border-border/40">
                {isAdmin && <th className="px-3 py-2 w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></th>}
                <th className="text-left px-3 py-2 font-medium">개통일</th>
                <th className="text-left px-3 py-2 font-medium">경로</th>
                <th className="text-left px-3 py-2 font-medium">담당</th>
                <th className="text-left px-3 py-2 font-medium">상품</th>
                <th className="text-left px-3 py-2 font-medium">고객</th>
                <th className="text-left px-3 py-2 font-medium">연락처</th>
                <th className="text-left px-3 py-2 font-medium">단말</th>
                <th className="text-right px-3 py-2 font-medium">리베이트 단가</th>
                <th className="text-right px-3 py-2 font-medium">오퍼(지원금)</th>
                <th className="text-right px-3 py-2 font-medium">최종 수익</th>
                <th className="text-right px-3 py-2 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const mine = r.created_by === user?.id;
                const hasPending = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
                const offer = offerOf(r);
                const profit = profitOf(r);
                return (
                  <tr key={r.id} className={cn("border-b border-border/20 hover:bg-muted/30", mine && "bg-primary/[0.04]", hasPending && "bg-amber-50/70")}>
                    {isAdmin && <td className="px-3 py-2.5"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} /></td>}
                    <td className="px-3 py-2.5">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.channel ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.manager ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.product ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{isAdmin ? (r.customer_name ?? "-") : maskName(r.customer_name) || "-"}</span>
                        {hasPending && <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 px-1.5 py-0"><AlertTriangle className="size-2.5" /> 미처리</Badge>}
                        {(r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료" && <Badge variant="outline" className="text-[9px] gap-0.5 border-destructive/40 text-destructive bg-destructive/10 px-1.5 py-0">💰 미수급</Badge>}
                        {r.voucher && r.voucher.trim() !== "" && r.voucher_returned !== "유" && <Badge variant="outline" className="text-[9px] gap-0.5 border-destructive/40 text-destructive bg-destructive/10 px-1.5 py-0">🎫 미반납</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{isAdmin ? (r.phone ?? "-") : maskPhone(r.phone) || "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.device_model ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{(r.unit_price ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-warning">{offer.toLocaleString("ko-KR")}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums font-semibold", profit < 0 ? "text-destructive" : "text-revenue")}>{profit.toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right">
                      {mine ? (
                        <div className="inline-flex gap-1">
                          <button onClick={() => navigate(`/input?edit=${r.id}`)} className="size-7 rounded-lg grid place-items-center text-primary hover:bg-primary/10"><Pencil className="size-3.5" /></button>
                          <button onClick={() => onDelete(r.id)} className="size-7 rounded-lg grid place-items-center text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></button>
                        </div>
                      ) : <span className="text-[10px] text-muted-foreground">읽기전용</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 12 : 11} className="text-center py-10 text-muted-foreground">
                  {searchQ ? "검색 결과가 없습니다." : "선택한 기간에 데이터가 없습니다."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </section>
    </>
  );
};

export default SalesLedgerPage;

const SummaryCard = ({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "primary" | "secondary" | "success" | "warning" | "destructive";
}) => {
  const tone: Record<string, string> = {
    primary: "from-primary/20 to-primary-glow/5 text-primary-glow border-primary/20",
    secondary: "from-secondary/20 to-primary/5 text-secondary border-secondary/20",
    success: "from-success/20 to-success/5 text-success border-success/20",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/20",
    destructive: "from-destructive/25 to-destructive/5 text-destructive border-destructive/30",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4", tone[accent])}>
      <div className="flex items-center gap-2 text-[11px] font-medium opacity-90 text-primary"><Icon className="size-3.5" /> {label}</div>
      <div className="mt-1.5 text-lg md:text-xl font-bold tabular-nums tracking-tight text-foreground">{value}</div>
    </div>
  );
};
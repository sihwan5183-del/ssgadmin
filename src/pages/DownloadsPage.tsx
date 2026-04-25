// 데이터 다운로드 센터 — 카테고리별 탭 + 컬럼 피커 + 상태 필터 + 특수 양식
import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, Loader2, RefreshCw, Trash2, Clock, CheckCircle2, XCircle, CreditCard, Calculator, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  exportToExcel,
  SALES_COLUMNS,
  AD_SPEND_COLUMNS,
  DEVICE_INVENTORY_COLUMNS,
} from "@/lib/excelExport";

type TabKey = "sales" | "expenses" | "customers" | "inventory";

/* ── 카테고리별 컬럼 정의 ── */
const INQUIRY_COLUMNS: Array<ColumnDef> = [
  ["inquiry_date", "문의일"],
  ["channel", "인입경로"],
  ["customer_name", "고객명"],
  ["phone", "연락처"],
  ["content", "문의내용"],
  ["manager", "담당자"],
  ["status", "상태"],
  ["fail_reason", "실패사유"],
  ["note", "메모"],
];

const REGULARS_COLUMNS: Array<ColumnDef> = [
  ["registered_date", "등록일"],
  ["customer_name", "고객명"],
  ["phone", "연락처"],
  ["channel", "인입경로"],
  ["manager", "담당자"],
  ["birth_date", "생년월일"],
  ["converted", "전환여부"],
  ["coupon_sent", "쿠폰발송"],
  ["note", "메모"],
];

const STAFF_COLUMNS: Array<ColumnDef> = [
  ["display_name", "이름"],
  ["team", "팀"],
  ["store", "매장"],
  ["position", "직급"],
  ["phone", "연락처"],
  ["status", "상태"],
];

/* 법인카드 전용 */
const CORP_CARD_COLUMNS: Array<ColumnDef> = [
  ["seq", "순번"],
  ["open_date", "개통일"],
  ["customer_name", "고객명"],
  ["product", "가입상품"],
  ["device_model", "단말기"],
  ["cf_card_company", "카드사"],
  ["cf_card_last4", "카드번호(뒤4자리)"],
  ["cf_card_amount", "카드결제금액(₩)"],
  ["extra_subsidy", "추가지원금(₩)"],
  ["cash_support_amount", "현금지원금(₩)"],
  ["manager", "담당자"],
  ["note", "비고"],
];

/* 정산용 양식 */
const SETTLEMENT_COLUMNS: Array<ColumnDef> = [
  ["seq", "순번"],
  ["open_date", "개통일"],
  ["customer_name", "고객명"],
  ["product", "가입상품"],
  ["rate_plan", "요금제"],
  ["sale_type", "판매유형"],
  ["device_model", "단말기"],
  ["unit_price", "단가표 기준(₩)"],
  ["vas_fee", "부가서비스 수수료(₩)"],
  ["distributor_amount", "유통망(₩)"],
  ["extra_subsidy", "추가지원금(₩)"],
  ["cash_support_amount", "현금지원금(₩)"],
  ["receivable_amount", "미수금(₩)"],
  ["receivable_paid", "미수금 입금"],
  ["net_fee", "순수익(₩)"],
  ["approval_status", "검수상태"],
];

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  columns: Array<ColumnDef>;
  table: string;
  dateField: string;
  statusFilters?: { label: string; field: string; value: string }[];
}

const TABS: TabDef[] = [
  {
    key: "sales",
    label: "실적 / 판매원장",
    icon: <FileSpreadsheet className="size-4" />,
    columns: SALES_COLUMNS,
    table: "sales",
    dateField: "open_date",
    statusFilters: [
      { label: "미수급 건", field: "receivable_paid_ne", value: "완료" },
      { label: "상품권 미반납", field: "voucher_returned_ne", value: "유" },
      { label: "승인대기", field: "approval_status", value: "승인대기" },
      { label: "확정", field: "approval_status", value: "확정" },
    ],
  },
  {
    key: "expenses",
    label: "지출",
    icon: <Calculator className="size-4" />,
    columns: AD_SPEND_COLUMNS,
    table: "ad_spend",
    dateField: "spend_date",
  },
  {
    key: "customers",
    label: "고객관리",
    icon: <Filter className="size-4" />,
    columns: INQUIRY_COLUMNS,
    table: "inquiries",
    dateField: "inquiry_date",
    statusFilters: [
      { label: "문의중", field: "status", value: "문의중" },
      { label: "성공", field: "status", value: "성공" },
      { label: "실패", field: "status", value: "실패" },
    ],
  },
  {
    key: "inventory",
    label: "단말 재고",
    icon: <FileSpreadsheet className="size-4" />,
    columns: DEVICE_INVENTORY_COLUMNS,
    table: "device_inventory",
    dateField: "stock_in_date",
    statusFilters: [
      { label: "재고", field: "status", value: "재고" },
      { label: "판매완료", field: "status", value: "판매완료" },
    ],
  },
];

interface HistoryRow {
  id: string; category: string; label: string; filters: any;
  row_count: number; storage_path: string | null; file_name: string;
  file_size: number | null; status: string; error_message: string | null;
  created_at: string; completed_at: string | null;
}

const fmtSize = (n: number | null) => !n ? "-" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

const DownloadsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("sales");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedCols, setSelectedCols] = useState<Record<TabKey, Set<string>>>(() => {
    const m: any = {};
    for (const t of TABS) m[t.key] = new Set(t.columns.map(([k]) => k));
    return m;
  });
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data } = await supabase
      .from("download_history")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as HistoryRow[]);
    setLoadingHistory(false);
  }, [user]);

  useEffect(() => { loadHistory(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("download_history_self")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "download_history", filter: `user_id=eq.${user.id}` },
        () => loadHistory()
      ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const toggleCol = (tab: TabKey, col: string) => {
    setSelectedCols((prev) => {
      const s = new Set(prev[tab]);
      s.has(col) ? s.delete(col) : s.add(col);
      return { ...prev, [tab]: s };
    });
  };
  const toggleAllCols = (tab: TabKey, allCols: string[]) => {
    setSelectedCols((prev) => {
      const allSelected = allCols.every((c) => prev[tab].has(c));
      return { ...prev, [tab]: allSelected ? new Set<string>() : new Set(allCols) };
    });
  };

  /* ── 클라이언트 사이드 엑셀 추출 ── */
  const runClientExport = async (tab: TabDef, cols: Array<ColumnDef>, labelSuffix = "") => {
    const key = tab.key + labelSuffix;
    setBusy(key);
    try {
      let query = supabase.from(tab.table as any).select("*");
      if (start) query = query.gte(tab.dateField, start);
      if (end) query = query.lte(tab.dateField, end);

      // status filter
      if (statusFilter) {
        const sf = tab.statusFilters?.find((f) => f.label === statusFilter);
        if (sf) {
          if (sf.field.endsWith("_ne")) {
            query = query.neq(sf.field.replace("_ne", ""), sf.value);
          } else {
            query = query.eq(sf.field, sf.value);
          }
        }
      }

      const { data, error } = await query.order(tab.dateField, { ascending: false }).limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];

      // flatten custom_fields for card columns
      const flatRows = rows.map((r) => {
        const cf = r.custom_fields ?? {};
        return { ...r, cf_card_company: cf.card_company ?? "", cf_card_last4: cf.card_last4 ?? "", cf_card_amount: cf.card_amount ?? "" };
      });

      const fileName = `${tab.label}${labelSuffix}_${format(new Date(), "yyyyMMdd")}`;
      exportToExcel(flatRows, cols, fileName, tab.label);
    } catch (e) {
      toast.error("다운로드 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const handleDownload = () => {
    const activeCols = currentTab.columns.filter(([k]) => selectedCols[activeTab].has(k));
    if (activeCols.length === 0) { toast.warning("다운로드할 항목(열)을 최소 1개 선택하세요"); return; }
    runClientExport(currentTab, activeCols);
  };

  /* 법인카드 전용 */
  const handleCorpCard = () => {
    const salesTab = TABS.find((t) => t.key === "sales")!;
    runClientExport(salesTab, CORP_CARD_COLUMNS, "_법인카드");
  };

  /* 정산용 양식 */
  const handleSettlement = () => {
    const salesTab = TABS.find((t) => t.key === "sales")!;
    runClientExport(salesTab, SETTLEMENT_COLUMNS, "_정산양식");
  };

  const handleReDownload = async (row: HistoryRow) => {
    if (!row.storage_path) { toast.error("저장된 파일이 없습니다"); return; }
    const { data, error } = await supabase.storage.from("exports").createSignedUrl(row.storage_path, 600);
    if (error || !data) { toast.error("링크 생성 실패"); return; }
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = row.file_name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const removeRow = async (row: HistoryRow) => {
    if (row.storage_path) await supabase.storage.from("exports").remove([row.storage_path]);
    await supabase.from("download_history").delete().eq("id", row.id);
    toast.success("삭제되었습니다"); loadHistory();
  };

  const colCount = selectedCols[activeTab].size;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">데이터 다운로드 센터</h1>
        <p className="text-sm text-muted-foreground mt-1">
          카테고리와 항목을 선택 → 기간/상태 필터 적용 → 엑셀 다운로드
        </p>
      </div>

      {/* ── 기간 필터 (공통) ── */}
      <Card className="border-border/40">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">시작일</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">종료일</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
            </div>
            <Select
              onValueChange={(v) => {
                if (v === "today") { setStart(today()); setEnd(today()); }
                else if (v === "month") { setStart(monthStart()); setEnd(today()); }
                else if (v === "90d") {
                setStart(format(new Date(Date.now() - 90 * 86400000), "yyyy-MM-dd"));
                setEnd(today());
              } else if (v === "30d") {
                  setStart(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
                setEnd(today());
              }
            }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="빠른 기간" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="month">이번 달</SelectItem>
                <SelectItem value="30d">최근 30일</SelectItem>
                <SelectItem value="90d">최근 90일</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" onClick={() => { setStatusFilter(null); }}>
              <RefreshCw className="size-3.5 mr-1" /> 필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── 탭 영역 ── */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabKey); setStatusFilter(null); }}>
        <TabsList className="w-full justify-start gap-1 bg-muted/30 p-1 rounded-xl">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3">
              {t.icon} {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-4">
            {/* 상태 필터 */}
            {tab.statusFilters && tab.statusFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center mr-1">상태 필터:</span>
                {tab.statusFilters.map((sf) => (
                  <Button
                    key={sf.label}
                    size="sm"
                    variant={statusFilter === sf.label ? "default" : "outline"}
                    className="h-7 text-xs rounded-full"
                    onClick={() => setStatusFilter(statusFilter === sf.label ? null : sf.label)}
                  >
                    {sf.label}
                  </Button>
                ))}
              </div>
            )}

            {/* 컬럼 피커 */}
            <Card className="border-border/40">
              <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">추출 항목 선택 (Column Picker)</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7"
                  onClick={() => toggleAllCols(tab.key, tab.columns.map(([k]) => k))}>
                  {tab.columns.every(([k]) => selectedCols[tab.key].has(k)) ? "전체 해제" : "전체 선택"}
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-1.5">
                  {tab.columns.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer hover:text-foreground text-muted-foreground transition-colors">
                      <Checkbox
                        checked={selectedCols[tab.key].has(key)}
                        onCheckedChange={() => toggleCol(tab.key, key)}
                        className="size-3.5"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 다운로드 버튼 영역 */}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleDownload} disabled={!!busy || colCount === 0}>
                {busy === tab.key ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                {busy === tab.key ? "생성 중…" : `선택 항목 다운로드 (${colCount}열)`}
              </Button>

              {tab.key === "sales" && (
                <>
                  <Button variant="outline" onClick={handleCorpCard} disabled={!!busy} className="gap-1.5">
                    <CreditCard className="size-4" /> 법인카드 증빙용
                  </Button>
                  <Button variant="outline" onClick={handleSettlement} disabled={!!busy} className="gap-1.5">
                    <Calculator className="size-4" /> 정산용 양식
                  </Button>
                </>
              )}

              <span className="text-xs text-muted-foreground ml-auto">
                {statusFilter && <Badge variant="secondary" className="text-[10px] mr-2">{statusFilter}</Badge>}
                {start} ~ {end}
              </span>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* ── 특수 양식 안내 ── */}
      <Card className="border-dashed border-border/50 bg-muted/10">
        <CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">
            💡 <strong>파일명 규칙:</strong> [카테고리명]_[추출날짜].xlsx 형태로 자동 생성됩니다.
            법인카드·정산 양식은 실적 탭에서 이용 가능합니다.
          </p>
        </CardContent>
      </Card>

      {/* ── 다운로드 기록 ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">최근 7일 다운로드 기록</CardTitle>
          <Button variant="ghost" size="sm" onClick={loadHistory}>
            <RefreshCw className="size-3.5 mr-1" /> 새로고침
          </Button>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="text-sm text-muted-foreground text-center py-6">불러오는 중…</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">기록이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {history.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border transition-colors">
                  <div className="shrink-0">
                    {row.status === "done" ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : row.status === "error" ? (
                      <XCircle className="size-5 text-destructive" />
                    ) : (
                      <Loader2 className="size-5 animate-spin text-primary-glow" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium truncate">
                      {row.label}
                      <Badge variant="outline" className="text-[10px] py-0">{row.category}</Badge>
                      {row.status === "error" && <Badge variant="destructive" className="text-[10px] py-0">실패</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ko })}
                      </span>
                      <span>{row.row_count.toLocaleString()}건</span>
                      <span>{fmtSize(row.file_size)}</span>
                      {row.filters?.start_date && (
                        <span>{row.filters.start_date} ~ {row.filters.end_date}</span>
                      )}
                    </div>
                    {row.error_message && (
                      <div className="text-xs text-destructive mt-1">{row.error_message}</div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {row.status === "done" && row.storage_path && (
                      <Button size="sm" variant="outline" onClick={() => handleReDownload(row)}>
                        <Download className="size-3.5 mr-1" /> 받기
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removeRow(row)} className="size-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DownloadsPage;

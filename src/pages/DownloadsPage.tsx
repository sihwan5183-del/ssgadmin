// 다운로드 센터 — 통합 추출 + 최근 7일 기록
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2, RefreshCw, Trash2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

type Category = "sales" | "inquiries" | "incentives" | "staff";
const CATEGORIES: { key: Category; label: string; desc: string }[] = [
  { key: "sales", label: "판매원장", desc: "전체 실적 + 검수상태/금액" },
  { key: "inquiries", label: "인입현황", desc: "고객 문의 이력 전체" },
  { key: "incentives", label: "인센티브", desc: "건별 상세 + 담당자별 요약" },
  { key: "staff", label: "직원명단", desc: "프로필/팀/매장 정보" },
];

interface HistoryRow {
  id: string;
  category: string;
  label: string;
  filters: any;
  row_count: number;
  storage_path: string | null;
  file_name: string;
  file_size: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

const fmtSize = (n: number | null) => {
  if (!n) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const today = () => format(new Date(), "yyyy-MM-dd");
const monthStart = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");

const DownloadsPage = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Record<Category, boolean>>({
    sales: true, inquiries: false, incentives: false, staff: false,
  });
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
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
  };

  useEffect(() => { loadHistory(); }, [user?.id]);

  // realtime: 내 기록 업데이트 시 새로고침
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

  const runExport = async (category: Category) => {
    setBusy(category);
    try {
      const { data, error } = await supabase.functions.invoke("export-data", {
        body: { category, filters: { start_date: start, end_date: end } },
      });
      if (error) throw error;
      if (data?.signed_url) {
        const a = document.createElement("a");
        a.href = data.signed_url; a.download = data.file_name ?? "export.xlsx";
        document.body.appendChild(a); a.click(); a.remove();
        toast.success(`${category} 다운로드 완료`, {
          description: `${data.row_count?.toLocaleString() ?? 0}건`,
        });
      } else {
        toast.success("생성 완료 — 기록에서 다시 받기로 다운로드하세요");
      }
      await loadHistory();
    } catch (e) {
      toast.error("다운로드 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const runBatch = async () => {
    const cats = (Object.keys(selected) as Category[]).filter((k) => selected[k]);
    if (cats.length === 0) { toast.warning("다운로드할 항목을 선택하세요"); return; }
    for (const c of cats) await runExport(c);
  };

  const reDownload = async (row: HistoryRow) => {
    if (!row.storage_path) { toast.error("저장된 파일이 없습니다"); return; }
    const { data, error } = await supabase.storage.from("exports").createSignedUrl(row.storage_path, 600);
    if (error || !data) { toast.error("링크 생성 실패", { description: error?.message }); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl; a.download = row.file_name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const removeRow = async (row: HistoryRow) => {
    if (row.storage_path) await supabase.storage.from("exports").remove([row.storage_path]);
    await supabase.from("download_history").delete().eq("id", row.id);
    toast.success("삭제되었습니다");
    loadHistory();
  };

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">다운로드 센터</h1>
        <p className="text-sm text-muted-foreground mt-1">
          원하는 항목과 기간을 선택해 한번에 엑셀로 추출하세요. 최근 7일간 받은 파일은 아래에서 다시 받을 수 있습니다.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">새 다운로드</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelected((s) => ({ ...s, [c.key]: !s[c.key] }))}
                className={`text-left rounded-xl border p-3 transition-all ${
                  selected[c.key]
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border/40 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <FileSpreadsheet className="size-4 text-primary-glow" /> {c.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs">시작일</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">종료일</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
            </div>
            <Select onValueChange={(v) => {
              if (v === "today") { setStart(today()); setEnd(today()); }
              else if (v === "month") { setStart(monthStart()); setEnd(today()); }
              else if (v === "30d") {
                setStart(format(new Date(Date.now() - 30 * 86400000), "yyyy-MM-dd"));
                setEnd(today());
              }
            }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="빠른 기간" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="month">이번 달</SelectItem>
                <SelectItem value="30d">최근 30일</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount}개 항목 선택됨` : "항목을 선택하세요"}
            </div>
            <Button onClick={runBatch} disabled={!!busy || selectedCount === 0}>
              {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
              {busy ? `생성 중 (${busy})…` : `선택 항목 다운로드 (${selectedCount})`}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                      <Button size="sm" variant="outline" onClick={() => reDownload(row)}>
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

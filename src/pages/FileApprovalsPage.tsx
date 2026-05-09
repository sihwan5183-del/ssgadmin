import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ShieldCheck, XCircle, Clock, Eye, Download, History, Search, FileText, Users,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface VaultRow {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string;
  status: "pending" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

interface DLog {
  id: string;
  file_id: string;
  downloaded_by: string;
  downloaded_at: string;
}

const TABS = [
  { key: "pending", label: "승인 대기", icon: Clock },
  { key: "approved", label: "승인 완료", icon: ShieldCheck },
  { key: "rejected", label: "반려", icon: XCircle },
] as const;

export default function FileApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("pending");
  const [rows, setRows] = useState<VaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [profiles, setProfiles] = useState<Record<string, { name: string; team: string | null; resigned: boolean }>>({});
  const [logsOpen, setLogsOpen] = useState<VaultRow | null>(null);
  const [logs, setLogs] = useState<DLog[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, team, status, deleted_at")
        .limit(2000);
      const m: Record<string, { name: string; team: string | null; resigned: boolean }> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.user_id) return;
        const resigned = p.status === "deleted" || p.status === "resigned" || !!p.deleted_at;
        m[p.user_id] = {
          name: resigned ? `${p.display_name}(퇴사자)` : p.display_name,
          team: p.team ?? null,
          resigned,
        };
      });
      setProfiles(m);
    })();
  }, []);

  const resolveName = (uid: string) => profiles[uid]?.name ?? "-";
  const resolveTeam = (uid: string) => profiles[uid]?.team ?? "";
  const teamOptions = Array.from(
    new Set(Object.values(profiles).map((p) => p.team).filter(Boolean) as string[])
  ).sort();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("file_vault")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });
    setRows((data ?? []) as VaultRow[]);
    setLoading(false);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (teamFilter !== "all" && resolveTeam(r.uploaded_by) !== teamFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const meta = profiles[r.uploaded_by];
    return (r.file_name + " " + (r.description ?? "") + " " + (meta?.name ?? "") + " " + (meta?.team ?? ""))
      .toLowerCase()
      .includes(q);
  });

  const approve = async (row: VaultRow) => {
    const { error } = await supabase
      .from("file_vault")
      .update({ status: "approved", approved_by: user!.id, approved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`${row.file_name} 승인 완료`);
    load();
  };

  const reject = async (row: VaultRow) => {
    const reason = prompt("반려 사유를 입력하세요", "내용 부적합");
    if (reason === null) return;
    const { error } = await supabase
      .from("file_vault")
      .update({ status: "rejected", rejected_reason: reason })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("반려 처리되었습니다");
    load();
  };

  const preview = async (row: VaultRow) => {
    const { data, error } = await supabase.storage
      .from("secure-files")
      .createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error("URL 생성 실패");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (row: VaultRow) => {
    const { data, error } = await supabase.storage
      .from("secure-files")
      .createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error("URL 생성 실패");
    await supabase.from("file_vault_downloads").insert({
      file_id: row.id,
      downloaded_by: user!.id,
      user_agent: navigator.userAgent,
    });
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = row.file_name;
    a.click();
  };

  const openLogs = async (row: VaultRow) => {
    setLogsOpen(row);
    const { data } = await supabase
      .from("file_vault_downloads")
      .select("*")
      .eq("file_id", row.id)
      .order("downloaded_at", { ascending: false });
    setLogs((data ?? []) as DLog[]);
  };

  return (
    <>
      <Header
        title="파일 승인 관리"
        subtitle="직원이 업로드한 파일을 검토하고 승인 또는 반려합니다"
        showScopeToggle={false}
      />

      <div className="flex items-center gap-1 border-b border-[#F0F0F0] mb-4 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap transition ${
                active ? "text-[#1A1A1A] font-semibold" : "text-neutral-500 hover:text-[#1A1A1A]"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
              {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-[#E6007E] rounded-full" />}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <Users className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="팀 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">팀 전체</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="파일명·업로더·팀 검색…"
            className="h-9 pl-9 text-sm"
          />
          </div>
        </div>
      </div>

      <Card className="border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-left px-3 py-2">파일</th>
                <th className="text-left px-3 py-2">설명</th>
                <th className="text-left px-3 py-2">업로더 / 팀</th>
                <th className="text-left px-3 py-2">크기</th>
                <th className="text-left px-3 py-2">업로드 일시</th>
                <th className="text-right px-3 py-2 w-[280px]">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">파일이 없습니다</td></tr>
              ) : filtered.map((r) => {
                const statusMeta =
                  r.status === "approved"
                    ? { label: "승인 완료", cls: "text-emerald-600", Icon: ShieldCheck }
                    : r.status === "rejected"
                    ? { label: "반려", cls: "text-rose-600", Icon: XCircle }
                    : { label: "승인 대기", cls: "text-amber-600", Icon: Clock };
                const SIcon = statusMeta.Icon;
                return (
                <tr key={r.id} className="border-t border-border/30 hover:bg-muted/10 align-top">
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-xs ${statusMeta.cls}`}>
                      <SIcon className="size-3.5" /> {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    <button
                      onClick={() => preview(r)}
                      className="inline-flex items-center gap-1.5 hover:text-[#E6007E] hover:underline text-left"
                      title="미리보기"
                    >
                      <FileText className="size-3.5 text-muted-foreground" />
                      {r.file_name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px]">
                    {r.description || "-"}
                    {r.status === "rejected" && r.rejected_reason && (
                      <div className="text-rose-600 mt-1">반려 사유: {r.rejected_reason}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="font-medium text-foreground">{resolveName(r.uploaded_by)}</div>
                    <div className="text-[11px] text-muted-foreground">{resolveTeam(r.uploaded_by) || "-"}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("ko-KR", {
                      year: "numeric", month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                      <Button size="sm" variant="ghost" onClick={() => preview(r)} title="미리보기">
                        <Eye className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => download(r)} title="다운로드">
                        <Download className="size-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openLogs(r)} title="다운로드 기록">
                        <History className="size-3.5" />
                      </Button>
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => approve(r)} className="bg-[#E6007E] hover:bg-[#c20069] text-white">
                            <ShieldCheck className="size-3.5 mr-1" /> 승인
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => reject(r)}>
                            반려
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">
                          {r.approved_at && new Date(r.approved_at).toLocaleDateString("ko-KR")} 승인
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!logsOpen} onOpenChange={(v) => !v && setLogsOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" /> 다운로드 기록 — {logsOpen?.file_name}
            </DialogTitle>
          </DialogHeader>
          {logs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">아직 다운로드된 적 없습니다</div>
          ) : (
            <ul className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-1.5">
                  <span className="font-medium">
                    {resolveName(l.downloaded_by)}
                    {resolveTeam(l.downloaded_by) && (
                      <span className="text-[11px] text-muted-foreground ml-1.5">/ {resolveTeam(l.downloaded_by)}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(l.downloaded_at).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
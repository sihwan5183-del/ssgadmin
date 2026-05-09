import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import {
  FileUp, Loader2, Download, Trash2, ShieldCheck, Clock, XCircle, Lock,
} from "lucide-react";

interface VaultRow {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string;
  status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

const MAX = 50 * 1024 * 1024; // 50MB

const sanitize = (s: string) =>
  (s || "").replace(/[\\/:*?"<>|\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

const STATUS_LABEL: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "승인 대기", cls: "text-amber-600", icon: Clock },
  approved: { label: "승인 완료", cls: "text-emerald-600", icon: ShieldCheck },
  rejected: { label: "반려", cls: "text-rose-600", icon: XCircle },
};

export default function FileVaultPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [rows, setRows] = useState<VaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("file_vault")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as VaultRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onPick = (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    const list = Array.from(files);
    void uploadAll(list);
  };

  const uploadAll = async (files: File[]) => {
    if (!user) return;
    setUploading(true);
    let ok = 0;
    for (const file of files) {
      if (file.size > MAX) {
        toast.error(`${file.name} — 50MB 초과`);
        continue;
      }
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const safe = sanitize(file.name.replace(/\.[^.]+$/, "")) || "file";
      const path = `${user.id}/${Date.now()}_${safe}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("secure-files")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) { toast.error(`${file.name} 업로드 실패: ${upErr.message}`); continue; }
      const { error: dbErr } = await supabase.from("file_vault").insert({
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
        description: description || null,
        uploaded_by: user.id,
      });
      if (dbErr) {
        await supabase.storage.from("secure-files").remove([path]);
        toast.error(`${file.name} 저장 실패: ${dbErr.message}`);
        continue;
      }
      ok++;
    }
    setUploading(false);
    if (ok > 0) {
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      toast.success(
        `${ok}개 파일이 서버로 안전하게 전송되었습니다. 관리자 승인 후 다운로드가 가능합니다. PC의 원본 파일은 삭제해 주세요.`,
        { duration: 8000 },
      );
      load();
    }
  };

  const remove = async (row: VaultRow) => {
    if (!confirm(`${row.file_name} 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("file_vault").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("secure-files").remove([row.storage_path]);
    toast.success("삭제되었습니다");
    load();
  };

  const download = async (row: VaultRow) => {
    if (row.status !== "approved") {
      toast.error("승인된 파일만 다운로드 가능합니다");
      return;
    }
    const { data, error } = await supabase.storage
      .from("secure-files")
      .createSignedUrl(row.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error("다운로드 URL 생성 실패");
    // 로그 남김
    await supabase.from("file_vault_downloads").insert({
      file_id: row.id,
      downloaded_by: user!.id,
      user_agent: navigator.userAgent,
    });
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = row.file_name;
    a.click();
    toast.success("다운로드 시작 — 기록이 남습니다");
  };

  return (
    <>
      <Header
        title="파일 보관함"
        subtitle="고객 명단·계약서 등 민감 파일을 안전하게 업로드하고 관리자 승인을 받습니다"
        showScopeToggle={false}
      />

      <Card className="p-5 mb-5 border-border/40">
        <div className="flex items-start gap-3 mb-3">
          <Lock className="size-4 text-[#E6007E] mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            업로드한 파일은 <b className="text-foreground">즉시 승인 대기 상태</b>로 보관되며,
            관리자가 승인하기 전까지는 누구도 다운로드할 수 없습니다.<br />
            업로드 후에는 반드시 <b className="text-foreground">PC의 원본 파일을 삭제</b>해 주세요.
          </div>
        </div>
        <Textarea
          placeholder="파일 설명(선택) — 예: 아파트 입주민 명단, 계약서 사본 등"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-3 min-h-[64px]"
        />
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border/60 hover:border-[#E6007E]/50 rounded-xl px-4 py-8 text-center cursor-pointer transition"
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> 업로드 중…
            </div>
          ) : (
            <>
              <FileUp className="size-7 mx-auto text-[#E6007E] mb-2" />
              <div className="text-sm font-medium">파일 선택 또는 끌어다 놓기</div>
              <div className="text-[11px] text-muted-foreground mt-1">최대 50MB · 모든 형식 지원</div>
            </>
          )}
        </div>
      </Card>

      <Card className="border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{isAdmin ? "전체 업로드 내역" : "내 업로드 내역"}</h3>
          <span className="text-xs text-muted-foreground">{rows.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">상태</th>
                <th className="text-left px-3 py-2">파일명</th>
                <th className="text-left px-3 py-2">설명</th>
                <th className="text-left px-3 py-2">크기</th>
                <th className="text-left px-3 py-2">업로드</th>
                <th className="text-right px-3 py-2">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">업로드된 파일이 없습니다</td></tr>
              ) : rows.map((r) => {
                const s = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
                const Icon = s.icon;
                const own = r.uploaded_by === user?.id;
                const canDownload = r.status === "approved";
                return (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/10">
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs ${s.cls}`}>
                        <Icon className="size-3.5" /> {s.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.file_name}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px] truncate">
                      {r.description || "-"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.file_size ? `${(r.file_size / 1024).toFixed(0)} KB` : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ko-KR", {
                        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canDownload}
                          onClick={() => download(r)}
                          title={canDownload ? "다운로드" : "관리자 승인 후 가능합니다"}
                        >
                          <Download className="size-3.5 mr-1" />
                          다운로드
                        </Button>
                        {(own && r.status === "pending") || isAdmin ? (
                          <Button size="sm" variant="ghost" onClick={() => remove(r)} title="삭제">
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
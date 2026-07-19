import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { StaffDetailDialog } from "@/components/admin/accounts/StaffDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStores } from "@/hooks/useStores";
import { ROLE_LABELS, type AppRole } from "@/hooks/useRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useRole } from "@/hooks/useRole";
import { formatStaffName } from "@/lib/staffName";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phoneFormat";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Row {
  user_id: string;
  display_name: string;
  phone: string | null;
  team: string | null;
  store: string | null;
  position: string | null;
  status: string;
  hire_date: string | null;
  created_at: string;
  show_in_dashboard?: boolean;
  push_enabled?: boolean;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "정상", variant: "default" },
  pending: { label: "대기", variant: "secondary" },
  suspended: { label: "정지", variant: "destructive" },
  leave: { label: "휴직", variant: "outline" },
  resigned: { label: "퇴사", variant: "outline" },
};

export default function AccountStaffPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selected, setSelected] = useState<{ id: string; email: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { isSuperAdmin } = useSuperAdmin();
  const { isAdmin } = useRole();
  const canDelete = isAdmin || isSuperAdmin;
  const [includeResigned, setIncludeResigned] = useState(false);
  const { stores } = useStores();
  const yearMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [successMap, setSuccessMap] = useState<Record<string, number>>({});
  const [pushTokenUsers, setPushTokenUsers] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const monthStart = `${yearMonth}-01`;
    const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).toISOString().slice(0, 10);
    const [{ data: profs }, { data: roleRows }, { data: salesRows }, { data: tokenRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, phone, team, store, position, status, hire_date, created_at, show_in_dashboard, push_enabled")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      fetchAllRows(({ from, to }) =>
        supabase.from("sales")
          .select("created_by, approval_status")
          .gte("open_date", monthStart)
          .lte("open_date", monthEnd)
          .range(from, to)
      ).then((data) => ({ data })),
      supabase.from("user_push_tokens").select("user_id"),
    ]);
    setRows((profs ?? []) as Row[]);
    setPushTokenUsers(new Set(((tokenRows ?? []) as { user_id: string }[]).map((t) => t.user_id)));
    const roleMap: Record<string, AppRole[]> = {};
    for (const r of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
      (roleMap[r.user_id] ||= []).push(r.role);
    }
    setRolesByUser(roleMap);
    const sm: Record<string, number> = {};
    (salesRows ?? []).forEach((r: any) => {
      // 정책: 검수 상태와 무관하게 [저장]된 모든 실적을 직원별 집계에 포함
      sm[r.created_by] = (sm[r.created_by] ?? 0) + 1;
    });
    setSuccessMap(sm);
    // 이메일 일괄 조회 (관리자만 응답 받음)
    supabase.functions
      .invoke("admin-user-management", { body: { action: "list_user_emails" } })
      .then(({ data }) => {
        if (data?.emails) setEmails(data.emails as Record<string, string>);
      })
      .catch(() => {});
    setLoading(false);
  }, [yearMonth]);

  useEffect(() => { refresh(); }, [refresh]);

  const performSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "delete_user", user_id: deleteTarget.user_id },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error ?? error?.message);
      }
      toast.success(`${deleteTarget.display_name} 님을 퇴사 처리했습니다`, {
        description: "기존 실적 데이터는 그대로 보존됩니다.",
      });
      setDeleteTarget(null);
      refresh();
    } catch (e) {
      toast.error("삭제 실패", { description: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      // 퇴사자/삭제는 기본 제외, 토글로만 노출
      const isResigned = r.status === "resigned" || r.status === "deleted";
      if (isResigned && !includeResigned && statusFilter !== "resigned") return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (storeFilter !== "all" && (r.store ?? "") !== storeFilter) return false;
      if (roleFilter !== "all") {
        const rs = rolesByUser[r.user_id] ?? [];
        if (!rs.includes(roleFilter as AppRole)) return false;
      }
      if (!ql) return true;
      return [r.display_name, r.phone, r.team, r.store, r.position, emails[r.user_id]]
        .filter(Boolean).join(" ").toLowerCase().includes(ql);
    });
  }, [rows, q, statusFilter, storeFilter, roleFilter, rolesByUser, emails, includeResigned]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-foreground flex items-center gap-2">
        <Info className="size-3.5 text-primary shrink-0" />
        <span>
          이곳에서 <span className="font-semibold text-primary">'대시보드 노출'</span>이 켜진 직원만 메인 대시보드의 [개인별 실적 현황]에 나타납니다. (기본값 OFF)
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·연락처·이메일·매장·팀·직급 검색" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">정상</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="suspended">정지</SelectItem>
            <SelectItem value="leave">휴직</SelectItem>
            <SelectItem value="resigned">퇴사</SelectItem>
          </SelectContent>
        </Select>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="매장" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 매장</SelectItem>
            {stores.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="권한" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 권한</SelectItem>
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none px-2">
          <Checkbox
            checked={includeResigned}
            onCheckedChange={(v) => setIncludeResigned(!!v)}
            id="include-resigned"
          />
          <span>퇴사자 포함 보기</span>
        </label>
        {canDelete && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={async () => {
                const ids = filtered.map((r) => r.user_id);
                if (ids.length === 0) return;
                setBulkBusy(true);
                const { error } = await supabase.from("profiles").update({ push_enabled: true }).in("user_id", ids);
                setBulkBusy(false);
                if (error) { toast.error("일괄 변경 실패: " + error.message); return; }
                setRows((prev) => prev.map((x) => ids.includes(x.user_id) ? { ...x, push_enabled: true } : x));
                toast.success(`${ids.length}명 알림 수신 ON`);
              }}
            >전체 ON</Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkBusy}
              onClick={async () => {
                const ids = filtered.map((r) => r.user_id);
                if (ids.length === 0) return;
                setBulkBusy(true);
                const { error } = await supabase.from("profiles").update({ push_enabled: false }).in("user_id", ids);
                setBulkBusy(false);
                if (error) { toast.error("일괄 변경 실패: " + error.message); return; }
                setRows((prev) => prev.map((x) => ids.includes(x.user_id) ? { ...x, push_enabled: false } : x));
                toast.success(`${ids.length}명 알림 수신 OFF`);
              }}
            >전체 OFF</Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground bg-muted/40">
                  <th className="text-left px-3 py-2">이름</th>
                  <th className="text-left px-3 py-2">이메일</th>
                  <th className="text-left px-3 py-2">매장</th>
                  <th className="text-left px-3 py-2">팀</th>
                  <th className="text-left px-3 py-2">직급</th>
                  <th className="text-left px-3 py-2">권한</th>
                  <th className="text-left px-3 py-2">연락처</th>
                  <th className="text-left px-3 py-2">입사일</th>
                  <th className="text-left px-3 py-2">상태</th>
                  <th className="text-right px-3 py-2">개통</th>
                  <th className="text-center px-3 py-2">대시보드</th>
                  <th className="text-center px-3 py-2">알림 수신</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  const rs = rolesByUser[r.user_id] ?? [];
                  const success = successMap[r.user_id] ?? 0;
                  const isResigned = r.status === "resigned" || r.status === "deleted";
                  const canDeleteThis =
                    canDelete && (r.status === "suspended" || r.status === "resigned");
                  return (
                    <tr key={r.user_id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">
                        {formatStaffName(r.display_name, isResigned)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{emails[r.user_id] ?? "-"}</td>
                      <td className="px-3 py-2">{r.store ?? "-"}</td>
                      <td className="px-3 py-2">{r.team ?? "-"}</td>
                      <td className="px-3 py-2">{r.position ?? "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {rs.length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : rs.map((role) => (
                            <Badge key={role} variant="secondary" className="text-[10px]">{ROLE_LABELS[role] ?? role}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.phone ? formatPhone(r.phone) : "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.hire_date ?? "-"}</td>
                      <td className="px-3 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{success}</td>
                      <td className="px-3 py-2 text-center">
                        <Switch
                          checked={!!r.show_in_dashboard}
                          onCheckedChange={async (v) => {
                            const { error } = await supabase
                              .from("profiles")
                              .update({ show_in_dashboard: v })
                              .eq("user_id", r.user_id);
                            if (error) {
                              toast.error("변경 실패: " + error.message);
                              return;
                            }
                            setRows((prev) => prev.map((x) => x.user_id === r.user_id ? { ...x, show_in_dashboard: v } : x));
                            toast.success(`${r.display_name} · 대시보드 ${v ? "노출" : "숨김"}`);
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <Switch
                            checked={r.push_enabled !== false}
                            className="data-[state=checked]:bg-primary"
                            onCheckedChange={async (v) => {
                              const { error } = await supabase
                                .from("profiles")
                                .update({ push_enabled: v })
                                .eq("user_id", r.user_id);
                              if (error) { toast.error("변경 실패: " + error.message); return; }
                              setRows((prev) => prev.map((x) => x.user_id === r.user_id ? { ...x, push_enabled: v } : x));
                              toast.success(`${r.display_name} · 알림 ${v ? "ON" : "OFF"}`);
                            }}
                          />
                          {!pushTokenUsers.has(r.user_id) && (
                            <span className="text-[9px] text-muted-foreground leading-none">(미등록 기기)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelected({ id: r.user_id, email: emails[r.user_id] ?? null })}>상세</Button>
                          {canDeleteThis && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(r)}
                              title="계정 삭제"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} className="text-center py-10 text-muted-foreground text-sm">결과 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <StaffDetailDialog
        userId={selected?.id ?? null}
        email={selected?.email ?? null}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onChanged={refresh}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 직원의 계정을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.display_name}</strong> 님의 계정을 삭제합니다.
              <br />
              과거 실적 데이터에는 <em>(퇴사자)</em> 로 표기됩니다.
              <br />
              계정은 즉시 로그인이 차단되고 모든 세션이 종료됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); performSoftDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "처리 중…" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

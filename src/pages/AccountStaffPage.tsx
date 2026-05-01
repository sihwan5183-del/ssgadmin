import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  const { stores } = useStores();
  const yearMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [successMap, setSuccessMap] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const monthStart = `${yearMonth}-01`;
    const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0).toISOString().slice(0, 10);
    const [{ data: profs }, { data: roleRows }, { data: salesRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, phone, team, store, position, status, hire_date, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("sales")
        .select("created_by, approval_status")
        .gte("open_date", monthStart)
        .lte("open_date", monthEnd)
        .limit(20000),
    ]);
    setRows((profs ?? []) as Row[]);
    const roleMap: Record<string, AppRole[]> = {};
    for (const r of (roleRows ?? []) as { user_id: string; role: AppRole }[]) {
      (roleMap[r.user_id] ||= []).push(r.role);
    }
    setRolesByUser(roleMap);
    const sm: Record<string, number> = {};
    (salesRows ?? []).forEach((r: any) => {
      if (r.approval_status === "취소" || r.approval_status === "반려") return;
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
  }, [rows, q, statusFilter, storeFilter, roleFilter, rolesByUser, emails]);

  return (
    <div className="space-y-3">
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
                  <th className="text-right px-3 py-2">인입({yearMonth.slice(5)})</th>
                  <th className="text-right px-3 py-2">개통</th>
                  <th className="text-right px-3 py-2">전환율</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  const rs = rolesByUser[r.user_id] ?? [];
                  const inflow = inflowMap[r.user_id] ?? 0;
                  const success = successMap[r.user_id] ?? 0;
                  const conv = inflow > 0 ? Math.round((success / inflow) * 100) : 0;
                  const editVal = inflowEdit[r.user_id];
                  return (
                    <tr key={r.user_id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.display_name}</td>
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
                      <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.hire_date ?? "-"}</td>
                      <td className="px-3 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-3 py-2 text-right">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number" min={0} className="h-7 w-20 text-right tabular-nums"
                              value={editVal !== undefined ? editVal : String(inflow)}
                              onChange={(e) => setInflowEdit((m) => ({ ...m, [r.user_id]: e.target.value }))}
                            />
                            {editVal !== undefined && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" disabled={savingInflow === r.user_id} onClick={() => saveInflow(r.user_id)}>
                                <Save className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums text-muted-foreground">{inflow}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{success}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className={conv >= 50 ? "text-emerald-600 font-semibold" : conv >= 25 ? "text-amber-600 font-medium" : "text-muted-foreground"}>{inflow > 0 ? `${conv}%` : "-"}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelected({ id: r.user_id, email: emails[r.user_id] ?? null })}>상세</Button>
                          {isSuperAdmin && r.status !== "resigned" && r.status !== "deleted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(r)}
                              title="계정 삭제 (퇴사 처리)"
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
            <AlertDialogTitle>계정 삭제(퇴사 처리)</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.display_name}</strong> 님의 계정을 삭제(퇴사 처리)하시겠습니까?
              <br />
              삭제 후에도 기존 실적 데이터는 보존되며, 작성자 이름 옆에 <em>(퇴사자)</em> 표기가 자동으로 붙습니다.
              <br />
              해당 계정은 즉시 로그인이 차단되고 모든 세션이 종료됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); performSoftDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "처리 중…" : "삭제(퇴사 처리)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

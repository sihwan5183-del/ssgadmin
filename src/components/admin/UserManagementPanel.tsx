import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole, ROLE_LABELS, type AppRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { KeyRound, UserX, UserCheck, Pencil, Search, Smartphone, Copy, UserMinus, UserCog } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";

interface UserRow {
  user_id: string;
  display_name: string;
  phone: string | null;
  store: string | null;
  position: string | null;
  team: string | null;
  status: string;
  role: AppRole | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "재직",
  leave: "휴직",
  resigned: "퇴사",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  leave: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  resigned: "bg-destructive/15 text-destructive border-destructive/30",
};

const ROLE_OPTIONS: AppRole[] = [
  "ceo",
  "planner",
  "team_lead",
  "staff",
  "admin",
  "manager",
  "user",
];

export function UserManagementPanel() {
  const { user: me } = useAuth();
  const { isAdmin } = useRole();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [tempPwd, setTempPwd] = useState("");
  const [override, setOverride] = useState<{ user: UserRow; link: string; expires: string } | null>(null);

  const issueOverride = async (u: UserRow) => {
    const { data, error } = await supabase.functions.invoke("admin-user-management", {
      body: { action: "admin_issue_magic_link", user_id: u.user_id },
    });
    if (error || (data as any)?.error) {
      toast.error("임시 승인 링크 발급 실패: " + (error?.message || (data as any)?.error));
      return;
    }
    const t = (data as any).token;
    const link = `${window.location.origin}/magic-link?token=${t}`;
    setOverride({ user: u, link, expires: (data as any).expires_at });
  };

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, phone, store, position, team, status").order("display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
    setRows(
      (profiles ?? []).map((p: any) => ({
        ...p,
        role: roleMap.get(p.user_id) ?? null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.display_name?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.store?.toLowerCase().includes(q) ||
      r.team?.toLowerCase().includes(q) ||
      r.position?.toLowerCase().includes(q)
    );
  });

  const ids = filtered.map((r) => r.user_id);
  const bulk = useBulkSelection<string>(ids);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState<string | null>(null);

  const bulkSetStatus = async (status: "active" | "leave" | "resigned") => {
    setBulkBusy(true);
    const { error } = await supabase.from("profiles").update({ status }).in("user_id", bulk.selectedIds);
    if (!error && status !== "active") {
      // 휴직/퇴사는 로그인 차단도 함께
      await Promise.all(
        bulk.selectedIds.map((uid) =>
          supabase.functions.invoke("admin-user-management", {
            body: { action: "set_active", user_id: uid, active: false },
          }),
        ),
      );
    } else if (!error && status === "active") {
      await Promise.all(
        bulk.selectedIds.map((uid) =>
          supabase.functions.invoke("admin-user-management", {
            body: { action: "set_active", user_id: uid, active: true },
          }),
        ),
      );
    }
    setBulkBusy(false);
    setBulkStatusOpen(null);
    if (error) {
      toast.error("일괄 변경 실패: " + error.message);
      return;
    }
    toast.success(`${bulk.selectedIds.length}명 → ${STATUS_LABELS[status]}`);
    bulk.clear();
    fetchAll();
  };

  const saveProfile = async () => {
    if (!editing) return;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        display_name: editing.display_name,
        phone: editing.phone,
        store: editing.store,
        team: editing.team,
        position: editing.position,
        status: editing.status,
      })
      .eq("user_id", editing.user_id);
    if (pErr) {
      toast.error("프로필 저장 실패: " + pErr.message);
      return;
    }
    // role 동기화
    await supabase.from("user_roles").delete().eq("user_id", editing.user_id);
    if (editing.role) {
      await supabase
        .from("user_roles")
        .insert({ user_id: editing.user_id, role: editing.role });
    }
    // 비활성화 즉시 차단
    if (editing.status !== "active") {
      await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "set_active",
          user_id: editing.user_id,
          active: false,
        },
      });
    } else {
      await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "set_active",
          user_id: editing.user_id,
          active: true,
        },
      });
    }
    toast.success("저장되었습니다");
    setEditing(null);
    fetchAll();
  };

  const resetPassword = async () => {
    if (!resetting || !tempPwd) return;
    const { data, error } = await supabase.functions.invoke(
      "admin-user-management",
      {
        body: {
          action: "reset_password",
          user_id: resetting.user_id,
          new_password: tempPwd,
        },
      }
    );
    if (error || (data as any)?.error) {
      toast.error("초기화 실패: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success(
      `${resetting.display_name}님의 임시 비밀번호: ${tempPwd}`,
      { duration: 10000 }
    );
    setResetting(null);
    setTempPwd("");
  };

  if (!isAdmin) {
    return (
      <Card className="p-6 glass">
        <p className="text-sm text-muted-foreground">관리자만 접근 가능합니다.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 glass space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">직원 관리</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            정보·권한·재직상태·비밀번호를 한 곳에서 관리합니다 ({rows.length}명)
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="이름·연락처·매장·팀 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border/50">
            <tr>
              <th className="w-8 py-2 px-2">
                <Checkbox
                  checked={bulk.allOnPageSelected}
                  onCheckedChange={(v) => bulk.togglePage(!!v)}
                />
              </th>
              <th className="text-left py-2 px-2">이름</th>
              <th className="text-left py-2 px-2">연락처</th>
              <th className="text-left py-2 px-2">매장 / 팀</th>
              <th className="text-left py-2 px-2">직책</th>
              <th className="text-left py-2 px-2">권한</th>
              <th className="text-left py-2 px-2">상태</th>
              <th className="text-right py-2 px-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">불러오는 중…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">결과 없음</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-b border-border/30 hover:bg-background/30" data-state={bulk.isSelected(u.user_id) ? "selected" : undefined}>
                <td className="py-3 px-2">
                  <Checkbox checked={bulk.isSelected(u.user_id)} onCheckedChange={() => bulk.toggle(u.user_id)} disabled={u.user_id === me?.id} />
                </td>
                <td className="py-3 px-2 font-medium">
                  {u.display_name}
                  {u.user_id === me?.id && (
                    <span className="ml-2 text-[10px] text-primary">(나)</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  {u.phone ? (
                    <span className="text-foreground font-mono text-xs">{u.phone}</span>
                  ) : (
                    <span className="text-destructive text-xs">미등록</span>
                  )}
                </td>
                <td className="py-3 px-2 text-muted-foreground">
                  {[u.store, u.team].filter(Boolean).join(" · ") || "-"}
                </td>
                <td className="py-3 px-2 text-muted-foreground">{u.position || "-"}</td>
                <td className="py-3 px-2">
                  {u.role ? (
                    <Badge variant="outline" className="text-[10px]">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">없음</span>
                  )}
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border ${STATUS_BADGE[u.status] ?? ""}`}>
                    {STATUS_LABELS[u.status] ?? u.status}
                  </span>
                </td>
                <td className="py-3 px-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing({ ...u })}>
                      <Pencil className="size-3.5 mr-1" /> 수정
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => { setResetting(u); setTempPwd(genTempPwd()); }}>
                      <KeyRound className="size-3.5 mr-1" /> 비번
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-primary" onClick={() => issueOverride(u)} title="간편인증 임시 승인 링크 발급">
                      <Smartphone className="size-3.5 mr-1" /> 임시승인
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground">
        💡 <span className="text-foreground">대표/기획팀</span>은 모든 설정 접근,
        <span className="text-foreground"> 팀장</span>은 팀 통계,
        <span className="text-foreground"> 일반직원</span>은 입력 메뉴만 노출됩니다.
      </p>

      {/* 수정 모달 */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>직원 정보 수정</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3 py-2">
              <Field label="성함">
                <Input value={editing.display_name ?? ""} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} />
              </Field>
              <Field label="연락처">
                <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
              <Field label="매장">
                <Input value={editing.store ?? ""} onChange={(e) => setEditing({ ...editing, store: e.target.value })} />
              </Field>
              <Field label="팀">
                <Input value={editing.team ?? ""} onChange={(e) => setEditing({ ...editing, team: e.target.value })} />
              </Field>
              <Field label="직책">
                <Input value={editing.position ?? ""} onChange={(e) => setEditing({ ...editing, position: e.target.value })} />
              </Field>
              <Field label="상태">
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">재직</SelectItem>
                    <SelectItem value="leave">휴직</SelectItem>
                    <SelectItem value="resigned">퇴사 (로그인 차단)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="권한 등급" className="col-span-2">
                <Select
                  value={editing.role ?? "none"}
                  onValueChange={(v) => setEditing({ ...editing, role: v === "none" ? null : (v as AppRole) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]} ({r})</SelectItem>
                    ))}
                    <SelectItem value="none">권한 없음</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={saveProfile}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 비밀번호 초기화 */}
      <AlertDialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>비밀번호 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground font-medium">{resetting?.display_name}</span>님의 비밀번호를 아래 임시 비밀번호로 변경합니다.
              저장 후 직원에게 직접 전달해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-xs">임시 비밀번호</Label>
            <Input
              value={tempPwd}
              onChange={(e) => setTempPwd(e.target.value)}
              className="mt-1 font-mono text-base"
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setTempPwd(genTempPwd())}
            >
              새로 생성
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={resetPassword}>초기화 실행</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 임시 승인 링크 */}
      <Dialog open={!!override} onOpenChange={(o) => !o && setOverride(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>임시 승인 링크 발급</DialogTitle>
          </DialogHeader>
          {override && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{override.user.display_name}</span>님이
                간편인증을 받지 못할 때 이 링크를 직접 전달하세요. 5분간 1회 유효합니다.
              </p>
              <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-[11px] font-mono break-all">
                {override.link}
              </div>
              <Button size="sm" variant="outline" className="w-full" onClick={() => {
                navigator.clipboard.writeText(override.link);
                toast.success("링크 복사됨");
              }}>
                <Copy className="size-3.5 mr-1" /> 복사
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverride(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function genTempPwd() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s + "!";
}

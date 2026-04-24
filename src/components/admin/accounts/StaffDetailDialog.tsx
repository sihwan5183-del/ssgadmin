import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePositions } from "@/hooks/usePositions";
import { useStores } from "@/hooks/useStores";
import { ROLE_LABELS, type AppRole } from "@/hooks/useRole";
import { ShieldCheck, Mail, Power, KeyRound } from "lucide-react";

interface Profile {
  user_id: string;
  display_name: string;
  phone: string | null;
  team: string | null;
  store: string | null;
  position: string | null;
  status: string;
  hire_date: string | null;
}

const ALL_ROLES: AppRole[] = ["admin","ceo","planner","manager","team_lead","staff","user"];

export function StaffDetailDialog({ userId, email, open, onOpenChange, onChanged }: {
  userId: string | null;
  email?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const { positions } = usePositions();
  const { stores } = useStores();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      const { data: p } = await supabase.from("profiles")
        .select("user_id, display_name, phone, team, store, position, status, hire_date")
        .eq("user_id", userId).maybeSingle();
      setProfile(p as Profile | null);
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      setRoles(((r ?? []) as { role: AppRole }[]).map((x) => x.role));
    })();
  }, [open, userId]);

  if (!profile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent><div className="p-4 text-sm text-muted-foreground">불러오는 중…</div></DialogContent>
      </Dialog>
    );
  }

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action, user_id: userId, ...payload },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      return data;
    } finally { setBusy(false); }
  };

  const save = async () => {
    try {
      await call("update_profile", { profile: {
        display_name: profile.display_name,
        phone: profile.phone,
        team: profile.team,
        store: profile.store,
        position: profile.position,
        hire_date: profile.hire_date,
      } });
      toast.success("저장 완료");
      onChanged?.();
    } catch (e) { toast.error("저장 실패", { description: (e as Error).message }); }
  };

  const setStatus = async (status: Profile["status"]) => {
    try {
      await call("set_status", { status });
      setProfile({ ...profile, status });
      toast.success(`상태가 ${status}로 변경되었습니다`);
      onChanged?.();
    } catch (e) { toast.error("실패", { description: (e as Error).message }); }
  };

  const sendReset = async () => {
    if (!email) return toast.error("이메일을 알 수 없습니다");
    try {
      await call("send_password_reset_email", { email, redirect_to: window.location.origin + "/auth" });
      toast.success("재설정 메일을 발송했습니다");
    } catch (e) { toast.error("메일 발송 실패", { description: (e as Error).message }); }
  };

  const toggleRole = async (role: AppRole) => {
    const has = roles.includes(role);
    setBusy(true);
    try {
      if (has) {
        await supabase.from("user_roles").delete().eq("user_id", userId!).eq("role", role);
        setRoles(roles.filter((r) => r !== role));
      } else {
        await supabase.from("user_roles").insert({ user_id: userId!, role });
        setRoles([...roles, role]);
      }
      onChanged?.();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {profile.display_name}
            <Badge variant={profile.status === "active" ? "default" : "secondary"}>{profile.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름">
              <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
            </Field>
            <Field label="연락처">
              <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="010-0000-0000" />
            </Field>
            <Field label="이메일">
              <Input value={email ?? ""} disabled />
            </Field>
            <Field label="입사일">
              <Input type="date" value={profile.hire_date ?? ""} onChange={(e) => setProfile({ ...profile, hire_date: e.target.value || null })} />
            </Field>
            <Field label="소속 매장">
              <Select value={profile.store ?? ""} onValueChange={(v) => setProfile({ ...profile, store: v || null })}>
                <SelectTrigger><SelectValue placeholder="매장 선택" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="팀">
              <Input value={profile.team ?? ""} onChange={(e) => setProfile({ ...profile, team: e.target.value })} placeholder="예: 1팀" />
            </Field>
            <Field label="직급(Grade)">
              <Select value={profile.position ?? ""} onValueChange={(v) => setProfile({ ...profile, position: v || null })}>
                <SelectTrigger><SelectValue placeholder="직급 선택" /></SelectTrigger>
                <SelectContent>
                  {positions.filter((p) => p.active).map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="계정 상태">
              <Select value={profile.status} onValueChange={(v) => setStatus(v as Profile["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">정상</SelectItem>
                  <SelectItem value="pending">승인 대기</SelectItem>
                  <SelectItem value="suspended">정지</SelectItem>
                  <SelectItem value="leave">휴직</SelectItem>
                  <SelectItem value="resigned">퇴사</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="border-t border-border/40 pt-3">
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> 권한 그룹
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => {
                const has = roles.includes(r);
                return (
                  <button
                    key={r}
                    disabled={busy}
                    onClick={() => toggleRole(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      has ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={sendReset} disabled={busy}>
              <Mail className="size-4 mr-1.5" /> 비밀번호 재설정 메일
            </Button>
            <Button
              variant={profile.status === "suspended" ? "default" : "destructive"}
              onClick={() => setStatus(profile.status === "suspended" ? "active" : "suspended")}
              disabled={busy}
            >
              <Power className="size-4 mr-1.5" />
              {profile.status === "suspended" ? "정지 해제" : "계정 정지"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>닫기</Button>
          <Button onClick={save} disabled={busy}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

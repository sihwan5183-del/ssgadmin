import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Building2, ShieldCheck } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/hooks/useRole";

interface Position { id: string; name: string; sort_order: number; active: boolean; }
interface Store { id: string; name: string; code: string | null; region: string | null; active: boolean; }

const ROLE_PERMS: { role: AppRole; perms: string }[] = [
  { role: "admin", perms: "모든 메뉴/시스템 설정/권한 관리" },
  { role: "ceo", perms: "관리자 동등 권한 (대표)" },
  { role: "planner", perms: "판매원장·정산·인센티브 전체 권한" },
  { role: "manager", perms: "판매원장 조회/수정, 통계" },
  { role: "team_lead", perms: "소속 매장 직원 실적·활동 조회" },
  { role: "staff", perms: "본인 실적 입력, 개인 대시보드" },
  { role: "user", perms: "기본 사용자 (제한)" },
];

export default function AccountRolesPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [newPos, setNewPos] = useState("");
  const [newStore, setNewStore] = useState("");

  const refresh = useCallback(async () => {
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("positions").select("*").order("sort_order"),
      supabase.from("stores").select("*").order("name"),
    ]);
    setPositions((p ?? []) as Position[]);
    setStores((s ?? []) as Store[]);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const addPos = async () => {
    if (!newPos.trim()) return;
    const { error } = await supabase.from("positions").insert({ name: newPos.trim(), sort_order: positions.length + 1 });
    if (error) return toast.error("실패", { description: error.message });
    setNewPos(""); refresh();
  };
  const togglePos = async (p: Position) => {
    await supabase.from("positions").update({ active: !p.active }).eq("id", p.id);
    refresh();
  };
  const delPos = async (p: Position) => {
    if (!confirm(`'${p.name}' 직급을 삭제할까요?`)) return;
    await supabase.from("positions").delete().eq("id", p.id);
    refresh();
  };

  const addStore = async () => {
    if (!newStore.trim()) return;
    const { error } = await supabase.from("stores").insert({ name: newStore.trim() });
    if (error) return toast.error("실패", { description: error.message });
    setNewStore(""); refresh();
  };
  const toggleStore = async (s: Store) => {
    await supabase.from("stores").update({ active: !s.active }).eq("id", s.id);
    refresh();
  };
  const delStore = async (s: Store) => {
    if (!confirm(`'${s.name}' 매장을 삭제할까요?`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) return toast.error("실패", { description: error.message });
    refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-semibold">권한 그룹별 접근 정책</h2>
        </div>
        <div className="space-y-1.5">
          {ROLE_PERMS.map((r) => (
            <div key={r.role} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
              <Badge variant="outline" className="font-mono">{ROLE_LABELS[r.role]}</Badge>
              <span className="text-muted-foreground text-xs text-right ml-3">{r.perms}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          ※ 직원별 권한 추가/제거는 [전체 직원 관리] → 상세 → 권한 그룹에서 토글합니다.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-semibold">직급(Grade) 마스터</h2>
        </div>
        <div className="flex gap-2 mb-3">
          <Input value={newPos} onChange={(e) => setNewPos(e.target.value)} placeholder="새 직급 (예: 매니저)" />
          <Button onClick={addPos}><Plus className="size-4" /></Button>
        </div>
        <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
          {positions.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
              <span className="flex-1 font-medium">{p.name}</span>
              <Switch checked={p.active} onCheckedChange={() => togglePos(p)} />
              <Button size="icon" variant="ghost" onClick={() => delPos(p)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="size-4 text-primary" />
          <h2 className="font-semibold">매장 마스터</h2>
        </div>
        <div className="flex gap-2 mb-3">
          <Input value={newStore} onChange={(e) => setNewStore(e.target.value)} placeholder="새 매장 (예: 강남1호점)" />
          <Button onClick={addStore}><Plus className="size-4" /></Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto">
          {stores.map((s) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
              <span className="flex-1 font-medium truncate">{s.name}</span>
              <Switch checked={s.active} onCheckedChange={() => toggleStore(s)} />
              <Button size="icon" variant="ghost" onClick={() => delStore(s)}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

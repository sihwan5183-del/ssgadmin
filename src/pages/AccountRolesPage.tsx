import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Building2, ShieldCheck, Settings } from "lucide-react";
import { ASSIGNABLE_ROLES } from "@/hooks/useRole";
import { PositionPermissionDialog } from "@/components/admin/accounts/PositionPermissionDialog";
import { usePositionPermissionsAll, type PositionRow } from "@/hooks/usePositionPermissions";

interface Store { id: string; name: string; code: string | null; region: string | null; active: boolean; }

const SCOPE_LABEL: Record<string, string> = { self: "본인", store: "매장", all: "전체" };

export default function AccountRolesPage() {
  const { positions, matrix, loading, refresh } = usePositionPermissionsAll();
  const [stores, setStores] = useState<Store[]>([]);
  const [newPos, setNewPos] = useState("");
  const [newStore, setNewStore] = useState("");
  const [editPos, setEditPos] = useState<PositionRow | null>(null);

  const refreshStores = useCallback(async () => {
    const { data } = await supabase.from("stores").select("*").order("name");
    setStores((data ?? []) as Store[]);
  }, []);
  useEffect(() => { refreshStores(); }, [refreshStores]);

  const addPos = async () => {
    if (!newPos.trim()) return;
    const { error } = await supabase.from("positions").insert({ name: newPos.trim(), sort_order: positions.length + 1 });
    if (error) return toast.error("실패", { description: error.message });
    setNewPos(""); refresh();
  };
  const togglePos = async (p: PositionRow) => {
    await supabase.from("positions").update({ active: !p.active }).eq("id", p.id);
    refresh();
  };
  const delPos = async (p: PositionRow) => {
    if (!confirm(`'${p.name}' 직급을 삭제할까요?`)) return;
    await supabase.from("positions").delete().eq("id", p.id);
    refresh();
  };

  const addStore = async () => {
    if (!newStore.trim()) return;
    const { error } = await supabase.from("stores").insert({ name: newStore.trim() });
    if (error) return toast.error("실패", { description: error.message });
    setNewStore(""); refreshStores();
  };
  const toggleStore = async (s: Store) => {
    await supabase.from("stores").update({ active: !s.active }).eq("id", s.id);
    refreshStores();
  };
  const delStore = async (s: Store) => {
    if (!confirm(`'${s.name}' 매장을 삭제할까요?`)) return;
    const { error } = await supabase.from("stores").delete().eq("id", s.id);
    if (error) return toast.error("실패", { description: error.message });
    refreshStores();
  };

  // 활성 직급별 권한 카운트 (요약 표시)
  const countAccess = (positionId: string) => {
    let read = 0, write = 0;
    Object.entries(matrix).forEach(([k, v]) => {
      if (!k.startsWith(`${positionId}::`)) return;
      if (v === "read") read++;
      else if (v === "write") write++;
    });
    return { read, write };
  };

  const activePositions = positions.filter((p) => p.active);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 좌: 권한 그룹별 접근 정책 (직급 마스터와 실시간 동기화) */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-semibold">권한 그룹별 접근 정책</h2>
          <Badge variant="outline" className="ml-auto text-[10px]">직급 마스터와 실시간 동기화</Badge>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">불러오는 중…</div>
        ) : activePositions.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 text-center bg-muted/30 rounded-lg">
            우측 [직급 마스터]에서 직급을 먼저 추가해주세요.
          </div>
        ) : (
          <div className="space-y-1.5">
            {activePositions.map((p) => {
              const c = countAccess(p.id);
              const baseLabel = ASSIGNABLE_ROLES.find((r) => r.value === p.base_role)?.label ?? "사원";
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-sm">
                  <Badge variant="outline" className="font-medium">{p.name}</Badge>
                  <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>기본 {baseLabel}</span>
                    <span>·</span>
                    <span>범위 {SCOPE_LABEL[p.data_scope] ?? p.data_scope}</span>
                    <span>·</span>
                    <span className="text-blue-600">읽기 {c.read}</span>
                    <span className="text-emerald-600">수정 {c.write}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditPos(p)}>
                    <Settings className="size-3.5 mr-1" /> 설정
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          ※ 변경은 [일괄 저장] 시 즉시 모든 해당 직급 사용자에게 반영됩니다.
        </p>
      </Card>

      {/* 우: 직급 마스터 */}
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

      {editPos && (
        <PositionPermissionDialog
          open={!!editPos}
          onOpenChange={(v) => { if (!v) setEditPos(null); }}
          position={editPos}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Building2, ShieldCheck, Lock } from "lucide-react";
import { usePositions } from "@/hooks/usePositions";

interface Store { id: string; name: string; code: string | null; region: string | null; active: boolean; }

export default function AccountRolesPage() {
  const { positions, refresh } = usePositions();
  const [stores, setStores] = useState<Store[]>([]);
  const [newPos, setNewPos] = useState("");
  const [newStore, setNewStore] = useState("");

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
  const togglePos = async (p: { id: string; active: boolean }) => {
    await supabase.from("positions").update({ active: !p.active }).eq("id", p.id);
    refresh();
  };
  const delPos = async (p: { id: string; name: string }) => {
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* 좌: 권한 정책 안내 (단순화) */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-primary" />
          <h2 className="font-semibold">권한 정책 (단순화)</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
            <Lock className="size-4 text-primary mt-0.5" />
            <div>
              <div className="font-medium">관리자 전용 메뉴</div>
              <div className="text-xs text-muted-foreground mt-1">
                사이드바의 [관리자] 표시 메뉴는 <b>대표 / 관리자</b> 권한만 접근·수정할 수 있습니다.
                일반 사원·팀장은 메뉴에서 숨김 처리되며, URL 직접 접속 시도 시 대시보드로 자동 이동됩니다.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40">
            <ShieldCheck className="size-4 text-primary mt-0.5" />
            <div>
              <div className="font-medium">일반 영업 메뉴</div>
              <div className="text-xs text-muted-foreground mt-1">
                판매실적장표·인입 관리·실적 입력 등 일반 영업 메뉴는 <b>사원·팀장·관리자 모두 동일 권한</b>으로
                자유롭게 입력·조회·수정할 수 있습니다.
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ※ 별도의 읽기/수정 세부 토글 없이 시스템이 [대표/관리자] 여부만 판단합니다.
          </p>
        </div>
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
    </div>
  );
}

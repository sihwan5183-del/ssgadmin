import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { AccessLevel, PositionRow } from "@/hooks/usePositionPermissions";
import { ASSIGNABLE_ROLES } from "@/hooks/useRole";

interface PermItem { permission_key: string; label: string; category: string; sort_order: number }

const LEVELS: { value: AccessLevel; label: string; tone: string }[] = [
  { value: "none",  label: "접근 불가", tone: "text-muted-foreground" },
  { value: "read",  label: "읽기 전용", tone: "text-blue-600" },
  { value: "write", label: "수정 가능", tone: "text-emerald-600" },
];

const SCOPES: { value: "self" | "store" | "all"; label: string }[] = [
  { value: "self",  label: "본인 데이터만" },
  { value: "store", label: "소속 매장 데이터만" },
  { value: "all",   label: "전체 매장 데이터" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  position: PositionRow;
  onSaved?: () => void;
}

export function PositionPermissionDialog({ open, onOpenChange, position, onSaved }: Props) {
  const [items, setItems] = useState<PermItem[]>([]);
  const [matrix, setMatrix] = useState<Record<string, AccessLevel>>({});
  const [baseRole, setBaseRole] = useState(position.base_role);
  const [scope, setScope] = useState(position.data_scope);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setBaseRole(position.base_role);
    setScope(position.data_scope);
    const [{ data: cat }, { data: rows }] = await Promise.all([
      supabase.from("permission_catalog").select("*").order("sort_order"),
      supabase.from("position_permissions").select("permission_key, access_level").eq("position_id", position.id),
    ]);
    setItems((cat ?? []) as PermItem[]);
    const m: Record<string, AccessLevel> = {};
    for (const r of (rows ?? []) as { permission_key: string; access_level: AccessLevel }[]) {
      m[r.permission_key] = r.access_level;
    }
    setMatrix(m);
    setLoading(false);
  }, [position.id, position.base_role, position.data_scope]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const setLevel = (key: string, lvl: AccessLevel) => {
    setMatrix((prev) => ({ ...prev, [key]: lvl }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // 1) position 업데이트 (base_role + data_scope)
      const { error: pErr } = await supabase
        .from("positions")
        .update({ base_role: baseRole, data_scope: scope })
        .eq("id", position.id);
      if (pErr) throw pErr;

      // 2) 권한 매트릭스 upsert
      const payload = items.map((it) => ({
        position_id: position.id,
        permission_key: it.permission_key,
        access_level: matrix[it.permission_key] ?? "none",
      }));
      if (payload.length > 0) {
        const { error: mErr } = await supabase
          .from("position_permissions")
          .upsert(payload, { onConflict: "position_id,permission_key" });
        if (mErr) throw mErr;
      }
      toast.success("권한이 저장되었습니다");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("저장 실패", { description: (e as Error).message });
    } finally { setSaving(false); }
  };

  // category grouping
  const grouped = items.reduce<Record<string, PermItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it); return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>직급 권한 설정</span>
            <Badge variant="secondary">{position.name}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">불러오는 중…</div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="grid sm:grid-cols-2 gap-4 p-3 rounded-lg bg-muted/40">
              <div>
                <Label className="text-xs">기본 시스템 권한</Label>
                <Select value={baseRole} onValueChange={(v) => setBaseRole(v as typeof baseRole)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label} — {r.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">데이터 노출 범위</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCOPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {Object.entries(grouped).map(([cat, list]) => (
              <div key={cat}>
                <div className="text-xs font-semibold text-muted-foreground mb-2">{cat}</div>
                <div className="space-y-1">
                  {list.map((it) => {
                    const cur = matrix[it.permission_key] ?? "none";
                    return (
                      <div key={it.permission_key} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                        <span className="font-medium">{it.label}</span>
                        <div className="flex gap-1">
                          {LEVELS.map((lvl) => (
                            <button
                              key={lvl.value}
                              type="button"
                              onClick={() => setLevel(it.permission_key, lvl.value)}
                              className={`px-2 py-1 rounded text-xs border transition ${cur === lvl.value ? "bg-primary text-primary-foreground border-primary" : `bg-background ${lvl.tone} border-border hover:bg-muted`}`}
                            >
                              {lvl.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={save} disabled={saving || loading}>{saving ? "저장 중…" : "일괄 저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

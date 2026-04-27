import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type AppRole } from "@/hooks/useRole";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface PermItem { permission_key: string; label: string; category: string; sort_order: number }
interface RolePerm { role: AppRole; permission_key: string; allowed: boolean }

const ROLES: AppRole[] = ["admin", "ceo", "planner", "manager", "team_lead", "staff", "user"];
// admin/ceo 는 항상 모든 권한 ON 으로 취급 (UI 비활성)
const FORCED_ALL = (role: AppRole) => role === "admin" || role === "ceo";

export function RolePermissionsMatrix() {
  const [items, setItems] = useState<PermItem[]>([]);
  const [matrix, setMatrix] = useState<Record<string, boolean>>({}); // key: `${role}::${permission_key}`
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: cat }, { data: rps }] = await Promise.all([
      supabase.from("permission_catalog").select("*").order("sort_order"),
      supabase.from("role_permissions").select("role, permission_key, allowed"),
    ]);
    setItems((cat ?? []) as PermItem[]);
    const m: Record<string, boolean> = {};
    for (const r of (rps ?? []) as RolePerm[]) {
      m[`${r.role}::${r.permission_key}`] = r.allowed;
    }
    setMatrix(m);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const toggle = async (role: AppRole, key: string, next: boolean) => {
    if (FORCED_ALL(role)) return;
    const k = `${role}::${key}`;
    setMatrix((prev) => ({ ...prev, [k]: next }));
    const { error } = await supabase.from("role_permissions").upsert(
      { role, permission_key: key, allowed: next, updated_at: new Date().toISOString() },
      { onConflict: "role,permission_key" },
    );
    if (error) {
      toast.error("저장 실패", { description: error.message });
      setMatrix((prev) => ({ ...prev, [k]: !next }));
    }
  };

  // 카테고리별 그룹핑
  const grouped = items.reduce<Record<string, PermItem[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});

  return (
    <Card className="p-4 lg:col-span-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="size-4 text-primary" />
        <h2 className="font-semibold">권한 그룹별 세부 항목 설정 (RBAC)</h2>
        <Badge variant="outline" className="ml-2 text-[10px]">관리자/대표는 항상 전체 허용</Badge>
      </div>
      {loading ? (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="text-xs font-semibold text-muted-foreground mb-2">{cat}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border/40 text-xs text-muted-foreground">
                      <th className="text-left px-2 py-1.5 sticky left-0 bg-background min-w-[180px]">항목</th>
                      {ROLES.map((r) => (
                        <th key={r} className="text-center px-2 py-1.5 whitespace-nowrap">{ROLE_LABELS[r]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it) => (
                      <tr key={it.permission_key} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-medium sticky left-0 bg-background">{it.label}</td>
                        {ROLES.map((r) => {
                          const forced = FORCED_ALL(r);
                          const checked = forced ? true : (matrix[`${r}::${it.permission_key}`] ?? false);
                          return (
                            <td key={r} className="text-center px-2 py-1.5">
                              <Checkbox
                                checked={checked}
                                disabled={forced}
                                onCheckedChange={(v) => toggle(r, it.permission_key, !!v)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground mt-3">
        ※ 체크된 항목만 해당 권한 그룹이 접근/사용할 수 있습니다. 변경은 즉시 저장됩니다.
      </p>
    </Card>
  );
}
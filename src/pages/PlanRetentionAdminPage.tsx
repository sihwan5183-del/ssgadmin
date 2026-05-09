import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Lock, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Rule {
  id: string;
  sale_type: string;
  retention_days: number;
  note: string | null;
  active: boolean;
  sort_order: number;
}

export default function PlanRetentionAdminPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState("");
  const [newDays, setNewDays] = useState<number>(183);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plan_retention_rules")
      .select("*")
      .order("sort_order");
    if (error) toast.error("불러오기 실패: " + error.message);
    setRules((data ?? []) as Rule[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("plan-retention-rules")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_retention_rules" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (roleLoading) {
    return <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>;
  }

  if (!isAdmin) {
    return (
      <div>
        <Header
          title="요금제 유지 조건 설정"
          subtitle="관리자만 접근할 수 있습니다"
          showScopeToggle={false}
          showPeriodFilter={false}
        />
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">접근 권한이 없습니다</h3>
          <p className="text-sm text-muted-foreground">
            이 페이지는 관리자/대표 계정에서만 변경할 수 있습니다.
          </p>
        </Card>
      </div>
    );
  }

  const updateRule = (id: string, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRule = async (rule: Rule) => {
    const { error } = await supabase
      .from("plan_retention_rules")
      .update({
        retention_days: rule.retention_days,
        note: rule.note,
        active: rule.active,
        sort_order: rule.sort_order,
      })
      .eq("id", rule.id);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success(`'${rule.sale_type}' 유지 일수가 저장되었습니다 (${rule.retention_days}일)`);
  };

  const deleteRule = async (id: string) => {
    if (!confirm("이 조건을 삭제하시겠어요?")) return;
    const { error } = await supabase.from("plan_retention_rules").delete().eq("id", id);
    if (error) toast.error("삭제 실패: " + error.message);
    else toast.success("삭제되었습니다");
  };

  const addRule = async () => {
    if (!newType.trim()) {
      toast.error("조건명을 입력해주세요");
      return;
    }
    const { error } = await supabase.from("plan_retention_rules").insert({
      sale_type: newType.trim(),
      retention_days: Number(newDays) || 0,
      sort_order: (rules[rules.length - 1]?.sort_order ?? 0) + 1,
    });
    if (error) {
      toast.error("추가 실패: " + error.message);
      return;
    }
    setNewType("");
    setNewDays(183);
    toast.success("조건이 추가되었습니다");
  };

  return (
    <div>
      <Header
        title="요금제 유지 조건 설정"
        subtitle="가입 조건별 요금제 유지 일수를 설정합니다. 조건명은 실적 입력의 약정 정보와 정확히 일치해야 합니다 (선택약정 / 선택약정+유통망지원금 / 이통사지원금(공시) / 이통사지원금+유통망지원금)."
        showScopeToggle={false}
        showPeriodFilter={false}
      />

      <Card className="p-5 glass mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">새 조건 추가</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">조건명 (약정 정보와 정확히 일치)</Label>
            <Input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="예: 선택약정"
              className="h-10 mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">유지 일수 (D+N)</Label>
            <Input
              type="number"
              min={0}
              value={newDays}
              onChange={(e) => setNewDays(Number(e.target.value))}
              className="h-10 mt-1"
            />
          </div>
          <Button onClick={addRule} className="gap-1.5 h-10">
            <Plus className="size-4" /> 추가
          </Button>
        </div>
      </Card>

      <Card className="p-0 glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border/50 bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3">조건명 (sale_type)</th>
                <th className="text-left px-3 py-3 w-32">유지 일수</th>
                <th className="text-left px-3 py-3">메모</th>
                <th className="text-center px-3 py-3 w-24">사용</th>
                <th className="text-right px-3 py-3 w-44">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    불러오는 중...
                  </td>
                </tr>
              )}
              {!loading && rules.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    등록된 조건이 없습니다
                  </td>
                </tr>
              )}
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {r.sale_type}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        value={r.retention_days}
                        onChange={(e) =>
                          updateRule(r.id, { retention_days: Number(e.target.value) })
                        }
                        className="h-9 w-20"
                      />
                      <span className="text-xs text-muted-foreground">일</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      value={r.note ?? ""}
                      onChange={(e) => updateRule(r.id, { note: e.target.value })}
                      placeholder="예: 기본 6개월"
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Switch
                      checked={r.active}
                      onCheckedChange={(v) => updateRule(r.id, { active: v })}
                    />
                  </td>
                  <td className="px-3 py-3 text-right space-x-1">
                    <Button size="sm" onClick={() => saveRule(r)} className="gap-1">
                      <Save className="size-3.5" /> 저장
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteRule(r.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground mt-3">
        💡 조건명을 변경/추가한 직후, 새로 등록되는 실적부터 자동 계산됩니다. 기존 데이터는 다음 저장 시 갱신됩니다.
      </p>
    </div>
  );
}
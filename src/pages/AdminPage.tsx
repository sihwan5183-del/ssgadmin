import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layout,
  Target,
  ListChecks,
  ShieldCheck,
  Trash2,
  Lock,
  Database,
  Calculator,
  Smartphone,
  History,
  Coins,
  Sparkles,
} from "lucide-react";
import { DynamicFieldsManager } from "@/components/admin/DynamicFieldsManager";
import { FormulaEditor } from "@/components/admin/FormulaEditor";
import { DeviceModelsManager } from "@/components/admin/DeviceModelsManager";
import { SystemAuditLog } from "@/components/admin/SystemAuditLog";
import { IncentiveRatesManager } from "@/components/admin/IncentiveRatesManager";
import { ReviewChecklistManager } from "@/components/admin/ReviewChecklistManager";
import { StrategyConfigManager } from "@/components/admin/StrategyConfigManager";
import { UserManagementPanel } from "@/components/admin/UserManagementPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole, type AppRole } from "@/hooks/useRole";
import { Users } from "lucide-react";
import { useAppSettings, type DashboardWidgets } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const WIDGET_LABELS: Record<keyof DashboardWidgets, string> = {
  stat_cards: "상단 KPI 카드",
  performance_chart: "일별 실적 추이 차트",
  channel_donut: "인입 경로별 도넛",
  mobile_breakdown: "모바일 상세 분석",
  strategy_gauges: "전략상품 게이지",
  channel_matrix: "인입경로 매트릭스",
  ranking_panel: "랭킹 패널",
  recent_activities: "최근 활동",
};

interface UserRow {
  user_id: string;
  display_name: string;
  role: AppRole | null;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { widgets, strategyTarget, monthlyTarget, upsert, refresh } = useAppSettings();

  const [localWidgets, setLocalWidgets] = useState<DashboardWidgets>(widgets);
  const [localStrategy, setLocalStrategy] = useState<number>(strategyTarget);
  const [localMonthly, setLocalMonthly] = useState<number>(monthlyTarget);
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => setLocalWidgets(widgets), [JSON.stringify(widgets)]);
  useEffect(() => setLocalStrategy(strategyTarget), [strategyTarget]);
  useEffect(() => setLocalMonthly(monthlyTarget), [monthlyTarget]);

  const fetchUsers = async () => {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, AppRole>();
    (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
    setUsers(
      (profiles ?? []).map((p: any) => ({
        user_id: p.user_id,
        display_name: p.display_name,
        role: roleMap.get(p.user_id) ?? null,
      }))
    );
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  if (roleLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground">권한 확인 중...</div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <Header title="시스템 설정" subtitle="관리자만 접근 가능합니다" showScopeToggle={false} />
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">접근 권한이 없습니다</h3>
          <p className="text-sm text-muted-foreground">
            이 페이지는 관리자 계정으로만 열람할 수 있어요. 관리자에게 권한 부여를 요청해주세요.
          </p>
        </Card>
      </div>
    );
  }

  const saveWidgets = async () => {
    const { error } = await upsert("dashboard.widgets", localWidgets);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success("위젯 설정이 저장되었습니다");
  };

  const saveTargets = async () => {
    const r1 = await upsert("targets.strategy_product_share", localStrategy);
    const r2 = await upsert("targets.monthly_activations", localMonthly);
    if (r1.error || r2.error) toast.error("일부 항목 저장 실패");
    else toast.success("목표치가 저장되었습니다");
  };

  const setUserRole = async (userId: string, role: AppRole | "none") => {
    if (role === "none") {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    } else {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
    toast.success("권한이 업데이트되었습니다");
    fetchUsers();
  };

  return (
    <div>
      <Header
        title="시스템 설정"
        subtitle="관리자 전용 · 마스터 데이터, 위젯, 목표치, 권한을 한 곳에서 관리합니다"
        showScopeToggle={false}
      />

      <Tabs defaultValue="widgets" className="space-y-5">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="widgets" className="gap-2">
            <Layout className="size-4" /> 대시보드 위젯
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-2">
            <Target className="size-4" /> 목표치
          </TabsTrigger>
          <TabsTrigger value="fields" className="gap-2">
            <Database className="size-4" /> 동적 필드
          </TabsTrigger>
          <TabsTrigger value="formula" className="gap-2">
            <Calculator className="size-4" /> 수익 수식
          </TabsTrigger>
          <TabsTrigger value="master" className="gap-2">
            <ListChecks className="size-4" /> 마스터 데이터
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Smartphone className="size-4" /> 모델 마스터
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="size-4" /> 직원 관리
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <ShieldCheck className="size-4" /> 권한 빠른 변경
          </TabsTrigger>
          <TabsTrigger value="incentive" className="gap-2">
            <Coins className="size-4" /> 인센티브 단가
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2">
            <ListChecks className="size-4" /> 검수 체크리스트
          </TabsTrigger>
          <TabsTrigger value="strategy" className="gap-2">
            <Sparkles className="size-4" /> 전략 / 임계값
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <History className="size-4" /> 시스템 로그
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <UserManagementPanel />
        </TabsContent>

        <TabsContent value="strategy">
          <StrategyConfigManager />
        </TabsContent>

        <TabsContent value="checklist">
          <ReviewChecklistManager />
        </TabsContent>

        <TabsContent value="incentive">
          <IncentiveRatesManager />
        </TabsContent>

        <TabsContent value="fields">
          <DynamicFieldsManager />
        </TabsContent>

        <TabsContent value="formula">
          <FormulaEditor />
        </TabsContent>

        <TabsContent value="models">
          <DeviceModelsManager />
        </TabsContent>

        <TabsContent value="audit">
          <SystemAuditLog />
        </TabsContent>

        {/* === 위젯 토글 === */}
        <TabsContent value="widgets">
          <Card className="p-6 glass">
            <h3 className="font-semibold mb-4">대시보드에 표시할 위젯 선택</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(WIDGET_LABELS) as Array<keyof DashboardWidgets>).map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40"
                >
                  <div>
                    <div className="font-medium text-sm">{WIDGET_LABELS[k]}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{k}</div>
                  </div>
                  <Switch
                    checked={localWidgets[k]}
                    onCheckedChange={(v) => setLocalWidgets({ ...localWidgets, [k]: v })}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={saveWidgets}>위젯 설정 저장</Button>
            </div>
          </Card>
        </TabsContent>

        {/* === 목표치 === */}
        <TabsContent value="targets">
          <Card className="p-6 glass space-y-5">
            <h3 className="font-semibold">대시보드 목표치 (KPI)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">전략상품 비중 목표 (%)</Label>
                <Input
                  type="number"
                  value={localStrategy}
                  onChange={(e) => setLocalStrategy(Number(e.target.value))}
                  className="h-11 mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  전략상품 게이지의 목표 라인에 반영됩니다
                </p>
              </div>
              <div>
                <Label className="text-xs">월별 신규 개통 목표 (건)</Label>
                <Input
                  type="number"
                  value={localMonthly}
                  onChange={(e) => setLocalMonthly(Number(e.target.value))}
                  className="h-11 mt-1"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  실적 추이 차트의 가이드 라인에 사용됩니다
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveTargets}>목표치 저장</Button>
            </div>
          </Card>
        </TabsContent>

        {/* === 마스터 데이터 === */}
        <TabsContent value="master">
          <Card className="p-6 glass">
            <h3 className="font-semibold mb-2">마스터 데이터 관리</h3>
            <p className="text-sm text-muted-foreground mb-4">
              인입 경로, 모델, 요금제, 팀, 점, 지출 항목 등 드롭다운에 노출되는 모든 항목은
              <span className="text-foreground font-medium"> 입력 항목 관리</span> 페이지에서 추가/숨김/삭제할 수 있습니다.
              관리자 권한이 있어야 변경이 저장됩니다.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                "channel",
                "product",
                "rate_plan",
                "device_model",
                "team",
                "store",
                "expense_type",
                "media",
                "sale_type",
              ].map((f) => (
                <Badge key={f} variant="outline" className="text-xs">
                  {f}
                </Badge>
              ))}
            </div>
            <Button asChild variant="default">
              <Link to="/field-options">입력 항목 관리로 이동 →</Link>
            </Button>
          </Card>
        </TabsContent>

        {/* === 사용자 권한 === */}
        <TabsContent value="users">
          <Card className="p-6 glass">
            <h3 className="font-semibold mb-4">사용자 권한</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border/50">
                  <tr>
                    <th className="text-left py-2">이름</th>
                    <th className="text-left py-2">user_id</th>
                    <th className="text-left py-2">현재 권한</th>
                    <th className="text-right py-2">변경</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-border/30">
                      <td className="py-3 font-medium">
                        {u.display_name}
                        {u.user_id === user?.id && (
                          <span className="ml-2 text-[10px] text-primary">(나)</span>
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground font-mono text-xs">
                        {u.user_id.slice(0, 8)}…
                      </td>
                      <td className="py-3">
                        {u.role ? (
                          <Badge
                            variant="outline"
                            className={
                              u.role === "admin"
                                ? "border-primary/40 text-primary"
                                : ""
                            }
                          >
                            {u.role}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">권한 없음</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Select
                          value={u.role ?? "none"}
                          onValueChange={(v) => setUserRole(u.user_id, v as any)}
                        >
                          <SelectTrigger className="h-9 w-32 ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="manager">manager</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                            <SelectItem value="none">권한 없음</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              💡 admin은 모든 설정을, manager는 향후 확장 권한을, user는 기본 입력만 가능합니다.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

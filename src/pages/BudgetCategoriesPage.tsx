import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Wallet, TrendingUp, BarChart3, Eye, EyeOff } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/AuthContext";
import { useBudgetCategories, type BudgetCategory } from "@/hooks/useBudgetCategories";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Lock } from "lucide-react";

const empty = { category_type: "지출" as "지출" | "수익", label: "", sort_order: 0 };

export default function BudgetCategoriesPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const { user } = useAuth();
  const { categories, loading, reload, toggleDashboardIncluded } = useBudgetCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [form, setForm] = useState(empty);

  if (roleLoading) return <div className="p-10 text-center text-muted-foreground">권한 확인 중…</div>;
  if (!isAdmin) {
    return (
      <div>
        <Header title="항목 관리" subtitle="지출/수익 카테고리의 대시보드 합산 여부를 관리합니다" showScopeToggle={false} />
        <Card className="p-10 glass text-center max-w-lg mx-auto">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold text-lg mb-1">관리자 전용</h3>
          <p className="text-sm text-muted-foreground">항목 관리는 관리자만 편집할 수 있습니다.</p>
        </Card>
      </div>
    );
  }

  const expenseItems = categories.filter((c) => c.category_type === "지출");
  const revenueItems = categories.filter((c) => c.category_type === "수익");
  const excludedCount = categories.filter((c) => !c.dashboard_included).length;

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: BudgetCategory) => {
    setEditing(c);
    setForm({ category_type: c.category_type, label: c.label, sort_order: c.sort_order });
    setOpen(true);
  };

  const save = async () => {
    if (!form.label.trim()) return toast.error("항목명을 입력하세요");
    const payload = {
      category_type: form.category_type,
      label: form.label.trim(),
      sort_order: Number(form.sort_order) || 0,
      created_by: user?.id,
    } as any;
    if (editing) {
      const { error } = await supabase.from("budget_categories").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase.from("budget_categories").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("등록되었습니다");
    }
    setOpen(false);
    reload();
  };

  const remove = async (c: BudgetCategory) => {
    if (!confirm(`'${c.label}' 항목을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("budget_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    reload();
  };

  const handleToggle = async (c: BudgetCategory) => {
    const err = await toggleDashboardIncluded(c.id, c.dashboard_included);
    if (err) toast.error(err.message);
    else toast.success(`${c.label}: 대시보드 ${c.dashboard_included ? "제외" : "포함"}`);
  };

  const CategoryTable = ({ items, type }: { items: BudgetCategory[]; type: string }) => (
    <Card className="p-5 glass">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {type === "지출" ? (
            <Wallet className="size-4 text-destructive" />
          ) : (
            <TrendingUp className="size-4 text-success" />
          )}
          <h3 className="font-semibold text-sm">{type} 항목</h3>
          <Badge variant="outline" className="text-[10px]">{items.length}개</Badge>
        </div>
      </div>
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">항목명</th>
              <th className="text-left px-3 py-2">매핑 필드</th>
              <th className="text-center px-3 py-2">대시보드 합산</th>
              <th className="text-center px-3 py-2">기본가 포함</th>
              <th className="text-center px-3 py-2">순서</th>
              <th className="text-right px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">불러오는 중…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">등록된 항목이 없습니다</td></tr>
            ) : (
              items.map((c) => (
                <tr key={c.id} className="border-t border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.label}</span>
                      {c.field_mapping && (
                        <Badge variant="secondary" className="text-[9px]">
                          {c.field_mapping}
                        </Badge>
                      )}
                      {!c.dashboard_included && (
                        <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive">
                          <EyeOff className="size-2.5 mr-0.5" /> 제외
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate" title={c.description ?? ""}>
                    {c.description ?? "-"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch
                      checked={c.dashboard_included}
                      onCheckedChange={() => handleToggle(c)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Switch
                      checked={c.is_included_in_base}
                      onCheckedChange={async () => {
                        const { error } = await supabase
                          .from("budget_categories")
                          .update({ is_included_in_base: !c.is_included_in_base } as any)
                          .eq("id", c.id);
                        if (error) toast.error(error.message);
                        else { toast.success(`${c.label}: ${c.is_included_in_base ? "별도 항목" : "기본가 포함"}`); reload(); }
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground text-xs">
                    {c.sort_order}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div>
      <Header title="항목 관리" subtitle="지출/수익 카테고리의 대시보드 합산 여부를 관리합니다" showScopeToggle={false} />

      {excludedCount > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm">
          <EyeOff className="size-4 text-destructive shrink-0" />
          <span className="text-muted-foreground">
            현재 대시보드 합산 제외 항목:{" "}
            <span className="font-semibold text-foreground">
              {categories.filter((c) => !c.dashboard_included).map((c) => c.label).join(", ")}
            </span>
          </span>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-1.5" /> 항목 추가
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryTable items={expenseItems} type="지출" />
        <CategoryTable items={revenueItems} type="수익" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "항목 수정" : "항목 추가"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">유형</Label>
              <Select
                value={form.category_type}
                onValueChange={(v) => setForm({ ...form, category_type: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="지출">지출</SelectItem>
                  <SelectItem value="수익">수익</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">항목명</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="예: 광고비, 임대료, 리베이트 등"
              />
            </div>
            <div>
              <Label className="text-xs">정렬 순서</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={save}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
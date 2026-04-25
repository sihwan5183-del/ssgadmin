import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Tv, Home, Package } from "lucide-react";
import { SortableList, SortableItem } from "@/components/common/SortableList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";

interface EquipmentRow {
  id: string;
  equipment_name: string;
  category: string;
  carrier: string | null;
  model_code: string | null;
  monthly_rental: number;
  sort_order: number;
  active: boolean;
  note: string | null;
}

const CATEGORY_OPTIONS = [
  { value: "settop", label: "TV 셋톱박스", icon: Tv },
  { value: "smarthome", label: "스마트홈 장비", icon: Home },
  { value: "etc", label: "기타 장비", icon: Package },
];

export default function EquipmentCatalogPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();

  const [rows, setRows] = useState<EquipmentRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("settop");
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    equipment_name: "",
    carrier: "",
    model_code: "",
    monthly_rental: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("equipment_catalog" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setRows(((data ?? []) as unknown) as EquipmentRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => rows.filter((r) => r.category === activeCategory),
    [rows, activeCategory],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.active) c[r.category] = (c[r.category] ?? 0) + 1;
    });
    return c;
  }, [rows]);

  const add = async () => {
    const name = form.equipment_name.trim();
    if (!name || !user) {
      toast.error("장비명을 입력하세요");
      return;
    }
    if (filtered.some((r) => r.equipment_name === name)) {
      toast.error("이미 동일한 장비명이 존재합니다");
      return;
    }
    const maxOrder = filtered.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("equipment_catalog" as any).insert({
      equipment_name: name,
      category: activeCategory,
      carrier: form.carrier.trim() || null,
      model_code: form.model_code.trim() || null,
      monthly_rental: Number(form.monthly_rental) || 0,
      sort_order: maxOrder + 1,
      created_by: user.id,
    } as any);
    if (error) toast.error("저장 실패: " + error.message);
    else {
      toast.success("장비가 등록되었습니다");
      setForm({ equipment_name: "", carrier: "", model_code: "", monthly_rental: "" });
      load();
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`'${name}' 장비를 삭제할까요?\n과거 입력된 실적 데이터는 그대로 보존됩니다.`)) return;
    const { error } = await supabase.from("equipment_catalog" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("삭제되었습니다");
      load();
    }
  };

  const toggle = async (r: EquipmentRow) => {
    const { error } = await supabase
      .from("equipment_catalog" as any)
      .update({ active: !r.active } as any)
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else load();
  };

  const updateField = async (id: string, patch: Partial<EquipmentRow>) => {
    const { error } = await supabase
      .from("equipment_catalog" as any)
      .update(patch as any)
      .eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const reorder = async (newItems: EquipmentRow[]) => {
    const reindexed = newItems.map((r, i) => ({ ...r, sort_order: i + 1 }));
    setRows((prev) => {
      const others = prev.filter((p) => p.category !== activeCategory);
      return [...others, ...reindexed];
    });
    const updates = await Promise.all(
      reindexed.map((r) =>
        supabase
          .from("equipment_catalog" as any)
          .update({ sort_order: r.sort_order } as any)
          .eq("id", r.id),
      ),
    );
    if (updates.some((u) => u.error)) {
      toast.error("순서 저장 실패");
      load();
    } else {
      toast.success("순서가 저장되었습니다");
    }
  };

  if (roleLoading) {
    return <div className="p-8 text-muted-foreground">권한 확인 중...</div>;
  }

  if (!isAdmin) {
    return (
      <div>
        <Header
          title="접근 권한 없음"
          subtitle="관리자만 접근할 수 있습니다"
          showScopeToggle={false}
        />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="장비 / 셋톱박스 관리"
        subtitle="TV 셋톱박스, 스마트홈 장비 등을 통합 관리합니다 (실적 입력창에 즉시 반영)"
        showScopeToggle={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* 카테고리 사이드바 */}
        <Card className="p-4 glass h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Package className="size-4 text-primary" />
            <span className="text-sm font-semibold">장비 카테고리</span>
          </div>
          <div className="space-y-1">
            {CATEGORY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = activeCategory === opt.value;
              const cnt = counts[opt.value] ?? 0;
              return (
                <button
                  key={opt.value}
                  onClick={() => setActiveCategory(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/60 text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-3.5" />
                    {opt.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      cnt === 0
                        ? "border-dashed text-muted-foreground"
                        : "border-primary/40 text-primary"
                    }`}
                  >
                    {cnt}개
                  </Badge>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 메인 편집 영역 */}
        <Card className="p-6 glass">
          {/* 신규 등록 폼 */}
          <div className="mb-5 p-4 rounded-xl border border-border/40 bg-muted/20">
            <h4 className="text-sm font-semibold mb-3">
              ➕ {CATEGORY_OPTIONS.find((c) => c.value === activeCategory)?.label} 신규 등록
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <Label className="text-[11px]">장비명 *</Label>
                <Input
                  placeholder="예: UHD4, 사운드바2, AI 스피커"
                  value={form.equipment_name}
                  onChange={(e) => setForm({ ...form, equipment_name: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px]">통신사</Label>
                <Input
                  placeholder="LGU+"
                  value={form.carrier}
                  onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px]">모델 코드</Label>
                <Input
                  placeholder="예: UHD-V200"
                  value={form.model_code}
                  onChange={(e) => setForm({ ...form, model_code: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px]">기본 임대료 (₩/월)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.monthly_rental}
                  onChange={(e) => setForm({ ...form, monthly_rental: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <Button size="sm" onClick={add} disabled={!form.equipment_name.trim()} className="gap-1">
                <Plus className="size-3.5" /> 추가
              </Button>
            </div>
          </div>

          {/* 등록된 장비 리스트 */}
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold">
              등록된 장비
              <Badge variant="outline" className="ml-2 text-[10px]">
                {filtered.length}개
              </Badge>
            </h4>
            <span className="text-[11px] text-muted-foreground">
              드래그하여 노출 순서 변경
            </span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-sm text-muted-foreground">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
              아직 등록된 장비가 없습니다. 위 폼에서 등록해주세요.
            </div>
          ) : (
            <SortableList items={filtered} onReorder={reorder}>
              {(r, i) => (
                <SortableItem
                  key={r.id}
                  id={r.id}
                  className={`grid grid-cols-[24px_1fr_120px_140px_120px_auto] items-center gap-2 p-2.5 rounded-lg border mb-1.5 ${
                    r.active ? "border-border bg-card" : "border-dashed opacity-60"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground text-right">{i + 1}</span>
                  <Input
                    defaultValue={r.equipment_name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== r.equipment_name) updateField(r.id, { equipment_name: v });
                    }}
                    className="h-8 text-sm"
                  />
                  <Input
                    defaultValue={r.carrier ?? ""}
                    placeholder="통신사"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== r.carrier) updateField(r.id, { carrier: v });
                    }}
                    className="h-8 text-xs"
                  />
                  <Input
                    defaultValue={r.model_code ?? ""}
                    placeholder="모델 코드"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== r.model_code) updateField(r.id, { model_code: v });
                    }}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    defaultValue={r.monthly_rental}
                    placeholder="임대료"
                    onBlur={(e) => {
                      const v = Number(e.target.value) || 0;
                      if (v !== Number(r.monthly_rental)) updateField(r.id, { monthly_rental: v });
                    }}
                    className="h-8 text-xs text-right"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] h-7 px-2"
                      onClick={() => toggle(r)}
                    >
                      {r.active ? "숨김" : "사용"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => remove(r.id, r.equipment_name)}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                </SortableItem>
              )}
            </SortableList>
          )}

          <p className="text-[11px] text-muted-foreground mt-3">
            💡 등록된 장비는 실적 입력창의 [TV 추가 회선] → [셋톱박스] 드롭다운에 즉시 반영됩니다.
            스마트홈 / 기타 카테고리도 향후 입력 화면에서 활용할 수 있도록 자유롭게 등록해두세요.
          </p>
        </Card>
      </div>
    </div>
  );
}
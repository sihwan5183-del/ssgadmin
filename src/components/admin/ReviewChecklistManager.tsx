import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, ListChecks, Save, GripVertical, Sparkles } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { SortableList, SortableItem } from "@/components/common/SortableList";

export interface ChecklistItem {
  key: string;
  label: string;
  enabled: boolean;
  required: boolean;
  field?: string | null; // 매핑되는 실적 필드 (선택)
  // sort_order는 배열 순서로 결정
}

// 실적 입력 필드 후보 (자동 비교 대상)
const FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "(매핑 없음)" },
  { value: "customer_name", label: "고객명" },
  { value: "phone", label: "전화번호" },
  { value: "rate_plan", label: "요금제" },
  { value: "sale_type", label: "가입유형" },
  { value: "device_model", label: "단말 모델" },
  { value: "device_serial", label: "IMEI/시리얼" },
  { value: "unit_price", label: "단가" },
  { value: "vas1", label: "부가서비스1 (VAS1)" },
  { value: "vas2", label: "부가서비스2 (VAS2)" },
  { value: "auto_debit", label: "자동이체" },
  { value: "bank", label: "입금/계좌은행" },
  { value: "bundle", label: "결합" },
  { value: "channel", label: "인입경로/매체" },
  { value: "product", label: "상품" },
];

const DEFAULT: ChecklistItem[] = [
  { key: "docs_match", label: "가입 서류 일치", enabled: true, required: true },
  { key: "plan_match", label: "요금제 확인", enabled: true, required: true, field: "rate_plan" },
  { key: "price_match", label: "단가 확인", enabled: true, required: true, field: "unit_price" },
  { key: "vas_match", label: "부가서비스 확인", enabled: true, required: false, field: "vas1" },
  { key: "autodebit_match", label: "자동이체 / 입금계좌 확인", enabled: true, required: false, field: "auto_debit" },
  { key: "bundle_match", label: "결합 확인", enabled: true, required: false, field: "bundle" },
  { key: "vas_fee_match", label: "부가서비스 수수료 적용", enabled: false, required: false },
];

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;

// 레거시 데이터(라벨만 있는 객체) → 신규 구조로 마이그레이션
const normalize = (raw: any): ChecklistItem[] => {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT;
  return raw.map((it: any) => ({
    key: String(it.key ?? slugify(it.label ?? "item")),
    label: String(it.label ?? ""),
    enabled: it.enabled !== false, // 미정의시 활성
    required: !!it.required,
    field: it.field ?? null,
  }));
};

export const ReviewChecklistManager = () => {
  const { settings, upsert } = useAppSettings();
  const [items, setItems] = useState<ChecklistItem[]>(normalize(settings["review.checklist"]));
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems(normalize(settings["review.checklist"]));
  }, [JSON.stringify(settings["review.checklist"])]);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (items.some((i) => i.label === label)) {
      toast.error("이미 존재하는 항목입니다");
      return;
    }
    setItems([...items, { key: slugify(label), label, enabled: true, required: false, field: null }]);
    setDraft("");
  };

  const remove = (key: string) => setItems(items.filter((i) => i.key !== key));
  const patch = (key: string, p: Partial<ChecklistItem>) =>
    setItems(items.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const save = async () => {
    setSaving(true);
    const { error } = await upsert("review.checklist", items);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("검수 항목 설정이 저장되었습니다");
  };

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.enabled).length;
    const required = items.filter((i) => i.enabled && i.required).length;
    return { total, active, required };
  }, [items]);

  return (
    <Card className="p-6 glass space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ListChecks className="size-4 text-emerald-400" />
            검수 항목 설정
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            검수 창에 노출할 항목, 필수 여부, 정렬 순서, 자동 비교 필드를 관리합니다. 드래그하여 순서를 변경하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            전체 {stats.total} · 활성 {stats.active} · 필수 {stats.required}
          </Badge>
          <Button onClick={save} disabled={saving} size="sm">
            <Save className="size-3.5 mr-1.5" />
            {saving ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>

      {/* 헤더 */}
      <div className="hidden md:grid grid-cols-[24px_1fr_180px_90px_90px_40px] gap-2 px-2 text-[11px] font-medium text-muted-foreground">
        <span></span>
        <span>항목명</span>
        <span>매핑 필드 (자동 비교)</span>
        <span className="text-center">활성</span>
        <span className="text-center">필수</span>
        <span></span>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            항목을 추가하세요
          </div>
        )}

        <SortableList
          items={items.map((i) => ({ ...i, id: i.key }))}
          onReorder={(next) =>
            setItems(next.map(({ id: _id, ...rest }) => rest as ChecklistItem))
          }
        >
          {(it) => (
            <SortableItem
              key={it.key}
              id={it.key}
              className={`grid grid-cols-[24px_1fr_180px_90px_90px_40px] gap-2 items-center p-2 rounded-lg border bg-background/40 ${
                it.enabled ? "border-border/40" : "border-border/30 opacity-60"
              }`}
            >
              <Input
                value={it.label}
                onChange={(e) => patch(it.key, { label: e.target.value })}
                className="h-9 bg-input/60"
              />
              <Select
                value={it.field ?? ""}
                onValueChange={(v) => patch(it.key, { field: v || null })}
              >
                <SelectTrigger className="h-9 bg-input/60 text-xs">
                  <SelectValue placeholder="(매핑 없음)" />
                </SelectTrigger>
                <SelectContent className="z-[60] bg-popover">
                  {FIELD_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "_none"} value={o.value || "_none"}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-center">
                <Switch
                  checked={it.enabled}
                  onCheckedChange={(v) => patch(it.key, { enabled: v })}
                />
              </div>
              <div className="flex justify-center">
                <Switch
                  checked={it.required}
                  onCheckedChange={(v) => patch(it.key, { required: v })}
                  disabled={!it.enabled}
                />
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(it.key)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </SortableItem>
          )}
        </SortableList>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="새 검수 항목 (예: 명의 일치, 신분증 사진 확인)"
          className="h-10 bg-input/60"
        />
        <Button onClick={add}>
          <Plus className="size-4 mr-1" /> 추가
        </Button>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 text-primary font-semibold">
          <Sparkles className="size-3.5" /> 사용 안내
        </div>
        <p>· <b>활성</b>이 OFF인 항목은 검수 창에 노출되지 않습니다.</p>
        <p>· <b>필수</b>가 ON인 항목은 모두 체크되어야 [검수 완료] 버튼이 활성화됩니다.</p>
        <p>· <b>매핑 필드</b>를 지정하면 우측 패널에 [실적 입력값] vs [시스템 기준값]이 자동 비교 표시됩니다.</p>
        <p>· 드래그(<GripVertical className="size-3 inline" />)로 순서를 조정하면 검수자가 보는 순서가 바뀝니다.</p>
      </div>
    </Card>
  );
};

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, ListChecks, Save } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

interface ChecklistItem { key: string; label: string }
const DEFAULT: ChecklistItem[] = [
  { key: "docs_match", label: "가입 서류 일치" },
  { key: "plan_match", label: "요금제 확인" },
  { key: "price_match", label: "단가 확인" },
  { key: "bundle_match", label: "결합 확인" },
  { key: "autodebit_match", label: "자동이체 / 입금계좌 확인" },
  { key: "fee_match", label: "단가/수수료 정책 일치" },
  { key: "vas_fee_match", label: "부가서비스 수수료 적용" },
];

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;

export const ReviewChecklistManager = () => {
  const { settings, upsert } = useAppSettings();
  const initial: ChecklistItem[] = Array.isArray(settings["review.checklist"]) && settings["review.checklist"].length > 0
    ? (settings["review.checklist"] as ChecklistItem[])
    : DEFAULT;
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Array.isArray(settings["review.checklist"])) {
      setItems(settings["review.checklist"] as ChecklistItem[]);
    }
  }, [settings]);

  const add = () => {
    const label = draft.trim();
    if (!label) return;
    if (items.some((i) => i.label === label)) {
      toast.error("이미 존재하는 항목입니다");
      return;
    }
    setItems([...items, { key: slugify(label), label }]);
    setDraft("");
  };

  const remove = (key: string) => setItems(items.filter((i) => i.key !== key));

  const updateLabel = (key: string, label: string) =>
    setItems(items.map((i) => (i.key === key ? { ...i, label } : i)));

  const save = async () => {
    setSaving(true);
    const { error } = await upsert("review.checklist", items);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("검수 체크리스트가 저장되었습니다");
  };

  return (
    <Card className="p-6 glass space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ListChecks className="size-4 text-emerald-400" />
            검수 체크리스트 관리
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            관리자가 실적 검수 시 표시되는 체크박스 항목을 자유롭게 정의합니다
          </p>
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          <Save className="size-3.5 mr-1.5" />
          저장
        </Button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            항목을 추가하세요
          </div>
        )}
        {items.map((it) => (
          <div key={it.key} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-background/40">
            <ListChecks className="size-4 text-muted-foreground shrink-0" />
            <Input
              value={it.label}
              onChange={(e) => updateLabel(it.key, e.target.value)}
              className="h-9 bg-input/60 flex-1"
            />
            <span className="text-[10px] text-muted-foreground font-mono px-2 shrink-0">{it.key}</span>
            <Button size="sm" variant="ghost" onClick={() => remove(it.key)}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="새 체크 항목 (예: 명의 일치, 부가서비스 확인)"
          className="h-10 bg-input/60"
        />
        <Button onClick={add}>
          <Plus className="size-4 mr-1" /> 추가
        </Button>
      </div>
    </Card>
  );
};

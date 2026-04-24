import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const PENDING_ITEM_OPTIONS = [
  "약정 처리",
  "할부 등록",
  "결합 할인",
  "부가서비스 가입",
  "서류 보완",
  "청구계정통합",
  "2ND쉐어링결합",
] as const;
export type PendingItem = (typeof PENDING_ITEM_OPTIONS)[number] | string;

interface Props {
  items: string[];
  note: string;
  resolved: boolean;
  onItemsChange: (next: string[]) => void;
  onNoteChange: (next: string) => void;
  onResolvedChange?: (next: boolean) => void;
  disabled?: boolean;
  /** resolved 토글 노출 여부 (입력 폼에서는 숨김 권장) */
  showResolvedToggle?: boolean;
}

export const PendingItemsEditor = ({
  items,
  note,
  resolved,
  onItemsChange,
  onNoteChange,
  onResolvedChange,
  disabled,
  showResolvedToggle = false,
}: Props) => {
  const toggle = (item: string) => {
    if (disabled) return;
    if (items.includes(item)) onItemsChange(items.filter((i) => i !== item));
    else onItemsChange([...items, item]);
  };

  const hasPending = items.length > 0;

  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {hasPending && !resolved ? (
            <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 gap-1 text-[10px] px-1.5 py-0 h-5 shrink-0">
              <AlertTriangle className="size-3" /> 미처리 {items.length}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 gap-1 text-[10px] px-1.5 py-0 h-5 shrink-0">
              <CheckCircle2 className="size-3" /> 완료
            </Badge>
          )}
        </div>
        {showResolvedToggle && hasPending && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch
              id="pending-resolved"
              checked={resolved}
              onCheckedChange={(v) => onResolvedChange?.(v)}
              disabled={disabled}
            />
            <Label htmlFor="pending-resolved" className="text-[10px] cursor-pointer whitespace-nowrap">
              모두 해결
            </Label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {PENDING_ITEM_OPTIONS.map((opt) => {
          const checked = items.includes(opt);
          return (
            <label
              key={opt}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                checked
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-border/40 hover:border-primary/30"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(opt)}
                disabled={disabled}
              />
              <span className="truncate">{opt}</span>
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">미처리 메모 (사유·예정일 등)</Label>
        <Textarea
          rows={2}
          value={note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="예: 서류 미비로 현재 미결합 중, 3일 내 보완 예정"
          disabled={disabled}
          className="bg-input/60"
        />
      </div>
    </div>
  );
};

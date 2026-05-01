import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { usePendingItemDefinitions } from "@/hooks/usePendingItemDefinitions";

/**
 * @deprecated 이제 항목 목록은 어드민의 [미처리 항목 설정] 에서 관리됩니다.
 * 폴백/타입 호환을 위해 기본값만 보존.
 */
export const PENDING_ITEM_OPTIONS = [
  "약정 처리",
  "할부 등록",
  "결합 할인",
  "부가서비스 가입",
  "서류 보완",
  "청구계정통합",
  "2ND쉐어링결합",
] as const;
export type PendingItem = string;

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
  const { items: defs, loading } = usePendingItemDefinitions();

  const toggle = (item: string) => {
    if (disabled) return;
    if (items.includes(item)) onItemsChange(items.filter((i) => i !== item));
    else onItemsChange([...items, item]);
  };

  const hasPending = items.length > 0;
  // 이전에 등록된 데이터에 들어있지만 어드민이 비활성/삭제한 라벨 — 그대로 유지하되 안내 표기
  const knownLabels = new Set(defs.map((d) => d.label));
  const legacyChecked = items.filter((i) => !knownLabels.has(i));

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

      {loading && defs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">미처리 항목 목록을 불러오는 중…</div>
      ) : defs.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-2">
          등록된 미처리 항목이 없습니다. 어드민 → [미처리 항목 설정] 에서 추가해주세요.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {defs.map((d) => {
            const checked = items.includes(d.label);
            return (
              <label
                key={d.id}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                  checked
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-border/40 hover:border-primary/30"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
                title={d.required ? "필수 체크 항목" : undefined}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(d.label)}
                  disabled={disabled}
                />
                <span className="truncate flex items-center gap-1">
                  {d.required && <Star className="size-2.5 text-amber-500 fill-amber-400 shrink-0" />}
                  {d.label}
                </span>
              </label>
            );
          })}
          {legacyChecked.map((label) => (
            <label
              key={`legacy-${label}`}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] whitespace-nowrap cursor-pointer transition-colors border-amber-400 bg-amber-50/60 text-amber-700"
              title="현재는 비활성/삭제된 항목 (과거 데이터)"
            >
              <Checkbox
                checked
                onCheckedChange={() => toggle(label)}
                disabled={disabled}
              />
              <span className="truncate italic opacity-80">{label}</span>
            </label>
          ))}
        </div>
      )}

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

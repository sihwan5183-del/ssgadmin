import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Smartphone, Check, Star, XCircle } from "lucide-react";
import { useDeviceModels, type DeviceModel } from "@/hooks/useDeviceModels";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (petName: string) => void;
  placeholder?: string;
  className?: string;
  /** 미등록 모델 입력 시 콜백 (정보용) */
  onUnmapped?: (raw: string) => void;
  disabled?: boolean;
}

/**
 * 모델명 검색 입력 — 어드민 마스터에 등록된 펫네임/공식명/유사어를 후보로 보여줌.
 * 자동 매칭/자동 등록 없음. 사용자가 드롭다운에서 직접 클릭하거나 Enter 로 선택해야만
 * 실제 값이 저장되며, 그 외 텍스트 입력은 임시 입력으로만 유지됨 (저장 시 차단).
 */
export const ModelAutocomplete = ({
  value, onChange, placeholder, className, onUnmapped, disabled,
}: Props) => {
  const { searchModels, models, loading } = useDeviceModels(true);
  const [input, setInput] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setInput(value ?? ""), [value]);

  // 외부 클릭 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const rawSuggestions: DeviceModel[] = input.trim() ? searchModels(input, 8) : models.slice(0, 8);
  // Strategy models first
  const suggestions = [...rawSuggestions].sort((a, b) => {
    const sa = (a as any).is_strategy ? 1 : 0;
    const sb = (b as any).is_strategy ? 1 : 0;
    return sb - sa;
  });
  // 정확 매칭 (펫네임 == 입력값) — 자동 매칭 로직 제거, 100% 일치만 인정
  const isConfirmed =
    !!value && models.some((m) => m.model_name === value) && input === value;
  const showNoMatch =
    !loading && input.trim().length > 0 && !isConfirmed && suggestions.length === 0;
  const showNeedsConfirm =
    !loading && input.trim().length > 0 && !isConfirmed && suggestions.length > 0;

  const choose = (m: DeviceModel) => {
    setInput(m.model_name);
    onChange(m.model_name);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={input}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          setInput(v);
          setOpen(true);
          setHighlight(0);
          // 자동 매칭/자동 등록 없음 — 사용자가 후보를 클릭/Enter 로 선택해야만 onChange 발생
          // 텍스트가 변경되면 기존에 확정된 값은 무효화
          if (value) onChange("");
          if (v.trim()) onUnmapped?.(v);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && suggestions[highlight]) {
            e.preventDefault();
            choose(suggestions[highlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder ?? "모델명 검색 후 목록에서 선택 (예: S26)"}
        className={cn(
          "h-11 bg-input/60 pr-9",
          showNoMatch && "border-destructive/60 focus-visible:ring-destructive/40",
          showNeedsConfirm && "border-amber-400/60",
        )}
        aria-invalid={showNoMatch || showNeedsConfirm}
      />
      {/* 상태 아이콘 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {isConfirmed ? (
          <Check className="size-4 text-emerald-400" />
        ) : showNoMatch ? (
          <XCircle className="size-4 text-destructive" />
        ) : showNeedsConfirm ? (
          <AlertTriangle className="size-4 text-amber-400" />
        ) : null}
      </div>

      {showNoMatch && (
        <div className="mt-1 text-[11px] text-destructive flex items-center gap-1">
          <XCircle className="size-3" />
          일치하는 모델이 없습니다. 관리자에게 모델 등록을 요청하세요.
        </div>
      )}
      {showNeedsConfirm && (
        <div className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
          <AlertTriangle className="size-3" />
          아래 목록에서 모델을 직접 선택해야 저장됩니다.
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-card-elevated">
          {suggestions.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(m)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors",
                i === highlight ? "bg-primary/15" : "hover:bg-muted/40",
              )}
            >
              {(m as any).is_strategy ? (
                <Star className="size-3.5 text-amber-400 fill-amber-400 shrink-0" />
              ) : (
                <Smartphone className="size-3.5 text-primary-glow shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{m.model_name}</span>
                  {m.manufacturer && (
                    <Badge variant="outline" className="text-[10px] py-0">{m.manufacturer}</Badge>
                  )}
                  {m.official_name && (
                    <span className="text-[11px] text-muted-foreground font-mono">{m.official_name}</span>
                  )}
                </div>
                {m.aliases?.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    유사어: {m.aliases.join(", ")}
                  </div>
                )}
              </div>
              {m.retail_price > 0 && (
                <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                  {Number(m.retail_price).toLocaleString("ko-KR")}원
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

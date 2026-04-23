import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Smartphone, Check, Star } from "lucide-react";
import { useDeviceModels, type DeviceModel } from "@/hooks/useDeviceModels";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (petName: string) => void;
  placeholder?: string;
  className?: string;
  /** 미등록 모델 입력 시 콜백 (false 반환 시 onChange 막힘 — 현재는 정보용) */
  onUnmapped?: (raw: string) => void;
  disabled?: boolean;
}

/**
 * 모델명 자동완성 입력 — 어드민 마스터에 등록된 펫네임/공식명/유사어 검색.
 * 미등록값 입력 시 경고 배지 표시. 선택 시 펫네임으로 정규화해 저장.
 */
export const ModelAutocomplete = ({
  value, onChange, placeholder, className, onUnmapped, disabled,
}: Props) => {
  const { searchModels, matchModel, models, loading } = useDeviceModels(true);
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
  const matched = matchModel(input);
  const isMapped = !!matched && matched.model_name === input;
  const showUnmappedWarn = !loading && input.trim().length > 0 && !matched;

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
          setInput(e.target.value);
          setOpen(true);
          setHighlight(0);
          // 즉시 매칭되면 펫네임으로 저장, 아니면 원본 그대로
          const m = matchModel(e.target.value);
          if (m) onChange(m.model_name);
          else {
            onChange(e.target.value);
            onUnmapped?.(e.target.value);
          }
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
        placeholder={placeholder ?? "모델명 입력 (예: 942, S26, SM-S942N)"}
        className="h-11 bg-input/60 pr-9"
      />
      {/* 상태 아이콘 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {isMapped ? (
          <Check className="size-4 text-emerald-400" />
        ) : showUnmappedWarn ? (
          <AlertTriangle className="size-4 text-amber-400" />
        ) : null}
      </div>

      {showUnmappedWarn && (
        <div className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
          <AlertTriangle className="size-3" />
          등록되지 않은 모델입니다. 어드민에서 확인해주세요.
        </div>
      )}
      {matched && !isMapped && (
        <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
          <Check className="size-3" />
          저장 시 <b className="font-semibold">{matched.model_name}</b> 으로 자동 통합됩니다.
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

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FilterSelection = Set<string> | null; // null = no filter (전체)

interface Props {
  label: string;
  values: string[]; // 컬럼에 존재하는 고유값 목록
  selected: FilterSelection;
  onChange: (next: FilterSelection) => void;
  className?: string;
  align?: "start" | "center" | "end";
}

const EMPTY_LABEL = "(빈 값)";

export const ColumnFilter = ({ label, values, selected, onChange, className, align = "start" }: Props) => {
  const [q, setQ] = useState("");
  const active = selected !== null;

  const uniqueValues = useMemo(() => {
    const set = new Set<string>();
    for (const v of values) {
      set.add(v && v.length > 0 ? v : EMPTY_LABEL);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [values]);

  const visible = useMemo(() => {
    if (!q) return uniqueValues;
    const ql = q.toLowerCase();
    return uniqueValues.filter((v) => v.toLowerCase().includes(ql));
  }, [uniqueValues, q]);

  const isAll = !active;

  const toggle = (v: string) => {
    const next = new Set(selected ?? uniqueValues);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    if (next.size === uniqueValues.length) onChange(null);
    else onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground transition-colors text-left",
            active && "text-primary",
            className,
          )}
          title={`${label} 필터`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className={cn("size-3 shrink-0 transition-transform", active && "rotate-180 text-primary")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 p-2">
        <div className="space-y-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="값 검색…"
            className="h-7 text-xs"
          />
          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-primary hover:underline"
            >
              전체 표시
            </button>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-muted-foreground hover:underline"
            >
              모두 해제
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5 -mx-1">
            {visible.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">항목 없음</div>
            ) : (
              visible.map((v) => {
                const checked = isAll ? true : selected!.has(v);
                return (
                  <label
                    key={v}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/60 cursor-pointer text-xs text-foreground"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(v)} />
                    <span className="truncate">{v}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// 필터 적용 헬퍼: 셀 값(string|null) 이 선택 집합과 매치되는지
export const matchesFilter = (value: string | null | undefined, selected: FilterSelection) => {
  if (selected === null) return true;
  const key = value && String(value).length > 0 ? String(value) : EMPTY_LABEL;
  return selected.has(key);
};
import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  /** Available master options (deduped, sorted). */
  options: string[];
  /** Currently selected values. */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * 다중 선택 가능한 태그(칩) 셀렉트.
 * - 마스터에 등록된 값만 클릭으로 추가/제거할 수 있다.
 * - 자유 텍스트 입력은 금지하여 표기 일관성을 강제한다.
 */
export const MultiSelectChips = ({
  options,
  value,
  onChange,
  placeholder = "선택…",
  emptyHint = "등록된 항목이 없습니다",
  className,
  disabled,
  invalid,
}: Props) => {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(value ?? []), [value]);

  const toggle = (item: string) => {
    if (selectedSet.has(item)) onChange(value.filter((v) => v !== item));
    else onChange([...(value ?? []), item]);
  };

  const remove = (item: string) => onChange(value.filter((v) => v !== item));

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-between bg-input/60 text-xs font-normal border-border/60 hover:border-border",
              invalid && "border-destructive focus-visible:ring-destructive/40",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            {value.length === 0 ? placeholder : `${value.length}개 선택됨`}
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[min(360px,90vw)]" align="start">
          <Command>
            <CommandInput placeholder="검색…" className="h-9 text-xs" />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {options.length === 0 ? emptyHint : "검색 결과 없음"}
              </CommandEmpty>
              <CommandGroup>
                {options.map((item) => {
                  const checked = selectedSet.has(item);
                  return (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => toggle(item)}
                      className="text-xs"
                    >
                      <Check className={cn("mr-2 size-3.5", checked ? "opacity-100 text-primary" : "opacity-0")} />
                      <span className="flex-1">{item}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge
              key={v}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium bg-primary/10 text-primary border border-primary/30"
            >
              {v}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(v)}
                className="rounded-sm hover:bg-primary/20 p-0.5"
                aria-label={`${v} 제거`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
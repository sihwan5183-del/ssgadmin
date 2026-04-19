import { CalendarDays, CalendarRange, Calendar as CalendarIcon } from "lucide-react";
import { usePeriod } from "@/contexts/PeriodContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);
const MONTHS = [
  { v: 0, label: "전체 월" },
  ...Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: `${i + 1}월` })),
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PeriodFilter = () => {
  const {
    mode, setMode,
    year, month, setYear, setMonth,
    customStart, customEnd, setSingleDay, setCustomRange,
    label,
  } = usePeriod();

  const modes: { v: typeof mode; label: string; icon: typeof CalendarDays }[] = [
    { v: "month", label: "월", icon: CalendarDays },
    { v: "day", label: "일", icon: CalendarIcon },
    { v: "range", label: "기간", icon: CalendarRange },
  ];

  return (
    <div className="inline-flex items-center gap-2 glass border border-border/40 rounded-xl px-2 py-1.5">
      {/* Mode toggle */}
      <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = mode === m.v;
          return (
            <button
              key={m.v}
              onClick={() => setMode(m.v)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                active
                  ? "bg-primary/20 text-primary-glow"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3" />
              {m.label}
            </button>
          );
        })}
      </div>

      <span className="text-muted-foreground/40">·</span>

      {mode === "month" && (
        <>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-[88px] border-0 bg-transparent focus:ring-0 px-2 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground/40">·</span>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-8 w-[80px] border-0 bg-transparent focus:ring-0 px-2 text-sm font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.v} value={String(m.v)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {mode === "day" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 px-2 text-sm font-semibold gap-1.5"
            >
              <CalendarIcon className="size-3.5 text-primary-glow" />
              {customStart
                ? format(new Date(customStart + "T00:00:00"), "yyyy.MM.dd (eee)", { locale: ko })
                : "날짜 선택"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={customStart ? new Date(customStart + "T00:00:00") : undefined}
              onSelect={(d) => d && setSingleDay(isoDate(d))}
              initialFocus
              locale={ko}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      {mode === "range" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 px-2 text-sm font-semibold gap-1.5"
            >
              <CalendarRange className="size-3.5 text-primary-glow" />
              {customStart && customEnd
                ? `${format(new Date(customStart + "T00:00:00"), "MM.dd")} ~ ${format(new Date(customEnd + "T00:00:00"), "MM.dd")}`
                : "기간 선택"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={
                customStart && customEnd
                  ? { from: new Date(customStart + "T00:00:00"), to: new Date(customEnd + "T00:00:00") }
                  : undefined
              }
              onSelect={(r) => {
                if (r?.from && r?.to) setCustomRange(isoDate(r.from), isoDate(r.to));
                else if (r?.from) setCustomRange(isoDate(r.from), isoDate(r.from));
              }}
              numberOfMonths={2}
              initialFocus
              locale={ko}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}

      {(mode === "day" || mode === "range") && (
        <span className="text-[10px] text-muted-foreground hidden md:inline ml-1">{label}</span>
      )}
    </div>
  );
};

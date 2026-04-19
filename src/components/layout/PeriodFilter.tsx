import { CalendarDays } from "lucide-react";
import { usePeriod } from "@/contexts/PeriodContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);
const MONTHS = [
  { v: 0, label: "전체 월" },
  ...Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: `${i + 1}월` })),
];

export const PeriodFilter = () => {
  const { year, month, setYear, setMonth } = usePeriod();
  return (
    <div className="inline-flex items-center gap-2 glass border border-border/40 rounded-xl px-3 py-1.5">
      <CalendarDays className="size-4 text-primary-glow" />
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
    </div>
  );
};

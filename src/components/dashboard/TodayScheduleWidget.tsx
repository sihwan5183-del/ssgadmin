import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Star, MapPin, ChevronRight } from "lucide-react";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Link } from "react-router-dom";

const CAT_COLORS: Record<string, string> = {
  "광고/마케팅": "bg-blue-100 text-blue-700",
  "매장 점검": "bg-emerald-100 text-emerald-700",
  "본사 교육": "bg-violet-100 text-violet-700",
  "프로모션": "bg-rose-100 text-rose-700",
  "정책 배포": "bg-amber-100 text-amber-700",
  "회의": "bg-cyan-100 text-cyan-700",
  "기타": "bg-gray-100 text-gray-700",
};

export function TodayScheduleWidget() {
  const today = new Date();
  const { data: events = [] } = useQuery({
    queryKey: ["today-events"],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", startOfDay(today).toISOString())
        .lte("start_date", endOfDay(today).toISOString())
        .order("is_important", { ascending: false })
        .order("start_date")
        .limit(5);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (events.length === 0) return null;

  return (
    <Card className="p-4 glass mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" />
          오늘의 주요 업무
          <Badge variant="secondary" className="text-[10px]">{format(today, "M/d (EEE)", { locale: ko })}</Badge>
        </div>
        <Link to="/company-calendar" className="text-xs text-primary hover:underline flex items-center gap-0.5">
          전체 캘린더 <ChevronRight className="size-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {events.map((e: any) => (
          <Link
            key={e.id}
            to={`/company-calendar?event=${e.id}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-xs"
          >
            {e.is_important && <Star className="size-3 text-amber-500 fill-amber-500 shrink-0" />}
            <Badge className={`${CAT_COLORS[e.category] ?? "bg-gray-100 text-gray-700"} text-[10px] shrink-0`}>{e.category}</Badge>
            <span className="font-medium truncate">{e.title}</span>
            {e.location && <span className="text-muted-foreground flex items-center gap-0.5 shrink-0"><MapPin className="size-2.5" />{e.location}</span>}
            {!e.all_day && <span className="text-muted-foreground ml-auto shrink-0">{format(parseISO(e.start_date), "HH:mm")}</span>}
          </Link>
        ))}
      </div>
    </Card>
  );
}
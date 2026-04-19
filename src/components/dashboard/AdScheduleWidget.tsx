import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Megaphone, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getMediaPalette } from "@/lib/mediaColors";
import { cn } from "@/lib/utils";

interface MiniCampaign {
  id: string;
  media: string;
  topic: string;
  start_date: string;
  end_date: string;
  total_budget: number;
  image_url: string | null;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export const AdScheduleWidget = () => {
  const [today, setToday] = useState<MiniCampaign[]>([]);
  const [week, setWeek] = useState<MiniCampaign[]>([]);

  useEffect(() => {
    const now = new Date();
    const todayStr = isoDate(now);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = isoDate(weekEnd);

    (async () => {
      const { data } = await supabase
        .from("ad_campaigns")
        .select("id,media,topic,start_date,end_date,total_budget,image_url")
        .lte("start_date", weekEndStr)
        .gte("end_date", todayStr)
        .order("start_date", { ascending: true });
      const all = (data ?? []) as MiniCampaign[];
      setToday(all.filter((c) => c.start_date <= todayStr && c.end_date >= todayStr));
      setWeek(all);
    })();
  }, []);

  return (
    <Card className="glass-strong border-border/40 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-gradient-primary/20 grid place-items-center">
            <Megaphone className="size-4 text-primary-glow" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">광고 스케줄</h3>
            <p className="text-[11px] text-muted-foreground">오늘 + 향후 7일</p>
          </div>
        </div>
        <Link
          to="/ad-calendar"
          className="text-xs text-primary-glow hover:underline inline-flex items-center gap-0.5"
        >
          캘린더 <ChevronRight className="size-3" />
        </Link>
      </div>

      {/* 오늘 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[11px] font-medium text-muted-foreground">오늘 집행 중</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{today.length}</Badge>
        </div>
        {today.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 px-1 py-3 text-center">오늘 진행 중인 광고가 없습니다</p>
        ) : (
          <div className="space-y-1.5">
            {today.slice(0, 3).map((c) => {
              const p = getMediaPalette(c.media);
              return (
                <div
                  key={c.id}
                  className={cn("flex items-center gap-2 p-2 rounded-lg border-l-2", p.bg, p.border)}
                >
                  <span className={cn("size-1.5 rounded-full shrink-0", p.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] font-bold", p.text)}>{c.media}</span>
                      <span className="text-xs truncate text-foreground">{c.topic}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    ₩{(c.total_budget || 0).toLocaleString("ko-KR")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 이번 주 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="size-3 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">이번 주 스케줄</span>
        </div>
        {week.length === 0 ? (
          <p className="text-xs text-muted-foreground/70 px-1 py-3 text-center">예정된 광고가 없습니다</p>
        ) : (
          <div className="space-y-1">
            {week.slice(0, 5).map((c) => {
              const p = getMediaPalette(c.media);
              return (
                <Link
                  key={c.id}
                  to="/ad-calendar"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.04] transition"
                >
                  <span className={cn("size-1.5 rounded-full shrink-0", p.dot)} />
                  <span className={cn("text-[10px] font-semibold w-12 shrink-0", p.text)}>{c.media}</span>
                  <span className="text-xs flex-1 truncate text-foreground/90">{c.topic}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {c.start_date.slice(5)}~{c.end_date.slice(5)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

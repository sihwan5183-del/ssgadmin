import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export const UntreatedLeadsCard = () => {
  const [total, setTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, inquiry_date, status, last_action_at, note, content, converted_sale_id")
        .in("status", ["미처리", "문의중"])
        .limit(5000);
      if (error) { setLoading(false); return; }
      const rows = data ?? [];
      // Filter: truly untreated
      const untreated = rows.filter(
        (r) =>
          r.status === "미처리" ||
          (r.status === "문의중" && !r.last_action_at && !r.note && !r.content && !r.converted_sale_id)
      );
      setTotal(untreated.length);
      setTodayCount(untreated.filter((r) => r.inquiry_date === today).length);
      setLoading(false);
    })();
  }, []);

  return (
    <Link to="/channel-intake" className="block">
      <Card className="glass border-border/40 p-3 hover:bg-accent/30 transition-colors h-full">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 grid place-items-center">
            <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">신규 미처리</span>
        </div>
        {loading ? (
          <div className="text-lg font-bold text-muted-foreground">…</div>
        ) : (
          <>
            <div className="text-2xl font-extrabold tabular-nums text-orange-600 dark:text-orange-400 leading-tight">
              {total}
              <span className="text-xs font-semibold text-muted-foreground ml-1">건</span>
            </div>
            {todayCount > 0 && (
              <div className="text-[11px] font-semibold text-orange-500 mt-0.5">
                오늘 +{todayCount}건
              </div>
            )}
          </>
        )}
      </Card>
    </Link>
  );
};
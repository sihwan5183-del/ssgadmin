import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

export const PendingItemsCard = () => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .eq("pending_resolved", false)
      .then(({ count }) => setCount(count ?? 0));
  }, []);

  const urgent = (count ?? 0) > 0;

  return (
    <Link
      to="/activities?pending=1"
      className="glass rounded-xl p-3 shadow-card-elevated hover:border-amber-400 transition-colors group block relative overflow-hidden"
      title={urgent ? "긴급 처리 필요" : "클릭하면 활동관리에서 미처리만 필터됩니다"}
    >
      {urgent && (
        <span className="absolute top-2 right-2 flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
        </span>
      )}
      <div className="flex items-center justify-between">
        <div
          className={
            "size-8 rounded-lg grid place-items-center bg-gradient-to-br from-amber-100 to-orange-100 text-amber-500 " +
            (urgent ? "animate-pulse" : "")
          }
        >
          <AlertTriangle className="size-4" />
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground truncate">미처리 건수</div>
      <div className="mt-0.5 text-lg md:text-xl font-bold tabular-nums">
        {count == null ? "…" : count.toLocaleString("ko-KR")}
        <span className="text-xs text-muted-foreground ml-0.5">건</span>
      </div>
    </Link>
  );
};

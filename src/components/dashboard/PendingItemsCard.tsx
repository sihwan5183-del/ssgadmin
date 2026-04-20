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
      className="glass rounded-2xl p-5 shadow-card-elevated hover:border-amber-500/40 transition-colors group block relative overflow-hidden"
    >
      {urgent && (
        <span className="absolute top-3 right-3 flex size-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
          <span className="relative inline-flex size-3 rounded-full bg-destructive" />
        </span>
      )}
      <div
        className={
          "size-10 rounded-xl grid place-items-center bg-gradient-to-br from-amber-400/30 to-orange-500/10 text-amber-500 " +
          (urgent ? "animate-pulse" : "")
        }
      >
        <AlertTriangle className="size-5" />
      </div>
      <div className="mt-4 text-sm text-muted-foreground">미처리 건수</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {count == null ? "…" : count.toLocaleString("ko-KR")}
        <span className="text-sm text-muted-foreground ml-1">건</span>
      </div>
      <div
        className={
          "mt-1 text-[11px] transition-colors " +
          (urgent ? "text-destructive font-semibold" : "text-muted-foreground group-hover:text-amber-500")
        }
      >
        {urgent ? "⚠ 긴급 처리 필요 →" : "클릭하면 활동관리에서 미처리만 필터됩니다 →"}
      </div>
    </Link>
  );
};

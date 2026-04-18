import { recentActivities, formatKRW } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";

export const RecentActivities = () => {
  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">최근 영업 활동</h3>
          <p className="text-xs text-muted-foreground mt-1">실시간 입력 피드</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary-glow bg-primary/5">LIVE</Badge>
      </div>
      <ul className="space-y-3">
        {recentActivities.map((a) => (
          <li key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
            <div className="size-9 rounded-full bg-gradient-soft grid place-items-center text-xs font-semibold text-primary-glow ring-1 ring-primary/30">
              {a.name.slice(-2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{a.name}</span>
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/60">{a.channel}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{a.action}</div>
            </div>
            <div className="text-right">
              {a.profit > 0 && <div className="text-sm font-semibold text-success">+{formatKRW(a.profit)}</div>}
              <div className="text-[10px] text-muted-foreground mt-0.5">{a.time}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

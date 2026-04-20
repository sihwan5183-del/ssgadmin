import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, FileSearch, ShieldCheck, Radio, Activity } from "lucide-react";

type FeedItem = {
  id: string;
  type: "activation" | "review_request" | "approved";
  title: string;
  subtitle: string;
  at: string;
  manager: string | null;
};

const ICONS = {
  activation: { Icon: CheckCircle2, color: "hsl(158 65% 45%)", glow: "hsl(158 65% 45% / 0.3)", label: "개통" },
  review_request: { Icon: FileSearch, color: "hsl(38 92% 55%)", glow: "hsl(38 92% 55% / 0.3)", label: "검수요청" },
  approved: { Icon: ShieldCheck, color: "hsl(330 100% 55%)", glow: "hsl(330 100% 55% / 0.3)", label: "승인" },
};

const fmtTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

export const LiveActivityFeed = () => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("sales")
      .select("id, status, approval_status, customer_name, manager, device_model, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    const mapped: FeedItem[] = (data ?? []).map((r: any) => {
      let type: FeedItem["type"] = "activation";
      if (r.approval_status === "approved") type = "approved";
      else if (r.approval_status === "pending" || r.approval_status === "submitted") type = "review_request";
      else if (r.status === "개통완료") type = "activation";
      return {
        id: r.id,
        type,
        title:
          type === "approved"
            ? `${r.customer_name ?? "고객"} 검수 승인`
            : type === "review_request"
              ? `${r.customer_name ?? "고객"} 검수요청`
              : `${r.customer_name ?? "고객"} 신규 개통`,
        subtitle: r.device_model ?? "—",
        at: r.updated_at ?? r.created_at,
        manager: r.manager,
      };
    });
    setItems(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dashboard-live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    const interval = setInterval(load, 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="glass rounded-xl p-3 shadow-card-elevated flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
          <Activity className="size-4 text-primary" />
          실시간 활동 피드
        </h3>
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/30 font-bold">
          <Radio className="size-2.5 animate-pulse" />
          LIVE
        </span>
      </div>

      <div className="relative">
        <div className="absolute left-[11px] top-1 bottom-1 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
        <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1.5">
          {loading ? (
            <li className="text-xs text-muted-foreground py-4 text-center">불러오는 중…</li>
          ) : items.length === 0 ? (
            <li className="text-xs text-muted-foreground py-4 text-center">최근 활동이 없습니다</li>
          ) : (
            items.map((it) => {
              const cfg = ICONS[it.type];
              const Icon = cfg.Icon;
              return (
                <li key={it.id} className="relative pl-7 py-1 animate-fade-in">
                  <div
                    className="absolute left-0 top-1 size-6 rounded-full grid place-items-center ring-2 ring-background"
                    style={{ background: cfg.glow, boxShadow: `0 0 8px ${cfg.glow}` }}
                  >
                    <Icon className="size-3" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
                          style={{ background: cfg.glow, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                        <span className="font-semibold text-xs truncate">{it.title}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {it.subtitle}
                        {it.manager ? ` · ${it.manager}` : ""}
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums whitespace-nowrap">{fmtTime(it.at)}</span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

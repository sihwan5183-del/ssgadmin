import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Bell, FileEdit, FilePlus2, RefreshCw, Briefcase } from "lucide-react";

type Notif = {
  id: string;
  kind: string;
  title: string;
  message: string | null;
  link: string | null;
  created_at: string;
  metadata: any;
};

const KIND_ICON: Record<string, { Icon: any; color: string; glow: string }> = {
  sale_created: { Icon: FilePlus2, color: "hsl(158 65% 45%)", glow: "hsl(158 65% 45% / 0.3)" },
  sale_updated: { Icon: FileEdit, color: "hsl(38 92% 55%)", glow: "hsl(38 92% 55% / 0.3)" },
  sale_re_review: { Icon: RefreshCw, color: "hsl(330 100% 55%)", glow: "hsl(330 100% 55% / 0.3)" },
};

const PLANNER_KINDS = ["sale_created", "sale_updated", "sale_re_review"];

const fmt = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

/**
 * 기획팀 전용 업무 알림 피드
 * - 본인 수신 알림(notifications) 중 sale_created / sale_updated / sale_re_review 만 필터
 * - Realtime 구독으로 즉시 갱신
 */
export const PlannerFeed = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id,kind,title,message,link,created_at,metadata")
      .eq("recipient_id", user.id)
      .in("kind", PLANNER_KINDS)
      .order("created_at", { ascending: false })
      .limit(40);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("planner-feed-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          if (PLANNER_KINDS.includes(n.kind)) {
            setItems((prev) => [n, ...prev].slice(0, 40));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // 기획팀/관리자가 아니면 노출하지 않음
  if (!isAdmin) return null;

  return (
    <div className="glass rounded-xl p-3 shadow-card-elevated flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
          <Briefcase className="size-4 text-primary" />
          기획팀 업무 알림
        </h3>
        <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30 font-bold">
          <Bell className="size-2.5 animate-pulse" />
          PLANNER
        </span>
      </div>

      <div>
        <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {loading ? (
            <li className="text-sm text-muted-foreground py-8 text-center">불러오는 중…</li>
          ) : items.length === 0 ? (
            <li className="text-sm text-muted-foreground py-8 text-center">처리할 신규 업무가 없습니다 ✨</li>
          ) : (
            items.map((it) => {
              const cfg = KIND_ICON[it.kind] ?? KIND_ICON.sale_updated;
              const Icon = cfg.Icon;
              const Wrap: any = it.link ? Link : "div";
              const wrapProps = it.link ? { to: it.link } : {};
              return (
                <li key={it.id}>
                  <Wrap
                    {...wrapProps}
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-colors group cursor-pointer"
                  >
                    <div
                      className="size-8 rounded-lg grid place-items-center shrink-0"
                      style={{ background: cfg.glow }}
                    >
                      <Icon className="size-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{it.title}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                          {fmt(it.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{it.message}</div>
                    </div>
                  </Wrap>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
};

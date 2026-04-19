import { Bell, FileText, ArrowRightLeft, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, React.ElementType> = {
  document_uploaded: FileText,
  transfer_pending: ArrowRightLeft,
};

export const NotificationBell = () => {
  const { items, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: typeof items[number]) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full glass relative">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 glass-strong border-border/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="font-semibold text-sm">알림 {unreadCount > 0 && <span className="text-primary-glow ml-1">({unreadCount})</span>}</div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              <CheckCheck className="size-3.5 mr-1" /> 모두 읽음
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">새 알림이 없습니다</div>
          ) : (
            items.map((n) => {
              const Icon = KIND_ICON[n.kind] ?? Bell;
              const unread = !n.read_at;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border/30 hover:bg-muted/40 transition-colors",
                    unread && "bg-primary/5",
                  )}
                >
                  <div className={cn(
                    "size-8 rounded-lg grid place-items-center shrink-0",
                    unread ? "bg-primary/15 text-primary-glow" : "bg-muted/40 text-muted-foreground",
                  )}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {n.title}
                      {unread && <span className="size-1.5 rounded-full bg-primary-glow" />}
                    </div>
                    {n.message && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString("ko-KR", {
                        month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

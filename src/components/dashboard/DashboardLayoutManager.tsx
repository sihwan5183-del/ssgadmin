import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LayoutGrid, RotateCcw } from "lucide-react";
import { useDashboardLayout, type WidgetConfig } from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";

export const DashboardLayoutManager = ({
  widgets,
  toggle,
  move,
  resetToDefault,
}: {
  widgets: WidgetConfig[];
  toggle: (id: string) => void;
  move: (id: string, dir: -1 | 1) => void;
  resetToDefault: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const visibleCount = widgets.filter((w) => w.visible).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <LayoutGrid className="size-3.5" />
          위젯 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutGrid className="size-4 text-primary" />
            대시보드 레이아웃 관리
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            위젯의 표시 여부와 순서를 관리합니다 · {visibleCount}/{widgets.length}개 표시 중
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1 py-2">
          {widgets.map((w, idx) => (
            <div
              key={w.id}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors",
                w.visible
                  ? "border-border/60 bg-card"
                  : "border-border/30 bg-muted/30 opacity-60"
              )}
            >
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(w.id, -1)}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
                >▲</button>
                <button
                  type="button"
                  onClick={() => move(w.id, 1)}
                  disabled={idx === widgets.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-[10px] leading-none"
                >▼</button>
              </div>
              <span className="text-xs font-semibold flex-1">{w.label}</span>
              <Switch
                checked={w.visible}
                onCheckedChange={() => toggle(w.id)}
                className="scale-75"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={resetToDefault}>
            <RotateCcw className="size-3" /> 초기화
          </Button>
          <Button size="sm" className="text-xs" onClick={() => setOpen(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
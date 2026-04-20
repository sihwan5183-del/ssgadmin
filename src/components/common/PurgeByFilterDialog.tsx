import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export interface PurgeFilter {
  /** Supabase 테이블명 */
  table: "sales" | "inquiries" | "profiles" | "device_inventory" | "ad_spend" | "regulars";
  /** WHERE 조건. {column: {op, value}} 형태. op = eq | gte | lte | in */
  filters: Array<{ column: string; op: "eq" | "gte" | "lte" | "in"; value: any }>;
  /** 사용자가 보게 될 필터 요약 (예: "기간 2026-03-01 ~ 2026-03-31") */
  summary: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filter: PurgeFilter | null;
  onDone?: () => void;
}

/**
 * admin 전용 - 현재 적용된 필터 조건에 해당하는 데이터를 통째로 삭제.
 * 1) 영향 건수 미리 표시
 * 2) "삭제" 단어 직접 입력해야 실행
 * 3) Edge function bulk-purge 호출 (서버측 admin 재검증)
 */
export function PurgeByFilterDialog({ open, onOpenChange, filter, onDone }: Props) {
  const { isAdmin } = useRole();
  const [confirmText, setConfirmText] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [executing, setExecuting] = useState(false);

  // 다이얼로그 열릴 때 영향 건수 미리 SELECT count(*)
  useEffect(() => {
    if (!open || !filter) {
      setCount(null);
      setConfirmText("");
      return;
    }
    (async () => {
      setCounting(true);
      let q = supabase.from(filter.table).select("*", { count: "exact", head: true });
      for (const f of filter.filters) {
        // @ts-ignore - dynamic op chain
        q = (q as any)[f.op](f.column, f.value);
      }
      const { count: c, error } = await q;
      setCounting(false);
      if (error) {
        toast.error("건수 조회 실패: " + error.message);
        setCount(0);
        return;
      }
      setCount(c ?? 0);
    })();
  }, [open, filter]);

  if (!isAdmin) return null;

  const canExecute = confirmText === "삭제" && (count ?? 0) > 0 && !executing;

  const execute = async () => {
    if (!filter) return;
    setExecuting(true);
    const { data, error } = await supabase.functions.invoke("bulk-purge", {
      body: { table: filter.table, filters: filter.filters },
    });
    setExecuting(false);
    if (error || (data as any)?.error) {
      toast.error("삭제 실패: " + (error?.message || (data as any)?.error));
      return;
    }
    toast.success(`${(data as any)?.deleted ?? 0}건이 삭제되었습니다`);
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            조건에 맞는 데이터 전체 삭제
          </DialogTitle>
          <DialogDescription>
            현재 필터 조건에 부합하는 모든 데이터를 영구적으로 삭제합니다. 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-destructive" />
              <span className="font-medium">대상 테이블</span>
              <Badge variant="outline" className="font-mono">{filter?.table ?? "-"}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">조건:</span> {filter?.summary ?? "-"}
            </div>
            <div className="pt-2 border-t border-destructive/20">
              <div className="text-xs text-muted-foreground">영향 건수</div>
              <div className="text-3xl font-bold text-destructive tabular-nums">
                {counting ? "…" : (count ?? 0).toLocaleString("ko-KR")}
                <span className="text-base text-muted-foreground ml-1">건</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">
              안전 확인을 위해 아래에 <span className="text-destructive font-bold">삭제</span> 라고 정확히 입력하세요
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="삭제"
              className="mt-1.5 font-mono"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={executing}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={execute}
            disabled={!canExecute}
          >
            {executing ? "삭제 중…" : `${(count ?? 0).toLocaleString("ko-KR")}건 영구 삭제`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

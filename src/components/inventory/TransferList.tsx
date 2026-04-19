import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useStores } from "@/hooks/useStores";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Transfer {
  id: string;
  device_id: string;
  from_store_id: string | null;
  to_store_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  requested_by: string;
  requested_at: string;
  approved_at: string | null;
  device?: { model: string; serial_no: string | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "반려",
  cancelled: "취소",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  cancelled: "outline",
};

export const TransferList = () => {
  const { byId } = useStores();
  const { isAdmin } = useRole();
  const { user } = useAuth();
  const [rows, setRows] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("device_transfers")
      .select("id, device_id, from_store_id, to_store_id, status, reason, requested_by, requested_at, approved_at, device:device_inventory(model, serial_no)")
      .order("requested_at", { ascending: false })
      .limit(50);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("transfers-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_transfers" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    if (!user) return;
    const { error } = await supabase
      .from("device_transfers")
      .update({ status, approved_by: user.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "이동이 승인되었습니다" : "이동이 반려되었습니다");
    load();
  };

  return (
    <Card className="p-4 glass border-border/40">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">매장 간 이동 이력</h3>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="size-3.5 mr-1" /> 새로고침
        </Button>
      </div>
      {loading ? (
        <div className="text-center text-muted-foreground py-6 text-sm">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-muted-foreground py-6 text-sm">이동 이력이 없습니다</div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {rows.map((t) => {
            const from = byId(t.from_store_id)?.name ?? "(미지정)";
            const to = byId(t.to_store_id)?.name ?? "(미지정)";
            return (
              <div
                key={t.id}
                className="p-3 rounded-lg border border-border/40 bg-card/40 flex items-center gap-3 text-sm"
              >
                <Badge variant={STATUS_VARIANT[t.status]} className="shrink-0">
                  {STATUS_LABEL[t.status]}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {t.device?.model ?? "(삭제된 단말)"} ·{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {t.device?.serial_no ?? "-"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span>{from}</span>
                    <ArrowRight className="size-3" />
                    <span>{to}</span>
                    {t.reason && <span className="ml-2 italic">"{t.reason}"</span>}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(t.requested_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                {t.status === "pending" && isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => decide(t.id, "approved")}>
                      <CheckCircle2 className="size-3.5 mr-1" /> 승인
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(t.id, "rejected")}>
                      <XCircle className="size-3.5 mr-1 text-destructive" /> 반려
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

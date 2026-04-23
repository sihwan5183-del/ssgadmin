import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertOctagon, Edit3, ChevronRight, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface AlertSale {
  id: string;
  customer_name: string | null;
  device_model: string | null;
  approval_status: string;
  revision_reason: string | null;
  revision_fields: string[] | null;
  revision_requested_at: string | null;
}

/**
 * 직원 본인의 '반려' / '수정요청' 실적을 빨간 배너로 강조하는 대시보드 위젯.
 * 본인이 만든 실적이 위 두 상태일 때만 렌더링됩니다.
 */
export function MyReviewAlerts() {
  const { user } = useAuth();
  const [items, setItems] = useState<AlertSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, customer_name, device_model, approval_status, revision_reason, revision_fields, revision_requested_at")
        .eq("created_by", user.id)
        .in("approval_status", ["반려", "수정요청"])
        .order("revision_requested_at", { ascending: false, nullsFirst: false })
        .limit(10);
      if (cancelled) return;
      setItems((data ?? []) as AlertSale[]);
      setLoading(false);
    };
    load();
    // realtime: re-load on any change to my sales
    const ch = supabase
      .channel("my-review-alerts")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "sales",
        filter: `created_by=eq.${user.id}`,
      }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  if (loading || items.length === 0) return null;

  return (
    <Card className="mb-6 p-5 border-destructive/40 bg-gradient-to-r from-destructive/15 via-destructive/[0.06] to-transparent relative overflow-hidden">
      <div className="absolute -right-6 -top-6 size-32 rounded-full bg-destructive/10 blur-2xl pointer-events-none" />
      <div className="flex items-start gap-3 relative">
        <div className="size-10 rounded-xl bg-destructive/20 grid place-items-center shrink-0">
          <AlertOctagon className="size-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-destructive">검수 피드백이 도착했어요</h3>
            <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/10">
              {items.length}건 조치 필요
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            아래 실적은 <b className="text-orange-700">수정요청</b> 또는 <b className="text-destructive">반려</b> 상태입니다. 클릭해서 수정 후 '재검수 요청' 버튼을 눌러주세요.
          </p>

          <ul className="mt-3 space-y-2">
            {items.map((it) => {
              const isRejected = it.approval_status === "반려";
              const Icon = isRejected ? XCircle : Edit3;
              const tone = isRejected
                ? "border-destructive/40 text-destructive bg-destructive/10"
                : "border-orange-400 text-orange-700 bg-orange-50";
              return (
                <li key={it.id}>
                  <Link
                    to={`/activities?sale=${it.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-card/40 hover:border-primary/40 hover:bg-card/70 transition-colors group"
                  >
                    <Badge variant="outline" className={`gap-1 ${tone} shrink-0`}>
                      <Icon className="size-3" /> {it.approval_status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {it.customer_name ?? "(이름없음)"}
                        {it.device_model && <span className="text-muted-foreground font-normal ml-2">· {it.device_model}</span>}
                      </div>
                      {it.revision_reason && (
                        <div className="text-xs text-orange-200/80 truncate mt-0.5">
                          사유: {it.revision_reason}
                        </div>
                      )}
                      {it.revision_fields && it.revision_fields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.revision_fields.slice(0, 4).map((f) => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded border border-orange-300 text-orange-700">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-3">
            <Button asChild variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <Link to="/activities">활동 관리에서 전체 보기 →</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

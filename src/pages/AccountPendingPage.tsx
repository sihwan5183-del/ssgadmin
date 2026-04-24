import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Mail, Phone, Calendar } from "lucide-react";

interface Pending {
  user_id: string;
  display_name: string;
  phone: string | null;
  team: string | null;
  store: string | null;
  position: string | null;
  created_at: string;
}

export default function AccountPendingPage() {
  const [list, setList] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, team, store, position, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setList((data ?? []) as Pending[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const act = async (user_id: string, action: "approve_user" | "set_status", extra: Record<string, unknown> = {}) => {
    setBusy(user_id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action, user_id, ...extra },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      toast.success(action === "approve_user" ? "승인되었습니다" : "처리되었습니다");
      refresh();
    } catch (e) { toast.error("실패", { description: (e as Error).message }); }
    finally { setBusy(null); }
  };

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중…</div>;
  if (list.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        승인 대기 중인 직원이 없습니다.
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {list.map((p) => (
        <Card key={p.user_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold">{p.display_name}</div>
              <Badge variant="secondary">대기</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {p.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{p.phone}</span>}
              {p.store && <span>매장: {p.store}</span>}
              {p.team && <span>팀: {p.team}</span>}
              {p.position && <span>직급: {p.position}</span>}
              <span className="flex items-center gap-1"><Calendar className="size-3" />{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => act(p.user_id, "approve_user")} disabled={busy === p.user_id}>
              <Check className="size-4 mr-1" /> 승인
            </Button>
            <Button size="sm" variant="outline" onClick={() => act(p.user_id, "set_status", { status: "resigned" })} disabled={busy === p.user_id}>
              <X className="size-4 mr-1" /> 거절
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

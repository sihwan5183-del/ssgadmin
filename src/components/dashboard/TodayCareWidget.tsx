import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ShieldAlert, ChevronRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface PlanRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  sale_type: string | null;
  plan_change_due_date: string;
}
interface AddonRow {
  id: string;
  addon_name: string;
  due_date: string;
  sales: { customer_name: string | null; phone: string | null } | null;
}

export const TodayCareWidget = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: a }] = await Promise.all([
      (supabase as any).from("sales")
        .select("id, customer_name, phone, sale_type, plan_change_due_date")
        .lte("plan_change_due_date", today)
        .is("plan_change_completed_at", null)
        .order("plan_change_due_date", { ascending: false })
        .limit(20),
      (supabase as any).from("sales_addon_tasks")
        .select("id, addon_name, due_date, sales:sale_id(customer_name, phone)")
        .lte("due_date", today)
        .is("completed_at", null)
        .order("due_date", { ascending: false })
        .limit(20),
    ]);
    setPlans((p ?? []) as PlanRow[]);
    setAddons((a ?? []) as AddonRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch1 = (supabase as any).channel("today-care-sales")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_addon_tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch1); };
  }, []);

  const total = plans.length + addons.length;

  return (
    <Card className="p-4 glass">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">오늘의 관리 고객</h3>
          <Badge variant="outline" className="text-[10px]">
            {loading ? "…" : `${total}건`}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Link to="/plan-change-calendar" className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
            요금제 <ChevronRight className="size-3" />
          </Link>
          <Link to="/addon-tasks" className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
            부가서비스 <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>

      {!loading && total === 0 && (
        <div className="py-8 text-center text-xs text-muted-foreground">
          오늘 처리할 요금제 변경 / 부가서비스 해지 대상이 없습니다 ✓
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {plans.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <CalendarClock className="size-3" /> 요금제 변경 대상 ({plans.length})
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {plans.map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/40 border border-border/40 text-xs">
                  <span className="font-medium flex-1 truncate">{r.customer_name ?? "-"}</span>
                  <Badge variant="outline" className="text-[10px]">{r.sale_type ?? "-"}</Badge>
                  {r.phone && <a href={`tel:${r.phone}`} className="text-muted-foreground hover:text-primary"><Phone className="size-3" /></a>}
                  <span className="text-[10px] text-muted-foreground font-mono">{r.plan_change_due_date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {addons.length > 0 && (
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <ShieldAlert className="size-3" /> 부가서비스 해지 대상 ({addons.length})
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {addons.map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background/40 border border-border/40 text-xs">
                  <span className="font-medium flex-1 truncate">{t.sales?.customer_name ?? "-"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{t.addon_name}</Badge>
                  {t.sales?.phone && <a href={`tel:${t.sales.phone}`} className="text-muted-foreground hover:text-primary"><Phone className="size-3" /></a>}
                  <span className="text-[10px] text-muted-foreground font-mono">{t.due_date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

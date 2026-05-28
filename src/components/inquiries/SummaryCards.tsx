import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InquiryRow {
  id: string;
  inquiry_date: string;
  channel: string;
  customer_name: string | null;
  birth_date: string | null;
  phone: string | null;
  content: string | null;
  manager: string | null;
  status: string;
  note: string | null;
  retry_at: string | null;
  fail_reason: string | null;
  last_action_at: string | null;
  created_by: string;
  created_at: string;
}

const isNewLead = (r: InquiryRow): boolean => {
  if (r.status === "미처리") return true;
  if (r.status === "문의중" && !r.last_action_at && !r.note && !r.content) return true;
  return false;
};

export function SummaryCards({ rows }: { rows: InquiryRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = rows.filter((r) => r.inquiry_date === today);
  const untreated = rows.filter(isNewLead).length;
  const todayUntreated = todayRows.filter(isNewLead).length;
  const absent = rows.filter((r) => r.status === "부재").length;
  const recare = rows.filter((r) => r.status === "재케어").length;

  const cards = [
    { label: "오늘 인입", value: todayRows.length, unit: "건", color: "text-foreground" },
    { label: "미처리", value: untreated, unit: "건", color: "text-orange-600" },
    { label: "오늘 신규 미처리", value: todayUntreated, unit: "건", color: "text-orange-600" },
    { label: "부재", value: absent, unit: "건", color: "text-amber-400" },
    { label: "재케어", value: recare, unit: "건", color: "text-blue-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="glass border-border/40 p-4">
          <div className="text-[11px] text-muted-foreground">{c.label}</div>
          <div className={cn("text-2xl font-bold tabular-nums mt-1", c.color)}>
            {c.value.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">{c.unit}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

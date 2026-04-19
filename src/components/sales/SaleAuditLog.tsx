import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

interface Props {
  saleId: string;
}

interface AuditRow {
  id: string;
  changed_by: string | null;
  changed_at: string;
  action: string;
  changes: Record<string, { old: unknown; new: unknown } | unknown>;
}

interface ProfileMap {
  [userId: string]: string;
}

const FIELD_LABELS: Record<string, string> = {
  customer_name: "고객명",
  phone: "전화번호",
  device_serial: "단말기 일련번호",
  device_model: "단말기 모델",
  channel: "채널",
  product: "상품",
  rate_plan: "요금제",
  status: "상태",
  unit_price: "단가",
  net_fee: "순수익",
  open_date: "개통일",
  manager: "담당자",
  note: "메모",
};

const fmt = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "예" : "아니오";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

export const SaleAuditLog = ({ saleId }: Props) => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales_audit_log")
        .select("*")
        .eq("sale_id", saleId)
        .order("changed_at", { ascending: false })
        .limit(50);
      const list = (data ?? []) as AuditRow[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        const map: ProfileMap = {};
        (ps ?? []).forEach((p: any) => (map[p.user_id] = p.display_name));
        setProfiles(map);
      }
      setLoading(false);
    };
    load();
  }, [saleId]);

  if (loading) return <div className="text-center text-sm text-muted-foreground py-4">불러오는 중…</div>;
  if (rows.length === 0)
    return <div className="text-center text-sm text-muted-foreground py-4">변경 이력이 없습니다</div>;

  return (
    <ul className="space-y-3 max-h-80 overflow-y-auto">
      {rows.map((r) => {
        const who = (r.changed_by && profiles[r.changed_by]) || "시스템";
        const when = new Date(r.changed_at).toLocaleString("ko-KR");
        const isUpdate = r.action === "UPDATE";
        return (
          <li key={r.id} className="p-3 rounded-lg border border-border/40 bg-card/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <History className="size-3" />
              <span className="font-medium text-foreground">{who}</span>
              <span>·</span>
              <span>{when}</span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-muted/60 text-[10px]">{r.action}</span>
            </div>
            {isUpdate ? (
              <ul className="space-y-1 text-xs">
                {Object.entries(r.changes as Record<string, { old: unknown; new: unknown }>).map(
                  ([key, diff]) => (
                    <li key={key} className="flex items-start gap-2">
                      <span className="text-muted-foreground min-w-[80px]">
                        {FIELD_LABELS[key] ?? key}
                      </span>
                      <span className="line-through text-destructive/80">{fmt(diff.old)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-success font-medium">{fmt(diff.new)}</span>
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <div className="text-xs text-muted-foreground">
                {r.action === "INSERT" ? "신규 등록" : "삭제됨"}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { StaffDetailDialog } from "@/components/admin/accounts/StaffDetailDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Row {
  user_id: string;
  display_name: string;
  phone: string | null;
  team: string | null;
  store: string | null;
  position: string | null;
  status: string;
  hire_date: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "정상", variant: "default" },
  pending: { label: "대기", variant: "secondary" },
  suspended: { label: "정지", variant: "destructive" },
  leave: { label: "휴직", variant: "outline" },
  resigned: { label: "퇴사", variant: "outline" },
};

export default function AccountStaffPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<{ id: string; email: string | null } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, team, store, position, status, hire_date, created_at")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!ql) return true;
      return [r.display_name, r.phone, r.team, r.store, r.position]
        .filter(Boolean).join(" ").toLowerCase().includes(ql);
    });
  }, [rows, q, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·연락처·매장·팀·직급 검색" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">정상</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="suspended">정지</SelectItem>
            <SelectItem value="leave">휴직</SelectItem>
            <SelectItem value="resigned">퇴사</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground bg-muted/40">
                  <th className="text-left px-3 py-2">이름</th>
                  <th className="text-left px-3 py-2">매장</th>
                  <th className="text-left px-3 py-2">팀</th>
                  <th className="text-left px-3 py-2">직급</th>
                  <th className="text-left px-3 py-2">연락처</th>
                  <th className="text-left px-3 py-2">입사일</th>
                  <th className="text-left px-3 py-2">상태</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const s = STATUS_BADGE[r.status] ?? { label: r.status, variant: "outline" as const };
                  return (
                    <tr key={r.user_id} className="border-b border-border/30 hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.display_name}</td>
                      <td className="px-3 py-2">{r.store ?? "-"}</td>
                      <td className="px-3 py-2">{r.team ?? "-"}</td>
                      <td className="px-3 py-2">{r.position ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.phone ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.hire_date ?? "-"}</td>
                      <td className="px-3 py-2"><Badge variant={s.variant}>{s.label}</Badge></td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected({ id: r.user_id, email: emails[r.user_id] ?? null })}>상세</Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground text-sm">결과 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <StaffDetailDialog
        userId={selected?.id ?? null}
        email={selected?.email ?? null}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
        onChanged={refresh}
      />
    </div>
  );
}

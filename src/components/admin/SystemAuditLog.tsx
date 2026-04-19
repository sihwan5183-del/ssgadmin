import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { History, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Source = "all" | "sales" | "master";

interface UnifiedRow {
  id: string;
  source: "sales" | "master";
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_by_name?: string;
  changed_at: string;
  changes: Record<string, unknown>;
}

const TABLE_LABEL: Record<string, string> = {
  sales: "실적",
  field_options: "입력 항목 옵션",
  product_rate_plans: "상품-요금제",
  device_models: "휴대폰 모델",
  stores: "매장",
  app_settings: "앱 설정",
  field_definitions: "동적 필드",
};

const ACTION_META: Record<string, { className: string; icon: typeof Plus; label: string }> = {
  INSERT: { className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/40", icon: Plus, label: "추가" },
  UPDATE: { className: "bg-amber-500/10 text-amber-300 border-amber-500/40", icon: Pencil, label: "수정" },
  DELETE: { className: "bg-destructive/10 text-destructive border-destructive/40", icon: Trash2, label: "삭제" },
};

export const SystemAuditLog = () => {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<Source>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const merged: UnifiedRow[] = [];

    if (source === "all" || source === "sales") {
      const { data } = await supabase
        .from("sales_audit_log")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(200);
      (data ?? []).forEach((r: any) =>
        merged.push({
          id: `s_${r.id}`,
          source: "sales",
          table_name: "sales",
          record_id: r.sale_id,
          action: r.action,
          changed_by: r.changed_by,
          changed_at: r.changed_at,
          changes: r.changes ?? {},
        }),
      );
    }

    if (source === "all" || source === "master") {
      const { data } = await supabase
        .from("master_audit_log" as never)
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(200);
      ((data as any[]) ?? []).forEach((r: any) =>
        merged.push({
          id: `m_${r.id}`,
          source: "master",
          table_name: r.table_name,
          record_id: r.record_id,
          action: r.action,
          changed_by: r.changed_by,
          changed_at: r.changed_at,
          changes: r.changes ?? {},
        }),
      );
    }

    merged.sort(
      (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
    );

    // 사용자 이름 조회
    const userIds = Array.from(new Set(merged.map((r) => r.changed_by).filter(Boolean) as string[]));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
      merged.forEach((r) => {
        if (r.changed_by) r.changed_by_name = nameMap.get(r.changed_by);
      });
    }

    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const tables = useMemo(() => {
    const set = new Set(rows.map((r) => r.table_name));
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
      if (!q) return true;
      return (
        r.table_name.toLowerCase().includes(q) ||
        (r.changed_by_name ?? "").toLowerCase().includes(q) ||
        JSON.stringify(r.changes).toLowerCase().includes(q)
      );
    });
  }, [rows, search, tableFilter]);

  return (
    <Card className="p-6 glass">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <History className="size-4 text-primary-glow" /> 시스템 로그
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            실적과 모든 마스터 데이터의 변경 이력을 통합 추적합니다 (최근 200건)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색…"
              className="h-9 pl-8 w-56 bg-input/60"
            />
          </div>
          <Select value={source} onValueChange={(v) => setSource(v as Source)}>
            <SelectTrigger className="w-32 h-9 bg-input/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="sales">실적</SelectItem>
              <SelectItem value="master">마스터</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-36 h-9 bg-input/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 테이블</SelectItem>
              {tables.map((t) => (
                <SelectItem key={t} value={t}>{TABLE_LABEL[t] ?? t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 overflow-hidden max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-10 text-muted-foreground">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">표시할 로그가 없습니다</div>
        ) : (
          <ul className="divide-y divide-border/30">
            {filtered.map((r) => {
              const meta = ACTION_META[r.action];
              const Icon = meta.icon;
              const changeKeys = Object.keys(r.changes);
              return (
                <li key={r.id} className="px-3 py-3 hover:bg-muted/20">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className={`gap-1 shrink-0 ${meta.className}`}>
                      <Icon className="size-3" /> {meta.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {TABLE_LABEL[r.table_name] ?? r.table_name}
                        </span>
                        {r.record_id && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{r.record_id.slice(0, 8)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {r.changed_by_name ?? (r.changed_by ? r.changed_by.slice(0, 8) : "시스템")}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(r.changed_at).toLocaleString("ko-KR")}
                        </span>
                      </div>

                      {r.action === "UPDATE" && changeKeys.length > 0 && (
                        <div className="mt-1.5 grid gap-1">
                          {changeKeys.slice(0, 5).map((k) => {
                            const v = r.changes[k] as { old?: unknown; new?: unknown };
                            return (
                              <div key={k} className="text-[11px] text-muted-foreground">
                                <span className="text-foreground/80 font-medium">{k}:</span>{" "}
                                <span className="line-through opacity-70">{JSON.stringify(v?.old) ?? "-"}</span>
                                {" → "}
                                <span className="text-emerald-300">{JSON.stringify(v?.new) ?? "-"}</span>
                              </div>
                            );
                          })}
                          {changeKeys.length > 5 && (
                            <div className="text-[10px] text-muted-foreground">
                              + {changeKeys.length - 5}개 필드 변경
                            </div>
                          )}
                        </div>
                      )}

                      {r.action !== "UPDATE" && (
                        <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                          {Object.entries(r.changes)
                            .slice(0, 4)
                            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
};

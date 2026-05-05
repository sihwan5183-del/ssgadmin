import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Crown, Medal, Users, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CatKey = "mobile" | "usim" | "second" | "internet" | "tvfree" | "smarthome" | "upsell";

const COLUMNS: { key: CatKey; label: string }[] = [
  { key: "mobile", label: "모바일" },
  { key: "usim", label: "USIM" },
  { key: "second", label: "2nd" },
  { key: "internet", label: "인터넷" },
  { key: "tvfree", label: "TV프리" },
  { key: "smarthome", label: "스마트홈" },
  { key: "upsell", label: "업셀" },
];

const classify = (product: string | null): CatKey | null => {
  const p = (product ?? "").trim();
  if (!p) return null;
  if (/맞춤|업셀|upsell/i.test(p)) return "upsell";
  if (/USIM|유심/i.test(p)) return "usim";
  if (/2nd|세컨/i.test(p)) return "second";
  if (/모바일|mobile/i.test(p)) return "mobile";
  if (/인터넷|internet|홈$|^홈/i.test(p)) return "internet";
  if (/TV/i.test(p)) return "tvfree";
  if (/스마트홈|IOT/i.test(p)) return "smarthome";
  return null;
};

type Row = {
  uid: string;
  name: string;
  store: string;
  counts: Record<CatKey, number>;
  total: number;
};

export const StaffPerformanceMatrix = () => {
  const { startDate, endDate, label } = usePeriod();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [salesRes, profilesRes] = await Promise.all([
      supabase
        .from("sales")
        .select("created_by, manager, product, custom_fields")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .neq("status", "취소")
        .limit(20000),
      supabase
        .from("profiles")
        .select("user_id, display_name, store, status, show_in_dashboard")
        .eq("status", "active")
        .eq("show_in_dashboard", true),
    ]);

    const profiles = profilesRes.data ?? [];
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    const byName = new Map<string, string>();
    profiles.forEach((p) =>
      byName.set((p.display_name || "").trim().toLowerCase(), p.user_id),
    );

    const ownerOf = (s: any): string | null => {
      const m = (s.manager ?? "").trim();
      const ml = m.toLowerCase();
      if (m && byId.has(m)) return m;
      if (ml && byName.has(ml)) return byName.get(ml)!;
      return s.created_by ?? null;
    };

    const empty = (): Record<CatKey, number> => ({
      mobile: 0, usim: 0, second: 0, internet: 0, tvfree: 0, smarthome: 0, upsell: 0,
    });

    const map = new Map<string, Row>();
    // seed all active staff so 0건 직원도 노출
    profiles.forEach((p) => {
      map.set(p.user_id, {
        uid: p.user_id,
        name: p.display_name ?? "미지정",
        store: p.store ?? "-",
        counts: empty(),
        total: 0,
      });
    });

    (salesRes.data ?? []).forEach((s: any) => {
      const uid = ownerOf(s);
      if (!uid) return;
      const cur = map.get(uid) ?? {
        uid,
        name: byId.get(uid)?.display_name ?? (s.manager || "미지정"),
        store: byId.get(uid)?.store ?? "-",
        counts: empty(),
        total: 0,
      };
      const cat = classify(s.product);
      if (cat) {
        cur.counts[cat] += 1;
        cur.total += 1;
      }
      // 업셀 별도 체크 필드(custom_fields.upsell)도 합산
      const cf = s.custom_fields ?? {};
      const upsellFlag = cf?.upsell === true || cf?.is_upsell === true || cf?.업셀 === true;
      if (upsellFlag && cat !== "upsell") {
        cur.counts.upsell += 1;
      }
      map.set(uid, cur);
    });

    const arr = Array.from(map.values()).sort((a, b) => b.total - a.total);
    setRows(arr);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("staff_performance_matrix")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const maxTotal = useMemo(() => Math.max(1, ...rows.map((r) => r.total)), [rows]);

  return (
    <div className="rounded-2xl bg-card border border-border/60 shadow-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-base md:text-lg font-bold tracking-tight flex items-center gap-2">
            <Users className="size-4 text-primary" />
            개인별 실적 현황
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {label} 기준 · 상품 카테고리별 개통 건수 · 합계 내림차순
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          <ArrowUpDown className="size-3" /> {rows.length}명
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-10 text-center">데이터가 없습니다</div>
      ) : (
        <div className="overflow-auto -mx-1">
          <table className="w-full text-xs md:text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="text-left font-semibold px-2 py-2 sticky left-0 bg-card z-10">#</th>
                <th className="text-left font-semibold px-2 py-2 sticky left-8 bg-card z-10">직원명</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="text-right font-semibold px-2 py-2">{c.label}</th>
                ))}
                <th className="text-right font-bold px-2 py-2 text-foreground">합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const RankIcon = i === 0 ? Crown : i < 3 ? Medal : null;
                const rankColor =
                  i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "";
                const widthPct = (r.total / maxTotal) * 100;
                return (
                  <tr
                    key={r.uid}
                    className="border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/activities?manager=${encodeURIComponent(r.name)}`)}
                  >
                    <td className="px-2 py-2 tabular-nums text-muted-foreground sticky left-0 bg-card group-hover:bg-muted/40 z-10">
                      {i + 1}
                    </td>
                    <td className="px-2 py-2 sticky left-8 bg-card group-hover:bg-muted/40 z-10">
                      <div className="flex items-center gap-1.5">
                        {RankIcon && <RankIcon className={cn("size-3.5", rankColor)} />}
                        <span
                          className={cn(
                            "font-semibold group-hover:text-primary transition-colors",
                            i < 3 && "text-foreground",
                          )}
                        >
                          {r.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{r.store}</span>
                      </div>
                    </td>
                    {COLUMNS.map((c) => {
                      const v = r.counts[c.key];
                      return (
                        <td
                          key={c.key}
                          className={cn(
                            "text-right px-2 py-2 tabular-nums",
                            v === 0 ? "text-muted-foreground/40" : "text-foreground font-medium",
                          )}
                        >
                          {v === 0 ? "–" : v}
                        </td>
                      );
                    })}
                    <td className="text-right px-2 py-2 tabular-nums">
                      <div className="inline-flex flex-col items-end gap-1 min-w-[60px]">
                        <span className={cn("font-bold", i < 3 ? "text-primary" : "text-foreground")}>
                          {r.total === 0 ? "–" : r.total}
                        </span>
                        {r.total > 0 && (
                          <div className="h-1 w-14 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-primary/60"
                              style={{ width: `${Math.max(widthPct, 4)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StaffPerformanceMatrix;
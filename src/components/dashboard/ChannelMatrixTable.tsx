import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

type Row = { channel: string; inflow: number; success: number; mobile: number; strategy: number };

export const ChannelMatrixTable = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [inqRes, salesRes, modelsRes] = await Promise.all([
      supabase
        .from("inquiries")
        .select("channel, status")
        .gte("inquiry_date", startDate)
        .lte("inquiry_date", endDate),
      supabase
        .from("sales")
        .select("channel, product, device_model, status")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .neq("status", "취소"),
      supabase.from("device_models").select("model_name, is_strategy").eq("is_strategy", true),
    ]);

    const strategySet = new Set<string>(
      (modelsRes.data ?? []).map((m: any) => String(m.model_name).toLowerCase()),
    );

    const map = new Map<string, Row>();
    const get = (ch: string) => {
      const key = ch || "(미지정)";
      if (!map.has(key)) map.set(key, { channel: key, inflow: 0, success: 0, mobile: 0, strategy: 0 });
      return map.get(key)!;
    };

    (inqRes.data ?? []).forEach((r: any) => {
      const row = get(r.channel ?? "");
      row.inflow += 1;
      const s = (r.status ?? "").trim();
      if (s === "성공" || s === "개통완료" || s === "개통 완료") row.success += 1;
    });

    (salesRes.data ?? []).forEach((r: any) => {
      const row = get(r.channel ?? "");
      if ((r.product ?? "") === "모바일") row.mobile += 1;
      const dm = String(r.device_model ?? "").toLowerCase();
      if (dm && strategySet.has(dm)) row.strategy += 1;
    });

    const arr = Array.from(map.values()).sort((a, b) => b.inflow - a.inflow || b.success - a.success);
    setRows(arr);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("channel_matrix_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inquiries" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      inflow: acc.inflow + r.inflow,
      success: acc.success + r.success,
      mobile: acc.mobile + r.mobile,
      strategy: acc.strategy + r.strategy,
    }),
    { inflow: 0, success: 0, mobile: 0, strategy: 0 },
  ), [rows]);
  const totalRate = totals.inflow > 0 ? Math.round((totals.success / totals.inflow) * 1000) / 10 : 0;

  return (
    <div className="glass rounded-2xl p-5 overflow-hidden">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold tracking-tight">인입 경로별 상세 매트릭스</h4>
          <p className="text-xs text-muted-foreground mt-0.5">경로별 인입·성공·전환·전략상품 한눈에 비교</p>
        </div>
        <div className="text-xs text-muted-foreground">
          평균 성공률 <span className="text-gradient font-bold text-sm">{totalRate}%</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-[11px] text-muted-foreground border-b border-border/40">
              <th className="text-left font-medium px-3 py-2.5">경로</th>
              <th className="text-right font-medium px-3 py-2.5">인입건수</th>
              <th className="text-right font-medium px-3 py-2.5">성공건수</th>
              <th className="text-right font-medium px-3 py-2.5">성공비중</th>
              <th className="text-right font-medium px-3 py-2.5">모바일</th>
              <th className="text-right font-medium px-3 py-2.5">전략상품</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rate = r.inflow > 0 ? Math.round((r.success / r.inflow) * 1000) / 10 : 0;
              const rateColor = rate >= 60 ? "text-success" : rate >= 45 ? "text-warning" : "text-destructive";
              return (
                <tr key={r.channel} className="border-b border-border/20 hover:bg-white/[0.03] transition-colors">
                  <td className="px-3 py-3">
                    <span className="font-medium">{r.channel}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.inflow.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold">{r.success.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full bg-gradient-primary rounded-full"
                          style={{ width: `${Math.min(100, rate)}%` }}
                        />
                      </div>
                      <span className={`tabular-nums font-semibold ${rateColor}`}>{rate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.mobile.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-primary/10 text-primary-glow text-xs tabular-nums font-semibold">
                      {r.strategy.toLocaleString("ko-KR")}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">선택한 기간에 인입/실적 데이터가 없습니다.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="text-sm">
              <td className="px-3 py-3 font-semibold">합계</td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold">{totals.inflow.toLocaleString("ko-KR")}</td>
              <td className="px-3 py-3 text-right tabular-nums font-bold text-gradient">{totals.success.toLocaleString("ko-KR")}</td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold">{totalRate}%</td>
              <td className="px-3 py-3 text-right tabular-nums">{totals.mobile.toLocaleString("ko-KR")}</td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold text-primary-glow">{totals.strategy.toLocaleString("ko-KR")}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

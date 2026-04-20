import { channelMatrix } from "@/data/performanceData";

export const ChannelMatrixTable = () => {
  const totals = channelMatrix.reduce(
    (acc, r) => ({
      inflow: acc.inflow + r.inflow,
      success: acc.success + r.success,
      mobile: acc.mobile + r.mobile,
      strategy: acc.strategy + r.strategy,
    }),
    { inflow: 0, success: 0, mobile: 0, strategy: 0 }
  );
  const totalRate = totals.inflow > 0 ? Math.round((totals.success / totals.inflow) * 100) : 0;

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
            {channelMatrix.map((r) => {
              const rate = r.inflow > 0 ? Math.round((r.success / r.inflow) * 100) : 0;
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
                          style={{ width: `${rate}%` }}
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

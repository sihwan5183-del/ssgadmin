import { subscriptionTypes, modelPolicyShare } from "@/data/performanceData";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export const MobileBreakdown = () => {
  const totalSub = subscriptionTypes.reduce((s, t) => s + t.count, 0);
  const totalModel = modelPolicyShare.reduce((s, m) => s + m.value, 0);
  const policyPct = totalModel > 0 ? Math.round((modelPolicyShare[0].value / totalModel) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 가입 유형별 */}
      <div className="glass rounded-2xl p-5 lg:col-span-2">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold tracking-tight">가입 유형별 실적</h4>
            <p className="text-xs text-muted-foreground mt-0.5">번호이동 · 신규 · 기변 구분</p>
          </div>
          <div className="text-xs text-muted-foreground">
            합계 <span className="text-foreground font-semibold tabular-nums">{totalSub}건</span>
          </div>
        </div>

        <div className="space-y-3">
          {subscriptionTypes.map((t) => {
            const pct = totalSub > 0 ? Math.round((t.count / totalSub) * 100) : 0;
            return (
              <div key={t.type}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="font-medium">{t.type}</span>
                    <span className="text-[11px] text-muted-foreground">{t.desc}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="text-muted-foreground text-xs">{pct}%</span>
                    <span className="font-semibold">{t.count}건</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${t.color}, ${t.color}aa)` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 정책 모델 비중 */}
      <div className="glass rounded-2xl p-5">
        <h4 className="text-base font-semibold tracking-tight">정책 모델 비중</h4>
        <p className="text-xs text-muted-foreground mt-0.5">전체 판매 기준</p>

        <div className="relative h-40 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={modelPolicyShare} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">
                {modelPolicyShare.map((m) => <Cell key={m.name} fill={m.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => `${v}건`}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">정책</div>
              <div className="text-xl font-bold text-gradient">{policyPct}%</div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-sm mt-2">
          {modelPolicyShare.map((m) => (
            <div key={m.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: m.color }} />
                <span>{m.name}</span>
              </div>
              <span className="tabular-nums text-muted-foreground">{m.value}건</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};


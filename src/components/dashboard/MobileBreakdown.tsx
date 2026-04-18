import { subscriptionTypes, modelPolicyShare, usimStats } from "@/data/performanceData";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowUpRight, Sim } from "lucide-react";

export const MobileBreakdown = () => {
  const totalSub = subscriptionTypes.reduce((s, t) => s + t.count, 0);
  const totalModel = modelPolicyShare.reduce((s, m) => s + m.value, 0);
  const policyPct = Math.round((modelPolicyShare[0].value / totalModel) * 100);

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
            const pct = Math.round((t.count / totalSub) * 100);
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

      {/* USIM 실적 */}
      <div className="glass rounded-2xl p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold tracking-tight">USIM 실적</h4>
            <p className="text-xs text-muted-foreground mt-0.5">유심 단독 개통 건수</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-success/10 text-success">
            <ArrowUpRight className="size-3" /> {usimStats.delta}%
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <UsimTile label="USIM MNP" value={usimStats.usimMnp} hint="번호이동" highlight />
          <UsimTile label="USIM 신규" value={usimStats.usimNew} hint="신규 가입" />
          <UsimTile label="USIM 합계" value={usimStats.total} hint="당월 누적" />
        </div>
      </div>
    </div>
  );
};

const UsimTile = ({ label, value, hint, highlight }: { label: string; value: number; hint: string; highlight?: boolean }) => (
  <div className={`rounded-xl p-4 border ${highlight ? "bg-gradient-soft border-primary/30" : "bg-card/40 border-border/40"}`}>
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Sim className="size-3.5" /> {label}
    </div>
    <div className="mt-2 text-2xl font-bold tabular-nums">{value}<span className="text-sm text-muted-foreground ml-1">건</span></div>
    <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
  </div>
);

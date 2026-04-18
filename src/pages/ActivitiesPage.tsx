import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Carrot, MapPin, Send, RefreshCw, ArrowUpRight } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { useViewScope } from "@/contexts/ViewScopeContext";

// 채널별 신규 단골 등록 데이터
const channelRegular = [
  { channel: "당근",     count: 124, delta: 18.4, color: "hsl(25 95% 60%)",  icon: Carrot,  desc: "당근마켓 단골 등록" },
  { channel: "플레이스", count:  86, delta: 12.1, color: "hsl(155 70% 55%)", icon: MapPin,  desc: "네이버 플레이스 단골" },
  { channel: "오프라인", count:  62, delta:  8.5, color: "hsl(220 75% 60%)", icon: Send,    desc: "현장 직접 등록" },
  { channel: "모요",     count:  41, delta: 22.7, color: "hsl(270 90% 65%)", icon: RefreshCw, desc: "모요 추천 등록" },
  { channel: "도그마루", count:  28, delta: -4.2, color: "hsl(320 90% 65%)", icon: RefreshCw, desc: "도그마루 가입자" },
  { channel: "지인소개", count:  19, delta: 35.0, color: "hsl(195 90% 60%)", icon: Send,    desc: "기존 고객 추천" },
];

// 개인 모드용 (현재 사용자 가정)
const personalChannelRegular = [
  { channel: "당근",     count: 14, delta: 16.0, color: "hsl(25 95% 60%)",  icon: Carrot,  desc: "당근마켓 단골 등록" },
  { channel: "플레이스", count:  9, delta:  8.0, color: "hsl(155 70% 55%)", icon: MapPin,  desc: "네이버 플레이스 단골" },
  { channel: "오프라인", count:  7, delta:  4.5, color: "hsl(220 75% 60%)", icon: Send,    desc: "현장 직접 등록" },
  { channel: "모요",     count:  4, delta: 18.0, color: "hsl(270 90% 65%)", icon: RefreshCw, desc: "모요 추천 등록" },
  { channel: "도그마루", count:  2, delta:  0.0, color: "hsl(320 90% 65%)", icon: RefreshCw, desc: "도그마루 가입자" },
  { channel: "지인소개", count:  3, delta: 50.0, color: "hsl(195 90% 60%)", icon: Send,    desc: "기존 고객 추천" },
];

// 최근 단골 등록 로그
const regularLog = [
  { who: "이서연", channel: "당근",     customer: "김OO 고객", when: "2분 전" },
  { who: "박지호", channel: "플레이스", customer: "박OO 고객", when: "11분 전" },
  { who: "정유진", channel: "오프라인", customer: "정OO 고객 외 3명", when: "27분 전" },
  { who: "최도윤", channel: "당근",     customer: "최OO 고객", when: "44분 전" },
  { who: "한소율", channel: "모요",     customer: "한OO 고객", when: "1시간 전" },
  { who: "김민준", channel: "당근",     customer: "김OO 고객 외 2명", when: "1시간 전" },
  { who: "윤재희", channel: "플레이스", customer: "윤OO 고객", when: "2시간 전" },
];

const couponSent = 1284;
const conversion = 73;

const channelMeta: Record<string, { color: string; bg: string }> = {
  당근:     { color: "text-orange-300",  bg: "bg-orange-500/10 border-orange-500/30" },
  플레이스: { color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" },
  오프라인: { color: "text-blue-300",    bg: "bg-blue-500/10 border-blue-500/30" },
  모요:     { color: "text-primary-glow", bg: "bg-primary/10 border-primary/30" },
  도그마루: { color: "text-pink-300",    bg: "bg-pink-500/10 border-pink-500/30" },
  지인소개: { color: "text-cyan-300",    bg: "bg-cyan-500/10 border-cyan-500/30" },
};

const ActivitiesPage = () => {
  const { scope } = useViewScope();
  const data = scope === "personal" ? personalChannelRegular : channelRegular;
  const totalRegular = data.reduce((s, c) => s + c.count, 0);
  const topChannel = [...data].sort((a, b) => b.count - a.count)[0];

  return (
    <>
      <Header
        title="활동 관리"
        subtitle={scope === "personal" ? "내가 등록한 단골·쿠폰·전환 현황" : "팀 전체 단골·쿠폰·전환 현황"}
      />

      {/* 상단 KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="신규 단골 합계" value={totalRegular} icon={Carrot} color="from-primary/30 to-secondary/10 text-primary-glow" suffix="명" />
        <KpiCard label="최다 채널" value={topChannel.channel} icon={MapPin} color="from-orange-400/30 to-amber-500/10 text-orange-300" hint={`${topChannel.count}명 등록`} />
        <KpiCard label="쿠폰 발송" value={scope === "personal" ? 142 : couponSent} icon={Send} color="from-blue-400/30 to-cyan-500/10 text-blue-300" suffix="건" />
        <KpiCard label="자사 전환" value={scope === "personal" ? 8 : conversion} icon={RefreshCw} color="from-pink-400/30 to-fuchsia-500/10 text-pink-300" suffix="건" />
      </section>

      {/* 채널별 단골 등록 — 핵심 섹션 */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* 차트 */}
        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h4 className="text-base font-semibold tracking-tight">채널별 신규 단골 등록</h4>
              <p className="text-xs text-muted-foreground mt-0.5">어떤 경로에서 단골이 늘고 있는지 한눈에 확인</p>
            </div>
            <span className="text-[11px] text-muted-foreground">단위: 명</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  contentStyle={{
                    background: "hsl(240 18% 8% / 0.95)",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12, fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}명`, "신규 단골"]}
                />
                <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                  {data.map((d) => <Cell key={d.channel} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 채널별 카드 리스트 */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">채널별 상세</h4>
            <span className="text-[11px] text-muted-foreground">전월 대비</span>
          </div>
          <ul className="space-y-2">
            {data.map((c) => {
              const Icon = c.icon;
              const pct = Math.round((c.count / totalRegular) * 100);
              const positive = c.delta >= 0;
              return (
                <li key={c.channel} className="rounded-xl bg-card/40 border border-border/40 p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-9 rounded-lg grid place-items-center"
                      style={{ background: `${c.color}22`, color: c.color }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{c.channel}</span>
                        <span className="font-bold tabular-nums">{c.count}<span className="text-xs text-muted-foreground ml-1">명</span></span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{c.desc}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: c.color }} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-1.5 tabular-nums">
                        <span className="text-muted-foreground">{pct}%</span>
                        <span className={positive ? "text-success" : "text-destructive"}>
                          {positive ? "+" : ""}{c.delta.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 최근 활동 로그 */}
      <section className="glass rounded-2xl p-6 shadow-card-elevated">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">최근 단골 등록 활동</h3>
            <p className="text-xs text-muted-foreground mt-0.5">누가 · 어느 채널에서 · 어떤 고객을 등록했는지</p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">실시간</Badge>
        </div>
        <ul className="divide-y divide-border/40">
          {regularLog.map((a, i) => {
            const meta = channelMeta[a.channel];
            return (
              <li key={i} className="py-3 flex items-center gap-3">
                <div className={`text-[11px] font-medium px-2 py-1 rounded-md border ${meta.bg} ${meta.color}`}>
                  {a.channel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{a.who}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="text-muted-foreground">{a.customer} 단골 등록</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="size-3" />
                  {a.when}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
};

const KpiCard = ({
  label, value, icon: Icon, color, suffix, hint,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  hint?: string;
}) => (
  <div className="glass rounded-2xl p-5 shadow-card-elevated">
    <div className={`size-10 rounded-xl grid place-items-center bg-gradient-to-br ${color}`}>
      <Icon className="size-5" />
    </div>
    <div className="mt-4 text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-bold tabular-nums">
      {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
    </div>
    {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
  </div>
);

export default ActivitiesPage;

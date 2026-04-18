import { Header } from "@/components/layout/Header";
import { User, Users, Shield, Check } from "lucide-react";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { cn } from "@/lib/utils";

const scopes = [
  {
    key: "personal" as const,
    label: "개인 실적",
    icon: User,
    desc: "본인이 입력한 실적·활동·랭킹만 조회됩니다",
    permissions: ["내 실적 입력 / 수정", "내 활동 로그 조회", "본인 순위 확인"],
  },
  {
    key: "team" as const,
    label: "팀 전체 실적",
    icon: Users,
    desc: "영업기획팀 전체 실적과 분석 데이터를 모두 조회합니다",
    permissions: ["전사 실적·수익·지출 조회", "ROI · 마진율 분석", "전체 직원 랭킹 확인", "채널별 분석 모든 데이터"],
  },
];

const TeamPage = () => {
  const { scope, setScope } = useViewScope();

  return (
    <>
      <Header
        title="권한 / 뷰 설정"
        subtitle="개인 실적과 팀 전체 실적 중 원하는 데이터 범위를 선택하세요"
        showScopeToggle={false}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-4xl">
        {scopes.map((s) => {
          const Icon = s.icon;
          const active = scope === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cn(
                "text-left glass rounded-2xl p-6 shadow-card-elevated transition-all duration-300 group",
                active ? "ring-gradient -translate-y-0.5 shadow-elevated" : "hover:-translate-y-0.5"
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "size-12 rounded-2xl grid place-items-center transition-all",
                    active
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "bg-muted/60 text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  <Icon className="size-6" />
                </div>
                {active && (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary-glow flex items-center gap-1">
                    <Check className="size-3" /> 사용 중
                  </span>
                )}
              </div>

              <div className="mt-5 text-lg font-semibold">{s.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.desc}</div>

              <ul className="mt-4 space-y-1.5">
                {s.permissions.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="size-3 text-primary-glow" />
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-6 shadow-card-elevated max-w-4xl">
        <h3 className="text-lg font-semibold tracking-tight mb-4">팀 구성 (4팀 · 100명)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: "1팀", lead: "김팀장", count: 24 },
            { name: "2팀", lead: "이팀장", count: 21 },
            { name: "3팀", lead: "박팀장", count: 22 },
            { name: "4팀", lead: "최팀장", count: 33 },
          ].map((t) => (
            <div key={t.name} className="rounded-xl bg-card/40 border border-border/40 p-4">
              <div className="text-xs text-muted-foreground">{t.name}</div>
              <div className="mt-1 font-semibold">{t.lead}</div>
              <div className="mt-3 text-2xl font-bold text-gradient">
                {t.count}
                <span className="text-sm text-muted-foreground ml-1">명</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeamPage;

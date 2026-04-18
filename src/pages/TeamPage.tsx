import { Header } from "@/components/layout/Header";
import { Shield, User, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const roles = [
  { key: "staff", label: "일반 직원", icon: User, desc: "본인이 입력한 실적과 활동만 조회 가능", scope: "개인" },
  { key: "lead", label: "팀장", icon: Users, desc: "본인 팀의 실적·활동·랭킹 조회 가능", scope: "팀" },
  { key: "exec", label: "대표 / 기획팀", icon: Crown, desc: "전체 실적·ROI·매체 분석 등 모든 데이터 접근", scope: "전사" },
];

const TeamPage = () => {
  const [active, setActive] = useState("exec");
  return (
    <>
      <Header title="권한 / 팀 설정" subtitle="역할별로 다른 메뉴와 데이터 범위가 적용됩니다" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {roles.map((r) => {
          const Icon = r.icon;
          const on = active === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setActive(r.key)}
              className={cn(
                "text-left glass rounded-2xl p-5 shadow-card-elevated transition-all duration-300",
                on ? "ring-gradient -translate-y-0.5 shadow-elevated" : "hover:-translate-y-0.5"
              )}
            >
              <div className={cn(
                "size-11 rounded-xl grid place-items-center",
                on ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted/60 text-muted-foreground"
              )}>
                <Icon className="size-5" />
              </div>
              <div className="mt-4 text-base font-semibold">{r.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{r.desc}</div>
              <div className="mt-3 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary-glow">
                <Shield className="size-3" /> 데이터 범위: {r.scope}
              </div>
            </button>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-6 shadow-card-elevated">
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
              <div className="mt-3 text-2xl font-bold text-gradient">{t.count}<span className="text-sm text-muted-foreground ml-1">명</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TeamPage;

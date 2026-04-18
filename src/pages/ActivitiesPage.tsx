import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Carrot, MapPin, Send, RefreshCw } from "lucide-react";

const stats = [
  { label: "당근 단골", value: 248, icon: Carrot, color: "from-orange-400/30 to-amber-500/10 text-orange-300" },
  { label: "플레이스 단골", value: 162, icon: MapPin, color: "from-emerald-400/30 to-teal-500/10 text-emerald-300" },
  { label: "쿠폰 발송", value: 1284, icon: Send, color: "from-primary/30 to-secondary/10 text-primary-glow" },
  { label: "자사 전환", value: 73, icon: RefreshCw, color: "from-pink-400/30 to-fuchsia-500/10 text-pink-300" },
];

const ActivitiesPage = () => {
  return (
    <>
      <Header title="활동 관리" subtitle="단골 등록 · 쿠폰 · 자사 전환 현황" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5 shadow-card-elevated">
            <div className={`size-10 rounded-xl grid place-items-center bg-gradient-to-br ${s.color}`}>
              <s.icon className="size-5" />
            </div>
            <div className="mt-4 text-sm text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{s.value.toLocaleString("ko-KR")}</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-6 shadow-card-elevated">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold tracking-tight">최근 활동 로그</h3>
          <Badge variant="outline" className="border-primary/40 text-primary-glow">실시간</Badge>
        </div>
        <ul className="divide-y divide-border/40">
          {[
            { who: "이서연", what: "당근마켓 단골 등록 — '강남역 통신매장'", when: "2분 전" },
            { who: "박지호", what: "할인 쿠폰 발송 — 김OO 외 12명", when: "11분 전" },
            { who: "정유진", what: "자사 전환 완료 — KT 5G → 자사 시그니처", when: "27분 전" },
            { who: "최도윤", what: "플레이스 리뷰 답변 등록", when: "44분 전" },
            { who: "한소율", what: "신규 단골 8명 일괄 등록", when: "1시간 전" },
          ].map((a, i) => (
            <li key={i} className="py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{a.who}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.what}</div>
              </div>
              <div className="text-xs text-muted-foreground">{a.when}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default ActivitiesPage;

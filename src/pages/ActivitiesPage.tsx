import { Header } from "@/components/layout/Header";
import { SaleSearchPanel } from "@/components/sales/SaleSearchPanel";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { Link } from "react-router-dom";
import { HeartHandshake, ArrowRight } from "lucide-react";

const ActivitiesPage = () => {
  const { scope } = useViewScope();

  return (
    <>
      <Header
        title="활동 관리"
        subtitle={scope === "personal" ? "내가 등록한 실적·활동 현황" : "팀 전체 실적·활동 현황"}
      />

      {/* 실적 검색/수정 */}
      <SaleSearchPanel />

      {/* 단골 관리 → 별도 페이지 안내 */}
      <Link
        to="/regulars"
        className="glass rounded-2xl p-5 mb-6 flex items-center gap-4 hover:border-primary/40 transition-colors group"
      >
        <div className="size-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/10 grid place-items-center text-primary-glow">
          <HeartHandshake className="size-6" />
        </div>
        <div className="flex-1">
          <div className="font-semibold tracking-tight">채널별 단골 관리는 별도 페이지에서 확인하세요</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            등록 현황 차트 · 채널별 전환율 · 단골 등록 · 검색/필터를 한 화면에서
          </div>
        </div>
        <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary-glow transition-colors" />
      </Link>

      {/* 최근 활동 (실적 기준) */}
      <RecentActivities />
    </>
  );
};

export default ActivitiesPage;

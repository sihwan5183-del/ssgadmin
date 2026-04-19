import { Header } from "@/components/layout/Header";
import { SaleSearchPanel } from "@/components/sales/SaleSearchPanel";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { useViewScope } from "@/contexts/ViewScopeContext";

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

      {/* 최근 활동 (실적 기준) */}
      <RecentActivities />
    </>
  );
};

export default ActivitiesPage;

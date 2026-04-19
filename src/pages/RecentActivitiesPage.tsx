import { Header } from "@/components/layout/Header";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { useViewScope } from "@/contexts/ViewScopeContext";

const RecentActivitiesPage = () => {
  const { scope } = useViewScope();

  return (
    <>
      <Header
        title="최근 영업활동"
        subtitle={scope === "personal" ? "내 최근 실적 활동 타임라인" : "팀 전체 최근 실적 활동 타임라인"}
      />

      <RecentActivities />
    </>
  );
};

export default RecentActivitiesPage;

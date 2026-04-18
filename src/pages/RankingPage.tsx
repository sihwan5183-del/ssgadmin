import { Header } from "@/components/layout/Header";
import { RankingPanel } from "@/components/dashboard/RankingPanel";

const RankingPage = () => {
  return (
    <>
      <Header title="실적 랭킹" subtitle="팀별 / 개인별 순위" />
      <div className="max-w-3xl">
        <RankingPanel />
      </div>
    </>
  );
};

export default RankingPage;

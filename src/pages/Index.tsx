import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ChannelDonut } from "@/components/dashboard/ChannelDonut";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { RankingPanel } from "@/components/dashboard/RankingPanel";
import { PerformanceLedger } from "@/components/dashboard/PerformanceLedger";
import { summaryStats, formatShortKRW } from "@/data/mockData";
import { TrendingUp, Wallet, Target, UserPlus } from "lucide-react";

const Index = () => {
  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle="2025년 11월 · 100명의 영업 활동을 한 화면에서 분석합니다"
      />

      {/* 요약 카드 — Bento Top */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="당월 순이익"
          value={formatShortKRW(summaryStats.netProfit)}
          delta={summaryStats.netProfitDelta}
          icon={Wallet}
          accent="primary"
          hint="리베이트 − 오퍼 − 마케팅비"
        />
        <StatCard
          label="총 리베이트"
          value={formatShortKRW(summaryStats.totalRebate)}
          delta={summaryStats.totalRebateDelta}
          icon={TrendingUp}
          accent="secondary"
        />
        <StatCard
          label="마케팅 ROI"
          value={`${summaryStats.roi}%`}
          delta={summaryStats.roiDelta}
          icon={Target}
          accent="warning"
          hint="순이익 ÷ 광고비"
        />
        <StatCard
          label="신규 단골 등록"
          value={`${summaryStats.newRegulars}명`}
          delta={summaryStats.newRegularsDelta}
          icon={UserPlus}
          accent="success"
          hint="당근·플레이스 합산"
        />
      </section>

      {/* 차트 — Bento Mid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <ChannelDonut />
      </section>

      {/* 실적장표(건) 상세 분석 — 탭 */}
      <section className="mb-6">
        <PerformanceLedger />
      </section>

      {/* 활동 + 랭킹 — Bento Bottom */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <RecentActivities />
        </div>
        <div className="lg:col-span-2">
          <RankingPanel />
        </div>
      </section>
    </>
  );
};

export default Index;

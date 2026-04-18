import { useState } from "react";
import { Smartphone, Sparkles, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileBreakdown } from "./MobileBreakdown";
import { StrategyProductGauges } from "./StrategyProductGauges";
import { ChannelMatrixTable } from "./ChannelMatrixTable";

const tabs = [
  { key: "mobile", label: "모바일 상세", icon: Smartphone },
  { key: "strategy", label: "전략상품 상세", icon: Sparkles },
  { key: "channel", label: "인입경로 매트릭스", icon: Network },
] as const;

type TabKey = typeof tabs[number]["key"];

export const PerformanceLedger = () => {
  const [tab, setTab] = useState<TabKey>("mobile");

  return (
    <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-secondary animate-pulse" />
            실적장표(건) · 실시간
          </div>
          <h2 className="mt-1.5 text-xl md:text-2xl font-bold tracking-tight">
            실적 상세 분석
          </h2>
        </div>

        <div className="flex p-1 rounded-2xl bg-muted/50 border border-border/40 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div key={tab} className="animate-fade-in">
        {tab === "mobile" && <MobileBreakdown />}
        {tab === "strategy" && <StrategyProductGauges />}
        {tab === "channel" && <ChannelMatrixTable />}
      </div>
    </section>
  );
};

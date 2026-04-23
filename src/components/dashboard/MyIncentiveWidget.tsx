import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Wifi, AlertTriangle, TrendingUp, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePeriod } from "@/contexts/PeriodContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { calcTotalIncentive, calcLinkageRate, forecastIncentive, type SaleForIncentive, type LinkageRule } from "@/lib/incentiveEngine";

function formatKRW(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만원`;
  return `${n.toLocaleString()}원`;
}

export function MyIncentiveWidget() {
  const { user } = useAuth();
  const { rates } = useIncentiveRates();
  const { linkageRule } = useAppSettings();
  const period = usePeriod();
  const [sales, setSales] = useState<SaleForIncentive[]>([]);
  const [profile, setProfile] = useState<{ position?: string | null }>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: sData }, { data: pData }] = await Promise.all([
        supabase
          .from("sales")
          .select("id, open_date, device_model, product, sale_type, net_fee, customer_name")
          .eq("created_by", user.id)
          .gte("open_date", period.startDate)
          .lte("open_date", period.endDate),
        supabase.from("profiles").select("position").eq("user_id", user.id).maybeSingle(),
      ]);
      setSales((sData ?? []) as SaleForIncentive[]);
      setProfile(pData ?? {});
    })();
  }, [user, period.startDate, period.endDate]);

  const result = useMemo(() => {
    if (!sales.length) return null;

    const internetCount = sales.filter(
      (s) => (s.product ?? "").includes("인터넷") || (s.product ?? "").includes("홈")
    ).length;

    const grade = profile.position ?? null;

    const calc = calcTotalIncentive(sales, rates, grade, linkageRule, internetCount);

    // 시뮬레이션: 인터넷 +1, +2 했을 때
    const sim1 = calcTotalIncentive(sales, rates, grade, linkageRule, internetCount + 1);
    const sim2 = calcTotalIncentive(sales, rates, grade, linkageRule, internetCount + 2);

    return {
      ...calc,
      internetCount,
      grade,
      sim1Total: sim1.total,
      sim2Total: sim2.total,
      salesCount: sales.length,
    };
  }, [sales, rates, linkageRule, profile.position]);

  if (!result) {
    return (
      <Card className="p-5 glass">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coins className="size-4" /> 이번 달 실적을 입력하면 예상 인센티브가 표시됩니다.
        </div>
      </Card>
    );
  }

  const needsMore = linkageRule.enabled && result.linkageRate < 100;
  const gaugePercent = result.linkageRate;

  return (
    <Card className="p-5 glass space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Coins className="size-4 text-amber-400" /> 나의 예상 인센티브
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {result.salesCount}건 실적 기준
        </Badge>
      </div>

      {/* Main amount */}
      <div className="text-center">
        <div className="text-3xl font-bold tracking-tight">{formatKRW(result.total)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          모바일 {formatKRW(result.adjustedMobile)} + 기타 {formatKRW(result.nonMobileTotal)} + 등급보너스 {formatKRW(result.gradeBonus)}
        </div>
      </div>

      {/* Linkage gauge */}
      {linkageRule.enabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wifi className="size-3" /> 인터넷 연동 지급률
            </span>
            <span className={`font-bold ${gaugePercent === 100 ? "text-emerald-400" : gaugePercent > 0 ? "text-amber-400" : "text-destructive"}`}>
              {gaugePercent}%
            </span>
          </div>
          {/* Gauge bar */}
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                gaugePercent === 100 ? "bg-emerald-400" : gaugePercent > 0 ? "bg-amber-400" : "bg-destructive"
              }`}
              style={{ width: `${gaugePercent}%` }}
            />
            {/* Tick marks */}
            {linkageRule.tiers.filter(t => t.min_qty > 0).map((t) => (
              <div
                key={t.min_qty}
                className="absolute top-0 bottom-0 w-px bg-foreground/20"
                style={{ left: `${t.rate}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>인터넷 {result.internetCount}건</span>
            <span>모바일 원래 단가: {formatKRW(result.mobileTotal)}</span>
          </div>
        </div>
      )}

      {/* Guidance */}
      {needsMore && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2.5 space-y-1">
          {result.linkageRate === 0 && (
            <div className="flex items-start gap-2 text-xs">
              <AlertTriangle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                인터넷 <strong>1건</strong> 달성 시 인센티브가{" "}
                <strong className="text-amber-400">+{formatKRW(result.sim1Total - result.total)}</strong> 추가됩니다.
              </span>
            </div>
          )}
          {result.linkageRate < 100 && (
            <div className="flex items-start gap-2 text-xs">
              <TrendingUp className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                인터넷 <strong>{result.linkageRate === 0 ? "2건" : "1건 추가"}</strong> 달성 시 인센티브가{" "}
                <strong className="text-emerald-400">
                  +{formatKRW((result.linkageRate === 0 ? result.sim2Total : result.sim1Total) - result.total)}
                </strong>{" "}
                추가됩니다.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Grade exemption */}
      {linkageRule.enabled && result.grade && linkageRule.exempt_grades.includes(result.grade) && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <ShieldCheck className="size-3" /> {result.grade} 직급은 인터넷 연동 예외 (100% 지급)
        </div>
      )}
    </Card>
  );
}
import { Sparkles } from "lucide-react";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePeriod } from "@/contexts/PeriodContext";
import { Link } from "react-router-dom";

/**
 * 전략모델 카드 — 어드민이 선택한 모델의 이번달 판매 건수
 */
export const StrategyModelGauges = () => {
  const { models: deviceModels, loading: modelsLoading } = useDeviceModels(true);
  const { startDate, endDate } = usePeriod();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const strategyModels = useMemo(
    () => deviceModels.filter((m) => (m as any).is_strategy),
    [deviceModels],
  );

  useEffect(() => {
    if (modelsLoading || strategyModels.length === 0) { setLoading(false); return; }
    setLoading(true);
    const names = strategyModels.map((m) => m.model_name);
    fetchAllRows(({ from, to }) =>
      supabase
        .from("sales")
        .select("device_model")
        .in("device_model", names)
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .range(from, to)
    )
      .then((data) => {
        const c: Record<string, number> = {};
        (data ?? []).forEach((r: any) => {
          const m = r.device_model ?? "";
          c[m] = (c[m] ?? 0) + 1;
        });
        setCounts(c);
        setLoading(false);
      });
  }, [modelsLoading, strategyModels.length, startDate, endDate]);

  const PALETTE = [
    "hsl(195 90% 60%)", "hsl(270 90% 65%)", "hsl(320 90% 65%)",
    "hsl(35 95% 60%)", "hsl(160 80% 50%)", "hsl(0 80% 60%)",
  ];

  const models = strategyModels.map((m, i) => ({
    name: m.model_name,
    color: PALETTE[i % PALETTE.length],
    current: counts[m.model_name] ?? 0,
  }));

  if (strategyModels.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary-glow" />
            <h4 className="text-base font-semibold tracking-tight">전략모델</h4>
          </div>
          <Link to="/device-models" className="text-xs text-primary-glow hover:underline">
            모델 마스터에서 선택 →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          모델 마스터에서 전략 모델 토글을 켜면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  const total = models.reduce((s, m) => s + m.current, 0);
  const max = Math.max(...models.map((m) => m.current), 1);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary-glow" />
            <h4 className="text-base font-semibold tracking-tight">전략모델 판매</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">이번달 · 어드민 지정 모델</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gradient tabular-nums">{loading ? "…" : total}</div>
          <div className="text-[11px] text-muted-foreground">총 건수</div>
        </div>
      </div>

      <div className="space-y-3">
        {models.map((m) => (
          <div key={m.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{m.name}</span>
              <span className="tabular-nums text-muted-foreground">{m.current}건</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(m.current / max) * 100}%`, backgroundColor: m.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

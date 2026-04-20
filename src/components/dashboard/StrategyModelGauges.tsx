import { Sparkles } from "lucide-react";
import { useStrategyConfig } from "@/hooks/useStrategyConfig";
import { Link } from "react-router-dom";

/**
 * 전략모델 카드 — 어드민이 선택한 모델의 이번달 판매 건수
 */
export const StrategyModelGauges = () => {
  const { models, loading } = useStrategyConfig();

  if (models.length === 0) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary-glow" />
            <h4 className="text-base font-semibold tracking-tight">전략모델</h4>
          </div>
          <Link to="/admin" className="text-xs text-primary-glow hover:underline">
            어드민에서 선택 →
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          어드민 → 전략 / 임계값 탭에서 표시할 모델을 선택하세요.
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

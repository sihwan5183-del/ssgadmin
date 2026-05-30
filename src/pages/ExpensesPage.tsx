import { Header } from "@/components/layout/Header";
import { MediaSpendStack } from "@/components/finance/MediaSpendStack";
import { CpaChart } from "@/components/finance/CpaChart";
import { RevenueComposition } from "@/components/finance/RevenueComposition";
import { NetMarginCard } from "@/components/finance/NetMarginCard";
import { OfferTrendChart } from "@/components/finance/OfferTrendChart";
import { ChannelMarginRanking } from "@/components/finance/ChannelMarginRanking";
import { SettlementGap } from "@/components/finance/SettlementGap";
import { EmptyHint } from "@/components/finance/EmptyHint";
import { CategoryBreakdownChart } from "@/components/finance/CategoryBreakdownChart";
import { TrendingUp, TrendingDown, Banknote, Wallet, HandCoins, Store, EyeOff, Smartphone, Wifi, Layers, CreditCard, Receipt, RotateCcw } from "lucide-react";
import { useCallback, useState } from "react";
import { DashboardGrid, type GridWidget } from "@/components/dashboard/DashboardGrid";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePeriod } from "@/contexts/PeriodContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

const ExpensesPage = () => {
  const { label } = usePeriod();
  const f = useFinanceData();
  const { isSuperAdmin } = useSuperAdmin();

  // ----- 4단 KPI 위젯 정의 -----
  const mobileExpenseTotal =
    f.byProduct.mobile.expense; // 분배+현금+오퍼+고객+법인+모요
  const internetExpenseTotal = f.byProduct.internet.expense;
  const etcRevenue = Math.max(
    0,
    f.totalRevenue - f.byProduct.mobile.revenue - f.byProduct.internet.revenue,
  );

  const kpiDefs: Array<{
    id: string;
    row: 1 | 2 | 3 | 4;
    label: string;
    value: string;
    tone: "revenue" | "expense" | "primary";
    Icon: React.ElementType;
    hint?: string;
  }> = [
    // 1. 수익 종합
    { id: "rev_total", row: 1, label: "총 수익", value: formatKRW(f.totalRevenue), tone: "revenue", Icon: TrendingUp, hint: "수수료 + 부가 + 미수 + 상품권 + 중고폰" },
    { id: "rev_mobile", row: 1, label: "모바일 수익", value: formatKRW(f.byProduct.mobile.revenue), tone: "revenue", Icon: Smartphone, hint: `${f.byProduct.mobile.successCount}건` },
    { id: "rev_internet", row: 1, label: "인터넷 수익", value: formatKRW(f.byProduct.internet.revenue), tone: "revenue", Icon: Wifi, hint: `${f.byProduct.internet.successCount}건` },
    { id: "rev_etc", row: 1, label: "기타 수익", value: formatKRW(etcRevenue), tone: "revenue", Icon: Layers, hint: "총수익 − (모바일+인터넷)" },
    // 2. 모바일 지출
    { id: "m_expense_total", row: 2, label: "모바일 총지출", value: formatKRW(mobileExpenseTotal), tone: "expense", Icon: TrendingDown, hint: "유통망+현금+오퍼+고객+법인+모요" },
    { id: "m_distributor", row: 2, label: "유통망 지원금", value: formatKRW(f.byProduct.mobile.distributor), tone: "expense", Icon: HandCoins, hint: "모바일 분배 지원금" },
    { id: "m_cash_open", row: 2, label: "현금개통 금액", value: formatKRW(f.byProduct.mobile.cashOpen), tone: "expense", Icon: Banknote, hint: "모바일 현금개통" },
    { id: "m_corp_card", row: 2, label: "법인카드 결제금액", value: formatKRW(f.byProduct.mobile.corpCard), tone: "expense", Icon: CreditCard, hint: "5번 법인카드 (모바일)" },
    { id: "m_customer_deposit", row: 2, label: "고객입금 금액", value: formatKRW(f.byProduct.mobile.customerDeposit), tone: "expense", Icon: Wallet, hint: "모바일 미수금" },
    // 3. 인터넷 지출
    { id: "i_expense_total", row: 3, label: "인터넷 총지출", value: formatKRW(internetExpenseTotal), tone: "expense", Icon: TrendingDown, hint: "유통망+현금+오퍼+고객+법인" },
    { id: "i_corp_card", row: 3, label: "법인카드 결제금액", value: formatKRW(f.byProduct.internet.corpCard), tone: "expense", Icon: CreditCard, hint: "5번 법인카드 (인터넷)" },
    { id: "i_customer_deposit", row: 3, label: "고객입금 금액", value: formatKRW(f.byProduct.internet.customerDeposit), tone: "expense", Icon: Wallet, hint: "인터넷 미수금" },
    // 4. 모요 정산
    { id: "moyo_fee", row: 4, label: "모요 정산 예정금액", value: formatKRW(f.moyoFee), tone: "expense", Icon: Store, hint: `모요 적용 ${f.moyoAppliedCount}건 × 88,000원` },
    { id: "moyo_excluded", row: 4, label: "모요 미적용 건수", value: `${f.moyoExcludedCount}건`, tone: "primary", Icon: Receipt, hint: "모요 수수료 비적용" },
    { id: "moyo_applied", row: 4, label: "모요 적용 건수", value: `${f.moyoAppliedCount}건`, tone: "expense", Icon: Store, hint: "수수료 발생 대상" },
  ];

  // 히든 위젯 상태 (localStorage) - KPI
  const HIDDEN_KEY = "expenses.kpi.hidden.v1";
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(HIDDEN_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const persistHidden = useCallback((next: Set<string>) => {
    setHidden(new Set(next));
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
    } catch { /* ignore */ }
  }, []);
  const onRemove = useCallback((id: string) => {
    const next = new Set(hidden);
    next.add(id);
    persistHidden(next);
  }, [hidden, persistHidden]);
  const restoreAll = useCallback(() => persistHidden(new Set()), [persistHidden]);

  // ----- 하단 분석 섹션 위젯 (드래그·리사이즈·삭제) -----
  const SECTION_HIDDEN_KEY = "expenses.section.hidden.v1";
  const [sectionHidden, setSectionHidden] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SECTION_HIDDEN_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const persistSectionHidden = useCallback((next: Set<string>) => {
    setSectionHidden(new Set(next));
    try { localStorage.setItem(SECTION_HIDDEN_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }, []);
  const onRemoveSection = useCallback((id: string) => {
    const next = new Set(sectionHidden);
    next.add(id);
    persistSectionHidden(next);
  }, [sectionHidden, persistSectionHidden]);
  const restoreSections = useCallback(() => persistSectionHidden(new Set()), [persistSectionHidden]);

  // 행별 컬럼 분배 (lg=12)
  const widths: Record<string, number> = {
    rev_total: 3, rev_mobile: 3, rev_internet: 3, rev_etc: 3,
    m_expense_total: 3, m_distributor: 3, m_cash_open: 2, m_corp_card: 2, m_customer_deposit: 2,
    i_expense_total: 4, i_corp_card: 4, i_customer_deposit: 4,
    moyo_fee: 4, moyo_excluded: 4, moyo_applied: 4,
  };
  const rowYBase: Record<number, number> = { 1: 0, 2: 3, 3: 6, 4: 9 };
  let xCursor: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const kpiWidgets: GridWidget[] = kpiDefs
    .filter((k) => !hidden.has(k.id))
    .map((k) => {
      const w = widths[k.id] ?? 3;
      const x = xCursor[k.row];
      xCursor[k.row] = x + w;
      return {
        id: k.id,
        lg: { x, y: rowYBase[k.row], w, h: 3, minW: 2, minH: 3 },
        node: <KpiTile label={k.label} value={k.value} tone={k.tone} Icon={k.Icon} hint={k.hint} />,
      };
    });

  return (
    <>
      <Header
        title="수익 · 지출 상세 분석"
        subtitle={`판매원장 + 지출장표 통합 뷰 · ${label}`}
      />

      {/* 데이터 검증 안내 */}
      {!f.loading && f.excludedLabels.length > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm">
          <EyeOff className="size-4 text-destructive shrink-0" />
          <span className="text-muted-foreground">
            현재 대시보드 합산 제외:{" "}
            <span className="font-semibold text-foreground">{f.excludedLabels.join(", ")}</span>
          </span>
          <Link to="/budget-categories" className="ml-auto text-xs text-primary hover:underline shrink-0">
            항목 관리 →
          </Link>
        </div>
      )}
      {!f.loading && (f.hasSales !== f.hasSpend) && (
        <div className="mb-4">
          <EmptyHint
            message={
              f.hasSales && !f.hasSpend
                ? "수익 데이터는 있는데 매칭되는 지출(광고비)이 없습니다. 채널별 ROI/CPA 분석을 위해 지출을 입력해 주세요."
                : "지출 데이터는 있는데 매칭되는 개통 실적이 없습니다. 실적을 입력해 주세요."
            }
            actionLabel={f.hasSales && !f.hasSpend ? "지출 입력" : "실적 입력"}
            actionHref={f.hasSales && !f.hasSpend ? "/expense-input" : "/input"}
          />
        </div>
      )}

      {/* ── 4단 자금 KPI 그리드 (드래그·리사이즈·삭제) ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-lg font-bold tracking-tight text-slate-900">자금 성격별 요약</h2>
          <p className="text-xs text-slate-500">카드를 드래그해 이동 · 우측 하단으로 크기 조절 · X 로 숨김</p>
        </div>
        {hidden.size > 0 && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={restoreAll}>
            <RotateCcw className="size-3.5" /> 숨김 카드 복원 ({hidden.size})
          </Button>
        )}
      </div>
      <div className="mb-6">
        <DashboardGrid
          items={kpiWidgets}
          storageKey="expenses.kpi.grid.v1"
          rowHeight={36}
          editable={isSuperAdmin}
          onRemove={isSuperAdmin ? onRemove : undefined}
        />
      </div>

      {/* ── 하단 분석 위젯 그리드 (드래그·리사이즈·삭제) ── */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base md:text-lg font-bold tracking-tight text-slate-900">상세 분석 위젯</h2>
          <p className="text-xs text-slate-500">드래그로 위치 이동 · 우측 하단 핸들로 크기 조절 · X 로 숨김</p>
        </div>
        {sectionHidden.size > 0 && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={restoreSections}>
            <RotateCcw className="size-3.5" /> 분석 위젯 복원 ({sectionHidden.size})
          </Button>
        )}
      </div>
      <DashboardGrid
        items={[
          { id: "media_spend", lg: { x: 0, y: 0, w: 7, h: 12, minW: 4, minH: 8 }, node: <SectionCard title="지출 상세 분석 · 매체별 광고비"><MediaSpendStack /></SectionCard> },
          { id: "cpa", lg: { x: 7, y: 0, w: 5, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="채널별 CPA"><CpaChart /></SectionCard> },
          { id: "rev_composition", lg: { x: 0, y: 12, w: 5, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="수익 상세 분석 · 항목별 비중"><RevenueComposition /></SectionCard> },
          { id: "net_margin", lg: { x: 5, y: 12, w: 7, h: 12, minW: 4, minH: 8 }, node: <SectionCard title="순수익 정산"><NetMarginCard /></SectionCard> },
          { id: "offer_trend", lg: { x: 0, y: 24, w: 12, h: 10, minW: 4, minH: 6 }, node: <SectionCard title="고객 지원금 추세"><OfferTrendChart /></SectionCard> },
          { id: "ch_margin", lg: { x: 0, y: 34, w: 6, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="전략적 효율 지표 · 채널 마진율"><ChannelMarginRanking /></SectionCard> },
          { id: "settle_gap", lg: { x: 6, y: 34, w: 6, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="정산 갭"><SettlementGap /></SectionCard> },
          { id: "cat_rev", lg: { x: 0, y: 46, w: 6, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="항목별 구성 · 수익"><CategoryBreakdownChart type="수익" /></SectionCard> },
          { id: "cat_exp", lg: { x: 6, y: 46, w: 6, h: 12, minW: 3, minH: 8 }, node: <SectionCard title="항목별 구성 · 지출"><CategoryBreakdownChart type="지출" /></SectionCard> },
        ].filter((w) => !sectionHidden.has(w.id))}
        storageKey="expenses.section.grid.v1"
        rowHeight={36}
        editable={isSuperAdmin}
        onRemove={isSuperAdmin ? onRemoveSection : undefined}
      />
    </>
  );
};

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="premium-card h-full w-full p-3 md:p-4 flex flex-col overflow-hidden">
    <div className="mb-2 text-sm font-bold text-slate-900 truncate pr-16">{title}</div>
    <div className="flex-1 min-h-0 overflow-auto">{children}</div>
  </div>
);

const KpiTile = ({
  label, value, tone, Icon, hint,
}: {
  label: string;
  value: string;
  tone: "revenue" | "expense" | "primary";
  Icon: React.ElementType;
  hint?: string;
}) => {
  const toneCls = {
    revenue: "text-revenue border-revenue/30 bg-[hsl(var(--revenue-soft))]",
    expense: "text-expense border-expense/30 bg-[hsl(var(--expense-soft))]",
    primary: "text-primary border-primary/30 bg-gradient-soft",
  }[tone];
  return (
    <div className="premium-card h-full w-full p-3 md:p-4 flex flex-col overflow-hidden">
      <div className={`size-9 md:size-10 rounded-xl grid place-items-center border shrink-0 ${toneCls}`}>
        <Icon className="size-4 md:size-5" />
      </div>
      <div className="mt-2 md:mt-3 text-[11px] md:text-xs font-medium text-slate-500 truncate">{label}</div>
      <div
        className={`mt-0.5 font-bold tabular-nums tracking-tight truncate ${
          tone === "revenue" ? "text-revenue" : tone === "expense" ? "text-expense" : "text-slate-900"
        }`}
        style={{ fontSize: "clamp(1.1rem, 2.1vw, 1.75rem)", lineHeight: 1.15 }}
      >
        {value}
      </div>
      {hint && <div className="mt-auto pt-1 text-[10px] md:text-[11px] text-slate-500 truncate">{hint}</div>}
    </div>
  );
};

const SectionTitle = ({ index, title, subtitle }: { index: number; title: string; subtitle: string }) => (
  <div className="flex items-baseline gap-3 mb-3">
    <span className="size-7 rounded-lg grid place-items-center bg-gradient-primary text-primary-foreground text-xs font-bold shadow-glow">
      {index}
    </span>
    <div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default ExpensesPage;

import { createContext, useContext, useMemo, useState, ReactNode } from "react";

interface PeriodCtx {
  year: number;
  month: number; // 0 = 전체(연 단위), 1~12
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  /** 시작일(inclusive) ISO yyyy-mm-dd */
  startDate: string;
  /** 종료일(inclusive) ISO yyyy-mm-dd */
  endDate: string;
  /** 직전 동일 길이 구간 — 증감 비교용 */
  prevStartDate: string;
  prevEndDate: string;
  label: string;
}

const Ctx = createContext<PeriodCtx | null>(null);

const pad = (n: number) => String(n).padStart(2, "0");

const toRange = (year: number, month: number) => {
  if (month === 0) {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      prevStart: `${year - 1}-01-01`,
      prevEnd: `${year - 1}-12-31`,
      label: `${year}년 전체`,
    };
  }
  const last = new Date(year, month, 0).getDate();
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(last)}`;
  const prevD = new Date(year, month - 2, 1);
  const prevY = prevD.getFullYear();
  const prevM = prevD.getMonth() + 1;
  const prevLast = new Date(prevY, prevM, 0).getDate();
  return {
    start,
    end,
    prevStart: `${prevY}-${pad(prevM)}-01`,
    prevEnd: `${prevY}-${pad(prevM)}-${pad(prevLast)}`,
    label: `${year}년 ${month}월`,
  };
};

export const PeriodProvider = ({ children }: { children: ReactNode }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const value = useMemo<PeriodCtx>(() => {
    const r = toRange(year, month);
    return {
      year,
      month,
      setYear,
      setMonth,
      startDate: r.start,
      endDate: r.end,
      prevStartDate: r.prevStart,
      prevEndDate: r.prevEnd,
      label: r.label,
    };
  }, [year, month]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePeriod = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeriod must be used inside PeriodProvider");
  return ctx;
};

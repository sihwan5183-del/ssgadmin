import { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from "react";

export type PeriodMode = "month" | "day" | "range";

interface PeriodCtx {
  mode: PeriodMode;
  setMode: (m: PeriodMode) => void;
  // month mode
  year: number;
  month: number; // 0 = 전체(연 단위), 1~12
  setYear: (y: number) => void;
  setMonth: (m: number) => void;
  // day / range mode
  /** day mode 단일 날짜 또는 range 시작 */
  customStart: string | null;
  /** range 종료 (day 모드면 same as customStart) */
  customEnd: string | null;
  setCustomStart: (d: string | null) => void;
  setCustomEnd: (d: string | null) => void;
  setCustomRange: (start: string, end: string) => void;
  setSingleDay: (d: string) => void;
  /** 시작일(inclusive) yyyy-mm-dd */
  startDate: string;
  /** 종료일(inclusive) yyyy-mm-dd */
  endDate: string;
  /** 직전 동일 길이 구간 — 증감 비교용 */
  prevStartDate: string;
  prevEndDate: string;
  label: string;
}

const Ctx = createContext<PeriodCtx | null>(null);

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) /
      86400000,
  ) + 1;

const monthRange = (year: number, month: number) => {
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

const formatLabel = (start: string, end: string) => {
  if (start === end) return start.replace(/-/g, ".");
  return `${start.replace(/-/g, ".")} ~ ${end.replace(/-/g, ".")}`;
};

export const PeriodProvider = ({ children }: { children: ReactNode }) => {
  const now = new Date();
  // ── 세션 상태 영속화 (페이지 이동/새로고침 시에도 유지) ──
  const SS_KEY = "ssg.period.v1";
  const persisted = (() => {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const [mode, setMode] = useState<PeriodMode>(persisted?.mode ?? "month");
  const [year, setYear] = useState<number>(persisted?.year ?? now.getFullYear());
  const [month, setMonth] = useState<number>(persisted?.month ?? now.getMonth() + 1);
  const [customStart, setCustomStart] = useState<string | null>(persisted?.customStart ?? null);
  const [customEnd, setCustomEnd] = useState<string | null>(persisted?.customEnd ?? null);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SS_KEY,
        JSON.stringify({ mode, year, month, customStart, customEnd }),
      );
    } catch {
      /* ignore quota errors */
    }
  }, [mode, year, month, customStart, customEnd]);

  const setSingleDay = useCallback((d: string) => {
    setMode("day");
    setCustomStart(d);
    setCustomEnd(d);
  }, []);

  const setCustomRange = useCallback((start: string, end: string) => {
    setMode("range");
    setCustomStart(start);
    setCustomEnd(end);
  }, []);

  const value = useMemo<PeriodCtx>(() => {
    if ((mode === "day" || mode === "range") && customStart && customEnd) {
      const len = daysBetween(customStart, customEnd);
      const prevEnd = addDays(customStart, -1);
      const prevStart = addDays(prevEnd, -(len - 1));
      return {
        mode,
        setMode,
        year,
        month,
        setYear,
        setMonth,
        customStart,
        customEnd,
        setCustomStart,
        setCustomEnd,
        setCustomRange,
        setSingleDay,
        startDate: customStart,
        endDate: customEnd,
        prevStartDate: prevStart,
        prevEndDate: prevEnd,
        label: formatLabel(customStart, customEnd),
      };
    }
    const r = monthRange(year, month);
    return {
      mode: "month",
      setMode,
      year,
      month,
      setYear,
      setMonth,
      customStart,
      customEnd,
      setCustomStart,
      setCustomEnd,
      setCustomRange,
      setSingleDay,
      startDate: r.start,
      endDate: r.end,
      prevStartDate: r.prevStart,
      prevEndDate: r.prevEnd,
      label: r.label,
    };
  }, [mode, year, month, customStart, customEnd, setCustomRange, setSingleDay]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePeriod = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePeriod must be used inside PeriodProvider");
  return ctx;
};

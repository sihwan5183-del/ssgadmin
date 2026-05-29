import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Megaphone, MapPin, Briefcase, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

type TabKey = "sales" | "seg" | "apt" | "ad";

const MAGENTA = "#E6007E";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] = [
  { key: "sales", label: "일별 판매실적", icon: TrendingUp },
  { key: "seg", label: "영업 캘린더", icon: Briefcase },
  { key: "apt", label: "아파트게시 캘린더", icon: MapPin },
  { key: "ad", label: "광고 캘린더", icon: Megaphone },
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => isoOf(new Date());

function buildMonthGrid(year: number, month0: number) {
  // 6주 x 7일 그리드 (월요일 시작)
  const first = new Date(year, month0, 1);
  const startDow = (first.getDay() + 6) % 7; // 월=0
  const start = new Date(year, month0, 1 - startDow);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

type SaleRow = { open_date: string | null; sale_type: string | null };
type SegRow = { id: string; activity_date: string; title: string | null; activity_type: string | null; assignee_name: string | null };
type RangeRow = { id: string; title: string; start: string; end: string; sub?: string | null };

const normalizeSaleType = (t: string | null): "MNP" | "기변" | "신규" | "기타" => {
  if (!t) return "기타";
  const s = t.toLowerCase();
  if (s.includes("mnp")) return "MNP";
  if (t.includes("기변")) return "기변";
  if (t.includes("신규")) return "신규";
  return "기타";
};

export function UnifiedCalendarWidget({ onDayClick, showTabs = true }: { onDayClick?: (iso: string) => void; showTabs?: boolean } = {}) {
  const [tab, setTab] = useState<TabKey>("sales");
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState<string>(todayIso());

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [seg, setSeg] = useState<SegRow[]>([]);
  const [apt, setApt] = useState<RangeRow[]>([]);
  const [ads, setAds] = useState<RangeRow[]>([]);

  const monthStart = isoOf(new Date(year, month0, 1));
  const monthEnd = isoOf(new Date(year, month0 + 1, 0));

  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, g, a, ad] = await Promise.all([
        supabase.from("sales").select("open_date, sale_type").gte("open_date", monthStart).lte("open_date", monthEnd),
        (supabase as any).from("seg_activities").select("id, activity_date, title, activity_type, assignee_name").gte("activity_date", monthStart).lte("activity_date", monthEnd),
        (supabase as any).from("apartment_postings").select("id, apartment_name, start_date, end_date, location_detail").or(`and(start_date.lte.${monthEnd},end_date.gte.${monthStart})`),
        (supabase as any).from("ad_campaigns").select("id, topic, media, start_date, end_date, channel").or(`and(start_date.lte.${monthEnd},end_date.gte.${monthStart})`),
      ]);
      if (!alive) return;
      setSales(((s.data || []) as any) as SaleRow[]);
      setSeg(((g.data || []) as any) as SegRow[]);
      setApt(((a.data || []) as any[]).map((r) => ({ id: r.id, title: r.apartment_name, start: r.start_date, end: r.end_date, sub: r.location_detail })));
      setAds(((ad.data || []) as any[]).map((r) => ({ id: r.id, title: r.topic, start: r.start_date, end: r.end_date, sub: [r.media, r.channel].filter(Boolean).join(" · ") })));
    })();
    return () => { alive = false; };
  }, [monthStart, monthEnd]);

  const days = useMemo(() => buildMonthGrid(year, month0), [year, month0]);

  // 일자별 판매 집계
  const salesByDay = useMemo(() => {
    const map = new Map<string, { total: number; mnp: number; chg: number; nw: number }>();
    for (const r of sales) {
      if (!r.open_date) continue;
      const cur = map.get(r.open_date) || { total: 0, mnp: 0, chg: 0, nw: 0 };
      cur.total += 1;
      const k = normalizeSaleType(r.sale_type);
      if (k === "MNP") cur.mnp += 1;
      else if (k === "기변") cur.chg += 1;
      else if (k === "신규") cur.nw += 1;
      map.set(r.open_date, cur);
    }
    return map;
  }, [sales]);

  const segByDay = useMemo(() => {
    const map = new Map<string, SegRow[]>();
    for (const r of seg) {
      const arr = map.get(r.activity_date) || [];
      arr.push(r);
      map.set(r.activity_date, arr);
    }
    return map;
  }, [seg]);

  const inRange = (d: string, r: RangeRow) => d >= r.start && d <= r.end;

  const detailList = useMemo(() => {
    if (tab === "sales") {
      const v = salesByDay.get(selected);
      if (!v) return [];
      return [
        { k: "전체 개통", v: `${v.total}건` },
        { k: "MNP", v: `${v.mnp}건` },
        { k: "기변", v: `${v.chg}건` },
        { k: "신규", v: `${v.nw}건` },
      ];
    }
    if (tab === "seg") {
      return (segByDay.get(selected) || []).map((r) => ({ k: r.activity_type || "활동", v: `${r.title || "-"}${r.assignee_name ? ` · ${r.assignee_name}` : ""}` }));
    }
    const list = (tab === "apt" ? apt : ads).filter((r) => inRange(selected, r));
    return list.map((r) => ({ k: `${r.start} ~ ${r.end}`, v: `${r.title}${r.sub ? ` · ${r.sub}` : ""}` }));
  }, [tab, selected, salesByDay, segByDay, apt, ads]);

  const renderCell = (d: Date) => {
    const iso = isoOf(d);
    const inMonth = d.getMonth() === month0;
    const isToday = iso === todayIso();
    const isSel = iso === selected;
    const dow = d.getDay(); // 0=일, 6=토

    let badge: React.ReactNode = null;
    if (tab === "sales") {
      const v = salesByDay.get(iso);
      if (v && v.total > 0) {
        badge = (
          <div className="mt-0.5 text-[10px] leading-tight text-black">
            <div className="font-semibold">총 {v.total}</div>
            <div className="text-[9px]">M{v.mnp}·기{v.chg}·신{v.nw}</div>
          </div>
        );
      }
    } else if (tab === "seg") {
      const list = segByDay.get(iso) || [];
      if (list.length) {
        badge = (
          <div className="mt-0.5 space-y-0.5">
            {list.slice(0, 2).map((r) => (
              <div key={r.id} className="flex items-center gap-1 text-[10px] leading-tight truncate text-black rounded-md bg-[#FCE6F1] px-1.5 py-0.5">
                <Briefcase className="size-2.5 shrink-0" style={{ color: MAGENTA }} />
                <span className="truncate">{r.title || r.activity_type || "활동"}</span>
              </div>
            ))}
            {list.length > 2 && <div className="text-[9px] text-black">+{list.length - 2}</div>}
          </div>
        );
      }
    } else {
      const list = (tab === "apt" ? apt : ads).filter((r) => inRange(iso, r));
      if (list.length) {
        const Icon = tab === "apt" ? MapPin : Megaphone;
        badge = (
          <div className="mt-0.5 space-y-0.5">
            {list.slice(0, 2).map((r) => {
              const isStart = r.start === iso;
              const isEnd = r.end === iso;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-1 text-[10px] leading-tight truncate text-black px-1.5 py-0.5 bg-[#FCE6F1]",
                    isStart && "rounded-l-md",
                    isEnd && "rounded-r-md",
                    !isStart && !isEnd && "rounded-none",
                  )}
                >
                  {isStart && <Icon className="size-2.5 shrink-0" style={{ color: MAGENTA }} />}
                  <span className="truncate">{r.title}</span>
                </div>
              );
            })}
            {list.length > 2 && <div className="text-[9px] text-black">+{list.length - 2}</div>}
          </div>
        );
      }
    }

    return (
      <button
        key={iso}
        onClick={() => { setSelected(iso); onDayClick?.(iso); }}
        className={cn(
          "min-h-[72px] text-left p-1.5 bg-card transition-colors hover:bg-[#FAFAFA] focus:outline-none",
          !inMonth && "opacity-40",
          isSel && "bg-[#FFF1F8]",
        )}
      >
        <div className="flex items-center justify-between text-[11px] font-medium">
          {isToday ? (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-semibold"
              style={{ backgroundColor: MAGENTA }}
            >
              {d.getDate()}
            </span>
          ) : (
            <span className={cn(
              dow === 0 && "text-neutral-400",
              dow === 6 && "text-neutral-500",
              dow !== 0 && dow !== 6 && "text-[#1A1A1A]",
            )}>
              {d.getDate()}
            </span>
          )}
        </div>
        {badge}
      </button>
    );
  };

  const goPrev = () => {
    const m = month0 - 1;
    if (m < 0) { setYear(year - 1); setMonth0(11); } else setMonth0(m);
  };
  const goNext = () => {
    const m = month0 + 1;
    if (m > 11) { setYear(year + 1); setMonth0(0); } else setMonth0(m);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth0(now.getMonth()); setSelected(todayIso()); };

  const detailTitle = (() => {
    const d = new Date(selected + "T00:00:00");
    const wd = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${wd})`;
  })();

  const detailLink: Record<TabKey, { to: string; label: string }> = {
    sales: { to: "/sales-ledger", label: "판매원장 →" },
    seg: { to: "/seg-calendar", label: "영업 캘린더 →" },
    apt: { to: "/apartment", label: "아파트 관리 →" },
    ad: { to: "/ad-calendar", label: "광고 캘린더 →" },
  };

  return (
    <div className="rounded-2xl border border-[#F0F0F0] bg-card p-4 md:p-5 shadow-sm">
      {/* Tab bar */}
      <div className="-mx-1 mb-4 overflow-x-auto scrollbar-hide border-b border-[#F0F0F0]">
        <div className="flex gap-1 px-1 min-w-max">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
                  active ? "text-[#1A1A1A]" : "text-neutral-500 hover:text-[#1A1A1A]",
                )}
              >
                <Icon className="size-3.5" style={active ? { color: MAGENTA } : undefined} />
                {t.label}
                {active && (
                  <span
                    className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full"
                    style={{ backgroundColor: MAGENTA }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Month nav */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={goPrev} className="p-1.5 rounded-full hover:bg-[#F5F5F5] transition-colors"><ChevronLeft className="size-4 text-[#1A1A1A]" /></button>
          <div className="px-3 text-base font-semibold text-[#1A1A1A] tabular-nums">{year}.{pad(month0 + 1)}</div>
          <button onClick={goNext} className="p-1.5 rounded-full hover:bg-[#F5F5F5] transition-colors"><ChevronRight className="size-4 text-[#1A1A1A]" /></button>
          <button
            onClick={goToday}
            className="ml-2 px-3 py-1 text-[11px] font-medium rounded-full border transition-colors"
            style={{ borderColor: MAGENTA, color: MAGENTA }}
          >
            오늘
          </button>
        </div>
        <Link to={detailLink[tab].to} className="text-[11px] text-foreground hover:underline">{detailLink[tab].label}</Link>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-[11px] font-semibold mb-2">
        {["월", "화", "수", "목", "금", "토", "일"].map((w, i) => (
          <div
            key={w}
            className={cn(
              "px-1 py-1.5 text-center",
              i === 5 && "text-neutral-500",
              i === 6 && "text-neutral-400",
              i < 5 && "text-[#1A1A1A]",
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-[#F0F0F0] rounded-lg overflow-hidden border border-[#F0F0F0]">
        {days.map(renderCell)}
      </div>

      {/* Detail list */}
      <div className="mt-4 border-t border-[#F0F0F0] pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
          <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: MAGENTA }} />
          {detailTitle} 상세
        </div>
        {detailList.length === 0 ? (
          <div className="text-xs text-muted-foreground">선택한 날짜에 데이터가 없습니다.</div>
        ) : (
          <ul className="space-y-1.5">
            {detailList.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-[#1A1A1A] border-b border-[#F0F0F0] pb-1.5 last:border-0">
                <span className="min-w-[110px] text-neutral-500">{r.k}</span>
                <span className="flex-1">{r.v}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
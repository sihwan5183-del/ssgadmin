import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { GripVertical, X } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { supabase } from "@/integrations/supabase/client";

export type GridWidget = {
  /** Stable widget id. */
  id: string;
  /** Rendered content. */
  node: ReactNode;
  /** Default position / size on the large (lg) breakpoint. */
  lg: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
};

type Props = {
  items: GridWidget[];
  /** localStorage key for layout persistence. */
  storageKey?: string;
  /** Row height in pixels. */
  rowHeight?: number;
  /** Whether the user can drag/resize. */
  editable?: boolean;
  /** Optional per-widget remove handler. When provided, an X button shows on each tile. */
  onRemove?: (id: string) => void;
};

type Bp = "lg" | "md" | "sm";
const BREAKPOINTS: Record<Bp, number> = { lg: 1280, md: 996, sm: 0 };
const COLS: Record<Bp, number> = { lg: 12, md: 8, sm: 4 };
const DESKTOP_GRID_MIN_WIDTH = 1280;

const useDesktopGridViewport = () => {
  const [isDesktopGrid, setIsDesktopGrid] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= DESKTOP_GRID_MIN_WIDTH,
  );

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${DESKTOP_GRID_MIN_WIDTH}px)`);
    const sync = () => setIsDesktopGrid(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktopGrid;
};

const buildDefaultLayouts = (items: GridWidget[]): ResponsiveLayouts<Bp> => {
  const lg: LayoutItem[] = items.map((it) => ({
    i: it.id,
    x: it.lg.x,
    y: it.lg.y,
    w: Math.min(it.lg.w, COLS.lg),
    h: it.lg.h,
    minW: it.lg.minW ?? 2,
    minH: it.lg.minH ?? 3,
  }));
  let yMd = 0;
  const md: LayoutItem[] = items.map((it) => {
    const row: LayoutItem = { i: it.id, x: 0, y: yMd, w: COLS.md, h: it.lg.h, minW: 2, minH: it.lg.minH ?? 3 };
    yMd += it.lg.h;
    return row;
  });
  let ySm = 0;
  const sm: LayoutItem[] = items.map((it) => {
    const row: LayoutItem = { i: it.id, x: 0, y: ySm, w: COLS.sm, h: it.lg.h, minW: 2, minH: it.lg.minH ?? 3 };
    ySm += it.lg.h;
    return row;
  });
  return { lg, md, sm };
};

/** Merge saved layouts with current widget list. */
const mergeLayouts = (
  saved: ResponsiveLayouts<Bp> | null,
  items: GridWidget[],
): ResponsiveLayouts<Bp> => {
  const defaults = buildDefaultLayouts(items);
  if (!saved) return defaults;
  const out: ResponsiveLayouts<Bp> = { lg: [], md: [], sm: [] };
  (Object.keys(defaults) as Bp[]).forEach((bp) => {
    const def = (defaults[bp] ?? []) as readonly LayoutItem[];
    const savedBp = (saved[bp] ?? []) as readonly LayoutItem[];
    const savedMap = new Map(savedBp.map((l) => [l.i, l]));
    const kept: LayoutItem[] = def.map((d) => {
      const s = savedMap.get(d.i);
      return s ? { ...d, x: s.x, y: s.y, w: s.w, h: s.h } : d;
    });
    out[bp] = kept;
  });
  return out;
};

const desktopOnlyLayouts = (
  next: ResponsiveLayouts<Bp>,
  items: GridWidget[],
): ResponsiveLayouts<Bp> => {
  const defaults = buildDefaultLayouts(items);
  return mergeLayouts({ lg: next.lg ?? defaults.lg, md: defaults.md, sm: defaults.sm }, items);
};

const getMobileTileHeight = (item: GridWidget, rowHeight: number) =>
  Math.max(200, item.lg.h * rowHeight + Math.max(0, item.lg.h - 1) * 8);

const loadFromLS = (key: string): ResponsiveLayouts<Bp> | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ResponsiveLayouts<Bp>;
    return null;
  } catch {
    return null;
  }
};

export const DashboardGrid = ({
  items,
  storageKey = "dashboard.grid.v1",
  rowHeight = 36,
  editable = true,
  onRemove,
}: Props) => {
  const isDesktopGrid = useDesktopGridViewport();
  // 슈퍼관리자가 고정한 단일 원본 배치만 모든 직원에게 동일하게 배포한다.
  const dbKey = useMemo(() => `grid.${storageKey}.global`, [storageKey]);

  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const [layouts, setLayouts] = useState<ResponsiveLayouts<Bp>>(() =>
    mergeLayouts(loadFromLS(storageKey), items),
  );
  const skipPersistRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DB 에서 슈퍼관리자가 저장한 글로벌 PC 레이아웃만 끌어와 최우선으로 적용한다.
  // 모바일/태블릿 접속값은 저장하지 않아 원본 좌표 오염을 막는다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", dbKey)
        .maybeSingle();
      if (cancelled) return;
      if (data?.value && typeof data.value === "object") {
        const saved = data.value as ResponsiveLayouts<Bp>;
        const stable = desktopOnlyLayouts(saved, items);
        setLayouts(stable);
        try {
          localStorage.setItem(storageKey, JSON.stringify(stable));
        } catch { /* ignore */ }
      }
      // DB 로드 직후 자동 콜백으로 인한 덮어쓰기 1회 방지
      skipPersistRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbKey]);

  // Adopt newly added / removed widgets without losing saved positions for survivors.
  useEffect(() => {
    setLayouts((prev) => mergeLayouts(prev, items));
    skipPersistRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const { containerRef, width, mounted } = useContainerWidth();

  const onLayoutChange = useCallback(
    (_current: Layout, all: ResponsiveLayouts<Bp>) => {
      if (!isDesktopGrid) return;
      if (skipPersistRef.current) {
        skipPersistRef.current = false;
        return;
      }
      const desktopLayouts = desktopOnlyLayouts(all, items);
      setLayouts(desktopLayouts);
      try {
        localStorage.setItem(storageKey, JSON.stringify(desktopLayouts));
      } catch {
        /* quota — ignore */
      }
      // DB 동기화 (디바운스). 슈퍼관리자(편집 가능)일 때만 의미가 있지만,
      // editable=false 인 경우에는 onLayoutChange 자체가 거의 호출되지 않는다.
      if (dbKey && editable) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          supabase
            .from("app_settings")
            .upsert({ key: dbKey, value: desktopLayouts as any }, { onConflict: "key" })
            .then(() => {});
        }, 400);
      }
    },
    [isDesktopGrid, items, storageKey, dbKey, editable],
  );

  if (items.length === 0) return null;

  if (!isDesktopGrid) {
    return (
      <div className="dashboard-mobile-stack flex w-full flex-col gap-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="dash-grid-item relative w-full min-w-0 overflow-visible rounded-2xl"
            style={{ height: getMobileTileHeight(it, rowHeight) }}
          >
            <div className="h-full w-full min-w-0 overflow-visible rounded-2xl">{it.node}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {mounted && width > 0 && (
        <ResponsiveGridLayout<Bp>
          width={width}
          layouts={layouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={rowHeight}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          dragConfig={{ enabled: editable, handle: ".dash-drag-handle" }}
          resizeConfig={{ enabled: editable, handles: ["se"] }}
          onLayoutChange={onLayoutChange}
        >
          {items.map((it) => (
            <div key={it.id} className="dash-grid-item group/dash relative">
              {editable && (
                <div className="absolute top-1.5 right-1.5 z-30 flex items-center gap-1 opacity-40 group-hover/dash:opacity-100 transition-opacity">
                  <span
                    aria-label="이동 핸들"
                    className="dash-drag-handle inline-flex items-center justify-center size-6 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted/70 cursor-grab active:cursor-grabbing select-none bg-background/70 backdrop-blur-sm"
                    title="드래그해서 이동"
                  >
                    <GripVertical className="size-3.5" />
                  </span>
                  {onRemove && (
                    <button
                      type="button"
                      aria-label="위젯 삭제"
                      title="위젯 숨기기 (위젯 관리에서 복구 가능)"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(it.id);
                      }}
                      className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground/70 hover:text-destructive-foreground hover:bg-destructive bg-background/70 backdrop-blur-sm transition-colors"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="h-full w-full overflow-hidden rounded-2xl">{it.node}</div>
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
};

export default DashboardGrid;
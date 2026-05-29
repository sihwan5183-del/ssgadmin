import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { GripVertical } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export type GridWidget = {
  /** Stable widget id (matches useDashboardLayout WIDGET_REGISTRY ids when possible). */
  id: string;
  /** Rendered content. */
  node: ReactNode;
  /** Default position / size on the large breakpoint. */
  lg: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
};

type Props = {
  items: GridWidget[];
  /** localStorage key for persistence. Bump suffix to invalidate older saved layouts. */
  storageKey?: string;
  /** Row height in pixels. */
  rowHeight?: number;
  /** Whether the user can drag/resize. */
  editable?: boolean;
};

const BREAKPOINTS = { lg: 1280, md: 996, sm: 0 } as const;
const COLS = { lg: 12, md: 8, sm: 4 } as const;

const buildDefaultLayouts = (items: GridWidget[]): Layouts => {
  const lg: Layout[] = items.map((it) => ({
    i: it.id,
    x: it.lg.x,
    y: it.lg.y,
    w: Math.min(it.lg.w, COLS.lg),
    h: it.lg.h,
    minW: it.lg.minW ?? 2,
    minH: it.lg.minH ?? 3,
  }));
  // For md/sm: stack each widget full width sequentially.
  let yMd = 0;
  const md: Layout[] = items.map((it) => {
    const w = Math.min(it.lg.w * (COLS.md / COLS.lg) | 0 || COLS.md, COLS.md);
    const row: Layout = { i: it.id, x: 0, y: yMd, w: COLS.md, h: it.lg.h, minW: 2, minH: it.lg.minH ?? 3 };
    yMd += it.lg.h;
    return row;
  });
  let ySm = 0;
  const sm: Layout[] = items.map((it) => {
    const row: Layout = { i: it.id, x: 0, y: ySm, w: COLS.sm, h: it.lg.h, minW: 2, minH: it.lg.minH ?? 3 };
    ySm += it.lg.h;
    return row;
  });
  return { lg, md, sm };
};

/** Merge saved layouts with current widget list, dropping orphans and adding new ones at the bottom. */
const mergeLayouts = (saved: Layouts | null, items: GridWidget[]): Layouts => {
  const defaults = buildDefaultLayouts(items);
  if (!saved) return defaults;
  const out: Layouts = { lg: [], md: [], sm: [] };
  (Object.keys(defaults) as Array<keyof typeof defaults>).forEach((bp) => {
    const def = defaults[bp];
    const savedBp = saved[bp] ?? [];
    const savedMap = new Map(savedBp.map((l) => [l.i, l]));
    const ids = new Set(items.map((it) => it.id));
    const kept = def.map((d) => {
      const s = savedMap.get(d.i);
      return s
        ? { ...d, x: s.x, y: s.y, w: s.w, h: s.h }
        : d;
    });
    // Append saved entries that still exist but somehow missed default order
    savedBp.forEach((s) => {
      if (!kept.find((k) => k.i === s.i) && ids.has(s.i)) kept.push(s);
    });
    out[bp] = kept;
  });
  return out;
};

const loadFromLS = (key: string): Layouts | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Layouts;
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
}: Props) => {
  const itemsKey = useMemo(() => items.map((i) => i.id).join("|"), [items]);
  const [layouts, setLayouts] = useState<Layouts>(() => mergeLayouts(loadFromLS(storageKey), items));
  const skipPersistRef = useRef(true);

  // When the visible widget set changes (toggle on/off), recompute layouts but keep saved positions for survivors.
  useEffect(() => {
    setLayouts((prev) => mergeLayouts(prev, items));
    // first emit after mount is the synthetic one from RGL — skip persisting it
    skipPersistRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const onLayoutChange = useCallback(
    (_current: Layout[], all: Layouts) => {
      if (skipPersistRef.current) {
        skipPersistRef.current = false;
        return;
      }
      setLayouts(all);
      try {
        localStorage.setItem(storageKey, JSON.stringify(all));
      } catch {
        /* quota — ignore */
      }
    },
    [storageKey],
  );

  if (items.length === 0) return null;

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={rowHeight}
      margin={[12, 12]}
      containerPadding={[0, 0]}
      draggableHandle=".dash-drag-handle"
      isDraggable={editable}
      isResizable={editable}
      compactType="vertical"
      preventCollision={false}
      onLayoutChange={onLayoutChange}
      resizeHandles={["se"]}
    >
      {items.map((it) => (
        <div key={it.id} className="dash-grid-item group/dash">
          {editable && (
            <button
              type="button"
              aria-label="이동 핸들"
              className="dash-drag-handle absolute top-1 right-1 z-30 inline-flex items-center justify-center size-6 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing opacity-0 group-hover/dash:opacity-100 transition-opacity"
              title="드래그해서 이동"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          <div className="h-full w-full overflow-auto rounded-2xl">{it.node}</div>
        </div>
      ))}
    </ResponsiveGridLayout>
  );
};

export default DashboardGrid;
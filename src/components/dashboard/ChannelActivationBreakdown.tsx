import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Radio, Flame, Filter, Settings2, Plus, Eye, EyeOff, GripVertical, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";

type ProductFilter = "전체" | "모바일" | "홈" | "업셀" | "IoT";

const PRODUCT_FILTERS: ProductFilter[] = ["전체", "모바일", "홈", "업셀", "IoT"];

const matchesProduct = (product: string | null | undefined, filter: ProductFilter): boolean => {
  if (filter === "전체") return true;
  const p = (product ?? "").trim();
  switch (filter) {
    case "모바일":
      return p === "모바일" || p === "USIM MNP" || p === "세컨";
    case "홈":
      return p === "인터넷" || p === "TV프리" || p === "홈";
    case "업셀":
      return p === "대명";
    case "IoT":
      return p === "IOT" || p.toLowerCase() === "iot";
    default:
      return false;
  }
};

const DEFAULT_CHANNEL_COLORS: Record<string, string> = {
  "당근": "hsl(30 90% 55%)",
  "유닥": "hsl(45 90% 55%)",
  "모요": "hsl(265 80% 60%)",
  "도그마루": "hsl(320 80% 55%)",
  "오프라인": "hsl(200 85% 55%)",
  "캠페인": "hsl(160 75% 45%)",
  "SEG활동": "hsl(210 70% 55%)",
  "기타": "hsl(0 0% 55%)",
};

const PALETTE = [
  "hsl(30 90% 55%)", "hsl(265 80% 60%)", "hsl(320 80% 55%)",
  "hsl(200 85% 55%)", "hsl(160 75% 45%)", "hsl(45 90% 55%)",
  "hsl(210 70% 55%)", "hsl(0 0% 55%)",
];

const colorFor = (name: string, idx: number) =>
  DEFAULT_CHANNEL_COLORS[name] ?? PALETTE[idx % PALETTE.length];

type ChannelConfig = { name: string; visible: boolean; order: number };

const SETTINGS_KEY = "channel_activation_config";

export const ChannelActivationBreakdown = () => {
  const { startDate, endDate } = usePeriod();
  const { isAdmin } = useRole();
  const [raw, setRaw] = useState<{ channel: string; product: string | null; open_date: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState<ProductFilter>("전체");
  const [channelConfig, setChannelConfig] = useState<ChannelConfig[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Load channel config from app_settings
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (data?.value && Array.isArray(data.value)) {
        setChannelConfig(data.value as ChannelConfig[]);
      }
    })();
  }, []);

  const saveConfig = useCallback(async (cfg: ChannelConfig[]) => {
    setChannelConfig(cfg);
    await supabase.from("app_settings").upsert(
      { key: SETTINGS_KEY, value: cfg as any },
      { onConflict: "key" }
    );
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("channel, product, open_date")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!alive) return;
      setRaw((data ?? []) as any);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate]);

  // Merge config with actual data channels
  const mergedConfig = useMemo(() => {
    const dataChannels = new Set<string>();
    raw.forEach((r) => dataChannels.add(r.channel || "기타"));
    // Start with saved config
    const existing = new Map(channelConfig.map((c) => [c.name, c]));
    // Add any new channels from data
    dataChannels.forEach((ch) => {
      if (!existing.has(ch)) {
        existing.set(ch, { name: ch, visible: true, order: existing.size });
      }
    });
    // Add config-only channels (user-added)
    channelConfig.forEach((c) => {
      if (!existing.has(c.name)) existing.set(c.name, c);
    });
    return Array.from(existing.values()).sort((a, b) => a.order - b.order);
  }, [raw, channelConfig]);

  const hiddenChannels = useMemo(
    () => new Set(mergedConfig.filter((c) => !c.visible).map((c) => c.name)),
    [mergedConfig]
  );

  const rows = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const map = new Map<string, { monthly: number; today: number }>();
    raw.forEach((r) => {
      if (!matchesProduct(r.product, productFilter)) return;
      const ch = r.channel || "기타";
      if (hiddenChannels.has(ch)) return;
      const cur = map.get(ch) ?? { monthly: 0, today: 0 };
      cur.monthly += 1;
      if (r.open_date === todayISO) cur.today += 1;
      map.set(ch, cur);
    });
    // Sort by config order, then by monthly desc
    const orderMap = new Map(mergedConfig.map((c, i) => [c.name, i]));
    return Array.from(map.entries())
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => (orderMap.get(a.channel) ?? 999) - (orderMap.get(b.channel) ?? 999));
  }, [raw, productFilter, hiddenChannels, mergedConfig]);

  const totalMonthly = useMemo(() => rows.reduce((s, r) => s + r.monthly, 0), [rows]);
  const totalToday = useMemo(() => rows.reduce((s, r) => s + r.today, 0), [rows]);
  const maxMonthly = Math.max(1, ...rows.map((r) => r.monthly));
  const topToday = [...rows].sort((a, b) => b.today - a.today)[0];
  const filterLabel = productFilter === "전체" ? "전체" : productFilter;

  const toggleVisibility = (name: string) => {
    const next = mergedConfig.map((c) =>
      c.name === name ? { ...c, visible: !c.visible } : c
    );
    saveConfig(next);
  };

  const moveChannel = (idx: number, dir: -1 | 1) => {
    const arr = [...mergedConfig];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    saveConfig(arr.map((c, i) => ({ ...c, order: i })));
  };

  const addChannel = () => {
    const n = newChannel.trim();
    if (!n || mergedConfig.some((c) => c.name === n)) return;
    saveConfig([...mergedConfig, { name: n, visible: true, order: mergedConfig.length }]);
    setNewChannel("");
  };

  const removeChannel = (name: string) => {
    saveConfig(mergedConfig.filter((c) => c.name !== name).map((c, i) => ({ ...c, order: i })));
  };

  const startRename = (idx: number) => {
    setEditIdx(idx);
    setEditName(mergedConfig[idx].name);
  };

  const confirmRename = () => {
    if (editIdx === null) return;
    const n = editName.trim();
    if (!n) { setEditIdx(null); return; }
    saveConfig(mergedConfig.map((c, i) => (i === editIdx ? { ...c, name: n } : c)));
    setEditIdx(null);
  };

  return (
    <section className="mb-1.5">
      <Card className="p-5 glass">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 grid place-items-center">
              <Radio className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight tracking-tight">채널별 개통 현황</h3>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                인입 경로별 당월 누적 · 오늘 개통
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/50">
              {PRODUCT_FILTERS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProductFilter(p)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-full transition-all tabular-nums",
                    productFilter === p
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="text-right">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">
                {filterLabel === "전체" ? "당월 합계" : `${filterLabel} 당월 합계`}
              </div>
              <div className="font-extrabold tabular-nums text-lg leading-tight">
                {totalMonthly.toLocaleString()}
                <span className="text-[11px] font-semibold text-muted-foreground ml-0.5">건</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-medium text-muted-foreground leading-tight">
                {filterLabel === "전체" ? "오늘 합계" : `${filterLabel} 오늘`}
              </div>
              <div className="font-extrabold tabular-nums text-lg text-primary leading-tight">
                {totalToday.toLocaleString()}
                <span className="text-[11px] font-semibold text-muted-foreground ml-0.5">건</span>
              </div>
            </div>
            {topToday && topToday.today > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Flame className="size-3.5" />
                오늘 1위 · {topToday.channel}
              </div>
            )}

            {/* Channel Management */}
            {isAdmin && (
              <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="size-8 rounded-lg border border-border/60 bg-muted/40 grid place-items-center hover:bg-accent/50 transition-colors"
                    title="채널 관리"
                  >
                    <Settings2 className="size-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-3 border-b border-border/50">
                    <h4 className="text-sm font-bold">채널 관리</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">표시할 채널을 관리합니다</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
                    {mergedConfig.map((ch, idx) => (
                      <div
                        key={ch.name + idx}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                      >
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveChannel(idx, -1)}
                            disabled={idx === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none"
                          >▲</button>
                          <button
                            type="button"
                            onClick={() => moveChannel(idx, 1)}
                            disabled={idx === mergedConfig.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none"
                          >▼</button>
                        </div>
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: colorFor(ch.name, idx) }} />
                        {editIdx === idx ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-6 text-xs px-1.5"
                              onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                              autoFocus
                            />
                            <button type="button" onClick={confirmRename} className="text-primary"><Check className="size-3.5" /></button>
                            <button type="button" onClick={() => setEditIdx(null)} className="text-muted-foreground"><X className="size-3.5" /></button>
                          </div>
                        ) : (
                          <span
                            className="text-xs font-semibold flex-1 truncate cursor-pointer"
                            onDoubleClick={() => startRename(idx)}
                            title="더블클릭으로 이름 수정"
                          >{ch.name}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleVisibility(ch.name)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title={ch.visible ? "숨기기" : "표시"}
                        >
                          {ch.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeChannel(ch.name)}
                          className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="삭제"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border/50 flex items-center gap-1.5">
                    <Input
                      value={newChannel}
                      onChange={(e) => setNewChannel(e.target.value)}
                      placeholder="새 채널 추가…"
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => e.key === "Enter" && addChannel()}
                    />
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addChannel}>
                      <Plus className="size-3 mr-1" /> 추가
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm font-medium">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm font-medium">선택한 기간 내 데이터가 없습니다</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {rows.map((row, idx) => {
              const ratio = (row.monthly / maxMonthly) * 100;
              const color = colorFor(row.channel, idx);
              const isTop = row.monthly === maxMonthly && row.monthly > 0;
              return (
                <div
                  key={row.channel}
                  className={cn(
                    "p-3 rounded-xl border transition-colors",
                    isTop
                      ? "border-primary/30 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-card hover:bg-accent/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-2.5 rounded-full shrink-0 ring-1 ring-white/20" style={{ background: color }} />
                      <span className="text-xs font-bold truncate leading-tight">{row.channel}</span>
                    </div>
                    {productFilter !== "전체" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0">
                        <Filter className="size-2.5" />
                        {productFilter}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 leading-none">
                    <span className={cn(
                      "text-xl font-extrabold tabular-nums tracking-tight",
                      isTop && "text-primary"
                    )}>{row.monthly}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">건</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1 leading-none">
                    <span className="text-sm font-bold tabular-nums text-primary">+{row.today}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">오늘</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ratio}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
};

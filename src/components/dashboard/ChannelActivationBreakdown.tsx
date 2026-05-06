import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Radio, Flame, Filter, Settings2, Plus, Eye, EyeOff, X, Check, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { EXCLUDED_ACTIVATION_STATUSES } from "@/lib/salesFilter";

/* ── 가입상품 카테고리 설정 ── */
type ProductCategoryConfig = {
  label: string;          // 필터 버튼에 표시될 이름
  keywords: string[];     // sales.product 값과 매칭할 키워드 목록
  visible: boolean;
  order: number;
};

const DEFAULT_PRODUCT_CATEGORIES: ProductCategoryConfig[] = [
  { label: "모바일", keywords: ["모바일", "USIM MNP", "세컨"], visible: true, order: 0 },
  { label: "홈", keywords: ["인터넷", "TV프리", "홈"], visible: true, order: 1 },
  { label: "업셀", keywords: ["대명"], visible: true, order: 2 },
  { label: "스마트홈", keywords: ["스마트홈", "IOT", "iot", "홈IOT", "홈안심"], visible: true, order: 3 },
  { label: "2nd", keywords: ["2nd", "세컨", "워치", "태블릿"], visible: true, order: 4 },
];

const matchesProductDynamic = (
  product: string | null | undefined,
  category: ProductCategoryConfig
): boolean => {
  const p = (product ?? "").trim().toLowerCase();
  return category.keywords.some((kw) => kw.toLowerCase() === p);
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
const PRODUCT_SETTINGS_KEY = "channel_product_categories";

export const ChannelActivationBreakdown = () => {
  const { startDate, endDate } = usePeriod();
  const { isAdmin } = useRole();
  const [raw, setRaw] = useState<{ channel: string; product: string | null; open_date: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelConfig, setChannelConfig] = useState<ChannelConfig[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChannel, setNewChannel] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [productCategories, setProductCategories] = useState<ProductCategoryConfig[]>(DEFAULT_PRODUCT_CATEGORIES);
  const [settingsTab, setSettingsTab] = useState<"channel" | "product">("channel");
  const [newProduct, setNewProduct] = useState("");
  const [editProductIdx, setEditProductIdx] = useState<number | null>(null);
  const [editProductLabel, setEditProductLabel] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedProductFilter, setSelectedProductFilter] = useState("전체");

  // Load channel config from app_settings
  useEffect(() => {
    (async () => {
      const [chRes, prRes] = await Promise.all([
        supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", PRODUCT_SETTINGS_KEY)
          .maybeSingle(),
      ]);
      if (chRes.data?.value && Array.isArray(chRes.data.value)) {
        setChannelConfig(chRes.data.value as ChannelConfig[]);
      }
      if (prRes.data?.value && Array.isArray(prRes.data.value)) {
        setProductCategories(prRes.data.value as ProductCategoryConfig[]);
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

  const saveProductConfig = useCallback(async (cfg: ProductCategoryConfig[]) => {
    setProductCategories(cfg);
    await supabase.from("app_settings").upsert(
      { key: PRODUCT_SETTINGS_KEY, value: cfg as any },
      { onConflict: "key" }
    );
  }, []);

  // Visible product filters
  const visibleProducts = useMemo(
    () => productCategories.filter((c) => c.visible).sort((a, b) => a.order - b.order),
    [productCategories]
  );

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      setLoading(true);
      let q: any = supabase
        .from("sales")
        .select("channel, product, open_date")
        .gte("open_date", startDate)
        .lte("open_date", endDate);
      for (const s of EXCLUDED_ACTIVATION_STATUSES) q = q.neq("status", s);
      const { data } = await q.limit(10000);
      if (!alive) return;
      setRaw((data ?? []) as any);
      setLoading(false);
    };
    fetchData();
    const ch = supabase
      .channel("dashboard-channel-breakdown-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => fetchData())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
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
      const ch = r.channel || "기타";
      if (hiddenChannels.has(ch)) return;
      // Apply product filter
      if (selectedProductFilter !== "전체") {
        const cat = productCategories.find((c) => c.label === selectedProductFilter);
        if (cat && !matchesProductDynamic(r.product, cat)) return;
      }
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
  }, [raw, selectedProductFilter, hiddenChannels, mergedConfig, productCategories]);

  const totalMonthly = useMemo(() => rows.reduce((s, r) => s + r.monthly, 0), [rows]);
  const totalToday = useMemo(() => rows.reduce((s, r) => s + r.today, 0), [rows]);
  const maxMonthly = Math.max(1, ...rows.map((r) => r.monthly));
  const topToday = [...rows].sort((a, b) => b.today - a.today)[0];
  const filterLabel = selectedProductFilter === "전체" ? "전체" : selectedProductFilter;

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

  /* ── 가입상품 관리 함수 ── */
  const addProductCategory = () => {
    const n = newProduct.trim();
    if (!n || productCategories.some((c) => c.label === n)) return;
    saveProductConfig([...productCategories, { label: n, keywords: [n], visible: true, order: productCategories.length }]);
    setNewProduct("");
  };

  const removeProductCategory = (label: string) => {
    saveProductConfig(productCategories.filter((c) => c.label !== label).map((c, i) => ({ ...c, order: i })));
    if (selectedProductFilter === label) setSelectedProductFilter("전체");
  };

  const toggleProductVisibility = (label: string) => {
    saveProductConfig(productCategories.map((c) => c.label === label ? { ...c, visible: !c.visible } : c));
    if (selectedProductFilter === label) setSelectedProductFilter("전체");
  };

  const moveProduct = (idx: number, dir: -1 | 1) => {
    const arr = [...productCategories];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    saveProductConfig(arr.map((c, i) => ({ ...c, order: i })));
  };

  const startProductRename = (idx: number) => {
    setEditProductIdx(idx);
    setEditProductLabel(productCategories[idx].label);
  };

  const confirmProductRename = () => {
    if (editProductIdx === null) return;
    const n = editProductLabel.trim();
    if (!n) { setEditProductIdx(null); return; }
    const old = productCategories[editProductIdx].label;
    saveProductConfig(productCategories.map((c, i) => i === editProductIdx ? { ...c, label: n } : c));
    if (selectedProductFilter === old) setSelectedProductFilter(n);
    setEditProductIdx(null);
  };

  const addKeyword = (catIdx: number) => {
    const kw = newKeyword.trim();
    if (!kw) return;
    saveProductConfig(productCategories.map((c, i) =>
      i === catIdx && !c.keywords.includes(kw)
        ? { ...c, keywords: [...c.keywords, kw] }
        : c
    ));
    setNewKeyword("");
  };

  const removeKeyword = (catIdx: number, kw: string) => {
    saveProductConfig(productCategories.map((c, i) =>
      i === catIdx ? { ...c, keywords: c.keywords.filter((k) => k !== kw) } : c
    ));
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

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/50 flex-nowrap overflow-x-auto max-w-full scrollbar-hide -mx-1 px-1">
              <button
                type="button"
                onClick={() => setSelectedProductFilter("전체")}
                className={cn(
                  "px-3 py-1.5 text-sm font-semibold rounded-full transition-all tabular-nums shrink-0",
                  selectedProductFilter === "전체"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >전체</button>
              {visibleProducts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedProductFilter(p.label)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-semibold rounded-full transition-all tabular-nums shrink-0 whitespace-nowrap",
                    selectedProductFilter === p.label
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="text-right">
              <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                {filterLabel === "전체" ? "당월 합계" : `${filterLabel} 당월 합계`}
              </div>
              <div className="font-black tabular-nums text-2xl leading-tight text-foreground">
                {totalMonthly.toLocaleString()}
                <span className="text-xs font-bold text-muted-foreground ml-0.5">건</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                {filterLabel === "전체" ? "오늘 합계" : `${filterLabel} 오늘`}
              </div>
              <div className="font-black tabular-nums text-2xl text-primary leading-tight drop-shadow-[0_0_10px_hsl(330_100%_55%/0.45)]">
                {totalToday.toLocaleString()}
                <span className="text-xs font-bold text-muted-foreground ml-0.5">건</span>
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
                  {/* Tab header */}
                  <div className="flex border-b border-border/50">
                    <button
                      type="button"
                      onClick={() => setSettingsTab("channel")}
                      className={cn(
                        "flex-1 px-3 py-2.5 text-xs font-bold transition-colors",
                        settingsTab === "channel"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Radio className="size-3 inline mr-1 -mt-0.5" />채널 관리
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsTab("product")}
                      className={cn(
                        "flex-1 px-3 py-2.5 text-xs font-bold transition-colors",
                        settingsTab === "product"
                          ? "text-primary border-b-2 border-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Package className="size-3 inline mr-1 -mt-0.5" />가입상품 관리
                    </button>
                  </div>

                  {/* Channel tab */}
                  {settingsTab === "channel" && (
                    <>
                      <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
                        {mergedConfig.map((ch, idx) => (
                          <div
                            key={ch.name + idx}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/50 group"
                          >
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => moveChannel(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none">▲</button>
                              <button type="button" onClick={() => moveChannel(idx, 1)} disabled={idx === mergedConfig.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none">▼</button>
                            </div>
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: colorFor(ch.name, idx) }} />
                            {editIdx === idx ? (
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-6 text-xs px-1.5" onKeyDown={(e) => e.key === "Enter" && confirmRename()} autoFocus />
                                <button type="button" onClick={confirmRename} className="text-primary"><Check className="size-3.5" /></button>
                                <button type="button" onClick={() => setEditIdx(null)} className="text-muted-foreground"><X className="size-3.5" /></button>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold flex-1 truncate cursor-pointer" onDoubleClick={() => startRename(idx)} title="더블클릭으로 이름 수정">{ch.name}</span>
                            )}
                            <button type="button" onClick={() => toggleVisibility(ch.name)} className="shrink-0 text-muted-foreground hover:text-foreground" title={ch.visible ? "숨기기" : "표시"}>
                              {ch.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                            </button>
                            <button type="button" onClick={() => removeChannel(ch.name)} className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="삭제">
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 border-t border-border/50 flex items-center gap-1.5">
                        <Input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} placeholder="새 채널 추가…" className="h-7 text-xs flex-1" onKeyDown={(e) => e.key === "Enter" && addChannel()} />
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addChannel}><Plus className="size-3 mr-1" /> 추가</Button>
                      </div>
                    </>
                  )}

                  {/* Product tab */}
                  {settingsTab === "product" && (
                    <>
                      <div className="max-h-72 overflow-y-auto p-2 space-y-1">
                        {productCategories.map((cat, idx) => (
                          <div key={cat.label + idx} className="rounded-lg border border-border/50 p-2 group">
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button type="button" onClick={() => moveProduct(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none">▲</button>
                                <button type="button" onClick={() => moveProduct(idx, 1)} disabled={idx === productCategories.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none">▼</button>
                              </div>
                              {editProductIdx === idx ? (
                                <div className="flex items-center gap-1 flex-1 min-w-0">
                                  <Input value={editProductLabel} onChange={(e) => setEditProductLabel(e.target.value)} className="h-6 text-xs px-1.5" onKeyDown={(e) => e.key === "Enter" && confirmProductRename()} autoFocus />
                                  <button type="button" onClick={confirmProductRename} className="text-primary"><Check className="size-3.5" /></button>
                                  <button type="button" onClick={() => setEditProductIdx(null)} className="text-muted-foreground"><X className="size-3.5" /></button>
                                </div>
                              ) : (
                                <span className="text-xs font-bold flex-1 truncate cursor-pointer" onDoubleClick={() => startProductRename(idx)} title="더블클릭으로 이름 수정">{cat.label}</span>
                              )}
                              <button type="button" onClick={() => toggleProductVisibility(cat.label)} className="shrink-0 text-muted-foreground hover:text-foreground" title={cat.visible ? "숨기기" : "표시"}>
                                {cat.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                              </button>
                              <button type="button" onClick={() => removeProductCategory(cat.label)} className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="삭제">
                                <X className="size-3.5" />
                              </button>
                            </div>
                            {/* Keywords */}
                            <div className="flex flex-wrap gap-1 ml-5">
                              {cat.keywords.map((kw) => (
                                <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-0.5 font-medium">
                                  {kw}
                                  <button type="button" onClick={() => removeKeyword(idx, kw)} className="hover:text-destructive ml-0.5"><X className="size-2.5" /></button>
                                </Badge>
                              ))}
                              <div className="inline-flex items-center">
                                <Input
                                  value={editProductIdx === idx ? "" : newKeyword}
                                  onChange={(e) => setNewKeyword(e.target.value)}
                                  onFocus={() => setNewKeyword("")}
                                  placeholder="+ 키워드"
                                  className="h-5 text-[10px] px-1 w-16 border-dashed"
                                  onKeyDown={(e) => { if (e.key === "Enter") { addKeyword(idx); e.preventDefault(); } }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 border-t border-border/50 flex items-center gap-1.5">
                        <Input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="새 상품 카테고리 추가…" className="h-7 text-xs flex-1" onKeyDown={(e) => e.key === "Enter" && addProductCategory()} />
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addProductCategory}><Plus className="size-3 mr-1" /> 추가</Button>
                      </div>
                    </>
                  )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {rows.map((row, idx) => {
              const ratio = (row.monthly / maxMonthly) * 100;
              const color = colorFor(row.channel, idx);
              const isTop = row.monthly === maxMonthly && row.monthly > 0;
              return (
                <div
                  key={row.channel}
                  className={cn(
                    "p-3.5 rounded-xl border transition-colors min-h-[112px]",
                    isTop
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-card hover:bg-accent/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2 gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="size-3 rounded-full shrink-0 ring-1 ring-white/20" style={{ background: color }} />
                      <span className="text-sm font-bold truncate leading-tight">{row.channel}</span>
                    </div>
                    {selectedProductFilter !== "전체" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold shrink-0">
                        <Filter className="size-2.5" />
                        {selectedProductFilter}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 leading-none">
                    <span className={cn(
                      "text-2xl font-black tabular-nums tracking-tight",
                      isTop ? "text-primary" : "text-foreground"
                    )}>{row.monthly}</span>
                    <span className="text-[11px] font-bold text-muted-foreground">건</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-1 leading-none">
                    <span className="text-base font-extrabold tabular-nums text-primary">+{row.today}</span>
                    <span className="text-[11px] font-semibold text-muted-foreground">오늘</span>
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

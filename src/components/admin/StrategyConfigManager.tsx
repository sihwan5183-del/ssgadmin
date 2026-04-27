import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Save, Plus, Trash2, AlertTriangle, Sparkles, Smartphone } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { toast } from "sonner";

interface StrategyProduct { name: string; target: number; color: string }
const DEFAULT_PRODUCTS: StrategyProduct[] = [
  { name: "인터넷", target: 80, color: "hsl(195 90% 60%)" },
  { name: "TV프리", target: 60, color: "hsl(270 90% 65%)" },
  { name: "스마트홈", target: 50, color: "hsl(320 90% 65%)" },
  { name: "대명", target: 30, color: "hsl(35 95% 60%)" },
];

export const StrategyConfigManager = () => {
  const { settings, upsert } = useAppSettings();
  const { models: deviceModels } = useDeviceModels();

  const [threshold, setThreshold] = useState<number>(
    Number(settings["inventory.low_stock_threshold"] ?? 3),
  );
  const [products, setProducts] = useState<StrategyProduct[]>(
    Array.isArray(settings["dashboard.strategy_products"]) && settings["dashboard.strategy_products"].length > 0
      ? (settings["dashboard.strategy_products"] as StrategyProduct[])
      : DEFAULT_PRODUCTS,
  );
  const [strategyModels, setStrategyModels] = useState<string[]>(
    Array.isArray(settings["dashboard.strategy_models"])
      ? (settings["dashboard.strategy_models"] as string[])
      : [],
  );

  useEffect(() => {
    if (typeof settings["inventory.low_stock_threshold"] === "number")
      setThreshold(settings["inventory.low_stock_threshold"]);
    if (Array.isArray(settings["dashboard.strategy_products"]))
      setProducts(settings["dashboard.strategy_products"] as StrategyProduct[]);
    if (Array.isArray(settings["dashboard.strategy_models"]))
      setStrategyModels(settings["dashboard.strategy_models"] as string[]);
  }, [settings]);

  const [draftProduct, setDraftProduct] = useState("");

  const addProduct = () => {
    const name = draftProduct.trim();
    if (!name) return;
    if (products.some((p) => p.name === name)) {
      toast.error("이미 존재하는 항목입니다");
      return;
    }
    setProducts([...products, { name, target: 30, color: "hsl(195 90% 60%)" }]);
    setDraftProduct("");
  };

  const updateProduct = (i: number, patch: Partial<StrategyProduct>) =>
    setProducts(products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const removeProduct = (i: number) => setProducts(products.filter((_, idx) => idx !== i));

  const toggleModel = (name: string) =>
    setStrategyModels(
      strategyModels.includes(name)
        ? strategyModels.filter((m) => m !== name)
        : [...strategyModels, name],
    );

  const [saving, setSaving] = useState(false);
  const saveAll = async () => {
    setSaving(true);
    const r1 = await upsert("inventory.low_stock_threshold", threshold);
    const r2 = await upsert("dashboard.strategy_products", products);
    const r3 = await upsert("dashboard.strategy_models", strategyModels);
    setSaving(false);
    const err = r1.error || r2.error || r3.error;
    if (err) toast.error(err.message);
    else toast.success("전략 설정이 저장되었습니다");
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              부족재고 임계값
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              모델별 보유 수량이 이 값 <b>이하</b>이면 '부족재고'로 강조 표시됩니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 max-w-xs">
          <Input
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="bg-input/60"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">대 이하</span>
        </div>
      </Card>

      <Card className="p-6 glass space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="size-4 text-primary-glow" />
            전략상품 (게이지)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            대시보드 전략상품 게이지에 표시되는 항목·목표·색상을 자유롭게 편집합니다
          </p>
        </div>

        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/40 bg-background/40">
              <span
                className="size-4 rounded-full shrink-0 border border-border/60"
                style={{ backgroundColor: p.color }}
              />
              <Input
                value={p.name}
                onChange={(e) => updateProduct(i, { name: e.target.value })}
                placeholder="상품명"
                className="h-9 bg-input/60 flex-1"
              />
              <Input
                type="number"
                min={0}
                value={p.target}
                onChange={(e) => updateProduct(i, { target: Number(e.target.value) })}
                className="h-9 bg-input/60 w-24"
                placeholder="목표"
              />
              <Input
                value={p.color}
                onChange={(e) => updateProduct(i, { color: e.target.value })}
                placeholder="hsl(195 90% 60%)"
                className="h-9 bg-input/60 w-44 font-mono text-[11px]"
              />
              <Button size="sm" variant="ghost" onClick={() => removeProduct(i)}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <Input
            value={draftProduct}
            onChange={(e) => setDraftProduct(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProduct()}
            placeholder="새 전략상품 (예: 부가서비스)"
            className="h-10 bg-input/60"
          />
          <Button onClick={addProduct}>
            <Plus className="size-4 mr-1" /> 추가
          </Button>
        </div>
      </Card>

      <Card className="p-6 glass space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Smartphone className="size-4 text-secondary" />
            전략모델 (대시보드 표기)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            대시보드 '전략모델 판매' 카드에 표시할 모델을 선택합니다 — 펫네임 기준 ({strategyModels.length}개 선택)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {deviceModels.length === 0 && (
            <p className="text-xs text-muted-foreground">먼저 '모델 마스터'에 모델을 등록하세요</p>
          )}
          {deviceModels.map((m) => {
            const active = strategyModels.includes(m.model_name);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModel(m.model_name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-glow"
                    : "bg-background/40 text-muted-foreground border-border/50 hover:border-primary/40"
                }`}
              >
                {m.model_name}
              </button>
            );
          })}
        </div>
        {strategyModels.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
            <Label className="text-xs text-muted-foreground w-full mb-1">선택됨:</Label>
            {strategyModels.map((m) => (
              <Badge key={m} variant="outline" className="text-[10px] border-primary/40 text-primary-foreground bg-primary/15">
                {m}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={saving} size="lg">
          <Save className="size-4 mr-2" />
          {saving ? "저장 중..." : "전략 설정 저장"}
        </Button>
      </div>
    </div>
  );
};

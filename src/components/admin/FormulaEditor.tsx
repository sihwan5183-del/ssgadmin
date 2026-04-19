import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { evaluateFormula, validateFormula } from "@/lib/formulaEngine";
import { Calculator, CheckCircle2, AlertCircle } from "lucide-react";

const DEFAULT_FORMULA =
  "unit_price + vas_fee - distributor_amount - extra_subsidy + cash_support_amount";
const DEFAULT_VARS = [
  "unit_price",
  "vas_fee",
  "distributor_amount",
  "extra_subsidy",
  "cash_support_amount",
  "receivable_amount",
];

export const FormulaEditor = () => {
  const [formula, setFormula] = useState(DEFAULT_FORMULA);
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARS);
  const [testValues, setTestValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["formula.net_fee", "formula.variables"])
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data ?? []).forEach((r: any) => (map[r.key] = r.value));
        if (typeof map["formula.net_fee"] === "string") setFormula(map["formula.net_fee"]);
        if (Array.isArray(map["formula.variables"])) setVariables(map["formula.variables"]);
      });
  }, []);

  const validation = validateFormula(formula, variables);
  const sampleVals: Record<string, number> = {};
  variables.forEach((v) => (sampleVals[v] = testValues[v] ?? 0));
  const previewResult = validation.ok ? evaluateFormula(formula, sampleVals) : null;

  const save = async () => {
    if (!validation.ok) return toast.error(validation.error);
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "formula.net_fee", value: formula }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("수식이 저장되었습니다 — 모든 화면에 즉시 반영됩니다");
  };

  return (
    <Card className="p-6 glass border-border/40">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="size-5 text-primary-glow" />
        <h3 className="text-lg font-semibold">수익(net_fee) 수식 편집기</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        사칙연산( + − × ÷ )과 괄호만 허용됩니다. 함수·조건문은 보안상 차단됩니다.
      </p>

      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">사용 가능한 변수</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {variables.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10"
                onClick={() => setFormula(formula + (formula.endsWith(" ") ? "" : " ") + v)}
              >
                {v}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">수식</Label>
          <Input
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="font-mono mt-1.5"
          />
          {validation.ok ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1.5">
              <CheckCircle2 className="size-3.5" /> 수식이 유효합니다
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
              <AlertCircle className="size-3.5" /> {validation.error}
            </div>
          )}
        </div>

        {/* 미리보기 */}
        <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">미리보기 계산기</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {variables.map((v) => (
              <div key={v}>
                <Label className="text-[11px] text-muted-foreground">{v}</Label>
                <Input
                  type="number"
                  value={testValues[v] ?? 0}
                  onChange={(e) =>
                    setTestValues({ ...testValues, [v]: Number(e.target.value) || 0 })
                  }
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mt-3 text-right">
            <span className="text-xs text-muted-foreground mr-2">결과:</span>
            <span className="text-lg font-bold tabular-nums text-primary-glow">
              {previewResult?.ok
                ? Math.round(previewResult.value!).toLocaleString("ko-KR") + " 원"
                : "—"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setFormula(DEFAULT_FORMULA)}
          >
            기본값 복원
          </Button>
          <Button onClick={save} disabled={saving || !validation.ok}>
            {saving ? "저장 중…" : "수식 저장"}
          </Button>
        </div>
      </div>
    </Card>
  );
};

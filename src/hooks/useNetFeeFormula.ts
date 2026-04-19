import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evaluateFormula } from "@/lib/formulaEngine";

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

/**
 * 관리자 설정에서 net_fee 수식·변수 목록을 실시간으로 가져온다.
 * 반환된 calc(row)로 어디서든 동일한 식으로 net_fee 계산 가능.
 */
export const useNetFeeFormula = () => {
  const [formula, setFormula] = useState<string>(DEFAULT_FORMULA);
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["formula.net_fee", "formula.variables"]);
      if (cancelled) return;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => (map[r.key] = r.value));
      if (typeof map["formula.net_fee"] === "string") setFormula(map["formula.net_fee"]);
      if (Array.isArray(map["formula.variables"])) setVariables(map["formula.variables"]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("formula-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const calc = (row: Record<string, any>): number => {
    const r = evaluateFormula(formula, row);
    return r.ok ? Math.round(r.value!) : 0;
  };

  return { formula, variables, calc, loading };
};

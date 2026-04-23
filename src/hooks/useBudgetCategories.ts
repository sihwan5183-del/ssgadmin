import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BudgetCategory {
  id: string;
  category_type: "지출" | "수익";
  label: string;
  field_mapping: string | null;
  description: string | null;
  dashboard_included: boolean;
  sort_order: number;
  active: boolean;
}

export function useBudgetCategories() {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("budget_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    setCategories((data ?? []) as any as BudgetCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const includedExpenseLabels = useMemo(
    () =>
      categories
        .filter((c) => c.category_type === "지출" && c.dashboard_included)
        .map((c) => c.label),
    [categories],
  );

  const includedRevenueLabels = useMemo(
    () =>
      categories
        .filter((c) => c.category_type === "수익" && c.dashboard_included)
        .map((c) => c.label),
    [categories],
  );

  const excludedLabels = useMemo(
    () => categories.filter((c) => !c.dashboard_included).map((c) => c.label),
    [categories],
  );

  const toggleDashboardIncluded = useCallback(
    async (id: string, current: boolean) => {
      const { error } = await supabase
        .from("budget_categories")
        .update({ dashboard_included: !current } as any)
        .eq("id", id);
      if (!error) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === id ? { ...c, dashboard_included: !current } : c,
          ),
        );
      }
      return error;
    },
    [],
  );

  return {
    categories,
    loading,
    reload: load,
    includedExpenseLabels,
    includedRevenueLabels,
    excludedLabels,
    toggleDashboardIncluded,
  };
}
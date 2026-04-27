import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FieldKey =
  | "channel"
  | "product"
  | "sale_type"
  | "open_method"
  | "status"
  | "rate_plan"
  | "delivery_type"
  | "bank"
  | "media"
  | "expense_type"
  | "inquiry_channel"
  | "fixed_expense_type"
  | "carrier"
  | "inquiry_status";

export interface FieldOption {
  id: string;
  field: string;
  value: string;
  sort_order: number;
  active: boolean;
}

export const useFieldOptions = (field: FieldKey) => {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("field_options")
      .select("value, sort_order, active")
      .eq("field", field)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    setOptions((data ?? []).map((d) => d.value as string));
    setLoading(false);
  }, [field]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { options, loading, refresh };
};

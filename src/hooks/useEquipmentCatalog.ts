import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EquipmentItem {
  id: string;
  equipment_name: string;
  category: string; // 'settop' | 'smarthome' | etc
  carrier: string | null;
  model_code: string | null;
  monthly_rental: number;
  sort_order: number;
  active: boolean;
  note: string | null;
}

/**
 * Loads equipment catalog (settop boxes, smarthome devices, etc.).
 * Use `getByCategory(cat)` to filter active items for a specific category.
 */
export const useEquipmentCatalog = () => {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("equipment_catalog" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    setItems(((data ?? []) as unknown) as EquipmentItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getByCategory = useCallback(
    (category: string): EquipmentItem[] =>
      items.filter((i) => i.active && i.category === category),
    [items],
  );

  return { items, loading, refresh, getByCategory };
};
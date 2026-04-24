import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Store {
  id: string;
  name: string;
  code: string | null;
  region: string | null;
  manager: string | null;
  phone: string | null;
  active: boolean;
}

export const useStores = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stores")
      .select("*")
      .order("name", { ascending: true });
    setStores((data ?? []) as Store[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`stores-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stores" },
        () => load(),
      );
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const byId = (id: string | null | undefined) =>
    id ? stores.find((s) => s.id === id) ?? null : null;

  return { stores, loading, refresh: load, byId };
};

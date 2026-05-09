import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FieldTeam {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useFieldTeams = (onlyActive = false) => {
  const [rows, setRows] = useState<FieldTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("field_teams" as any).select("*").order("sort_order").order("name");
    const { data } = await q;
    let list = ((data ?? []) as unknown as FieldTeam[]);
    if (onlyActive) list = list.filter((r) => r.active);
    setRows(list);
    setLoading(false);
  }, [onlyActive]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`field-teams-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "field_teams" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { rows, loading, refresh: load };
};
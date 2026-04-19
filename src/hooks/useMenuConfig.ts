import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MenuRole = "admin" | "manager" | "user";

export interface MenuGroup {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  visible_roles: MenuRole[];
  active: boolean;
}

export interface MenuItem {
  id: string;
  group_id: string | null;
  label: string;
  path: string;
  icon: string;
  sort_order: number;
  visible_roles: MenuRole[];
  active: boolean;
  is_admin_only: boolean;
}

export function useMenuConfig() {
  const [groups, setGroups] = useState<MenuGroup[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: g }, { data: i }] = await Promise.all([
      supabase.from("menu_groups").select("*").order("sort_order"),
      supabase.from("menu_items").select("*").order("sort_order"),
    ]);
    setGroups(((g ?? []) as any[]) as MenuGroup[]);
    setItems(((i ?? []) as any[]) as MenuItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("menu-config")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_groups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh]);

  return { groups, items, loading, refresh };
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FieldType = "text" | "number" | "date" | "select" | "boolean" | "textarea";

export interface FieldDefinition {
  id: string;
  table_name: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  visible_in_list: boolean;
  visible_in_form: boolean;
  section: string | null;
  sort_order: number;
  default_value: string | null;
  active: boolean;
}

export const useFieldDefinitions = (tableName: string) => {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("field_definitions")
      .select("*")
      .eq("table_name", tableName)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (!error) {
      setFields(
        (data ?? []).map((d: any) => ({
          ...d,
          options: Array.isArray(d.options) ? d.options : [],
        })),
      );
    }
    setLoading(false);
  }, [tableName]);

  useEffect(() => {
    load();
    const channelName = `field-defs-${tableName}-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "field_definitions" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [tableName, load]);

  return { fields, loading, refresh: load };
};

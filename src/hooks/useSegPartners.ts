import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SegPartner {
  id: string;
  company_name: string;
  business_type: string;
  contract_type: string | null;
  contract_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  contract_detail: string | null;
  status: string;
  assignee: string | null;
  assignee_name: string | null;
  note: string | null;
  custom_fields: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSegPartners() {
  const [partners, setPartners] = useState<SegPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("seg_partners")
      .select("*")
      .order("created_at", { ascending: false });
    setPartners((data ?? []) as SegPartner[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = (supabase as any)
      .channel(`seg-partners-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seg_partners" }, refresh)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [refresh]);

  return { partners, loading, refresh };
}

export interface SegActivity {
  id: string;
  partner_id: string;
  activity_date: string;
  activity_time: string | null;
  activity_type: string;
  title: string | null;
  content: string | null;
  next_action_date: string | null;
  next_action_note: string | null;
  is_completed: boolean;
  completed_at: string | null;
  assignee: string | null;
  assignee_name: string | null;
  location: string | null;
  custom_fields: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSegActivities(partnerId?: string) {
  const [activities, setActivities] = useState<SegActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("seg_activities").select("*");
    if (partnerId) q = q.eq("partner_id", partnerId);
    const { data } = await q.order("activity_date", { ascending: false }).order("created_at", { ascending: false });
    setActivities((data ?? []) as SegActivity[]);
    setLoading(false);
  }, [partnerId]);

  useEffect(() => {
    refresh();
    const ch = (supabase as any)
      .channel(`seg-activities-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seg_activities" }, refresh)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [refresh]);

  return { activities, loading, refresh };
}

export interface SegAttachment {
  id: string;
  partner_id: string | null;
  activity_id: string | null;
  file_name: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  doc_type: string | null;
  uploaded_by: string;
  created_at: string;
}
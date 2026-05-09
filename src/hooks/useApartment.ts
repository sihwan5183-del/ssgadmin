import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ApartmentPosting {
  id: string;
  team: string | null;
  apartment_name: string;
  location_detail: string | null;
  start_date: string;
  end_date: string;
  note: string | null;
  custom_fields: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ApartmentLead {
  id: string;
  posting_id: string | null;
  team: string | null;
  apartment_name: string | null;
  inquiry_date: string;
  customer_name: string;
  customer_phone: string | null;
  current_carrier: string | null;
  inquiry_note: string | null;
  result_status: string;
  custom_fields: Record<string, unknown>;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export const useApartmentPostings = () => {
  const [rows, setRows] = useState<ApartmentPosting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("apartment_postings")
      .select("*")
      .order("end_date", { ascending: false });
    setRows((data ?? []) as unknown as ApartmentPosting[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`apt-postings-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "apartment_postings" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { rows, loading, refresh: load };
};

export const useApartmentLeads = () => {
  const [rows, setRows] = useState<ApartmentLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("apartment_leads")
      .select("*")
      .order("inquiry_date", { ascending: false });
    setRows((data ?? []) as unknown as ApartmentLead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`apt-leads-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "apartment_leads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { rows, loading, refresh: load };
};

export type PostingStatus = "게시중" | "종료됨" | "예정";
export const computePostingStatus = (p: Pick<ApartmentPosting, "start_date" | "end_date">): PostingStatus => {
  const today = new Date().toISOString().slice(0, 10);
  if (p.start_date > today) return "예정";
  if (p.end_date < today) return "종료됨";
  return "게시중";
};

export const RESULT_STATUSES = ["상담중", "개통완료", "거절", "보류"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
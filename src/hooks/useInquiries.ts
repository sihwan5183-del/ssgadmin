import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const INQUIRY_STATUSES = ["문의중", "방문예약", "개통완료", "종료"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export interface Inquiry {
  id: string;
  inquiry_date: string;
  channel: string;
  customer_name: string | null;
  phone: string | null;
  content: string | null;
  manager: string | null;
  status: InquiryStatus | string;
  converted_sale_id: string | null;
  note: string | null;
  custom_fields: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  campaign_name?: string | null;
}

interface Range {
  startDate?: string;
  endDate?: string;
}

export const useInquiries = (range?: Range) => {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("inquiries")
      .select("*")
      .order("inquiry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (range?.startDate) q = q.gte("inquiry_date", range.startDate);
    if (range?.endDate) q = q.lte("inquiry_date", range.endDate);
    const { data, error } = await q;
    if (error) {
      setError(error.message);
    } else {
      setRows((data ?? []) as Inquiry[]);
    }
    setLoading(false);
  }, [range?.startDate, range?.endDate]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`realtime:inquiries:${range?.startDate ?? ""}:${range?.endDate ?? ""}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, range?.startDate, range?.endDate]);

  return { rows, loading, error, refresh };
};

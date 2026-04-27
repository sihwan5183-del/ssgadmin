import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// 관리자가 field_options 의 field='inquiry_status' 로 등록한 값을 사용.
// 비어 있으면 합리적인 기본값을 사용 (시스템 기본 CRM 상태).
const FALLBACK_STATUSES = [
  "미처리",
  "문의중",
  "부재",
  "재케어",
  "실패",
  "방문예약",
  "개통완료",
];

export const useInquiryStatuses = () => {
  const [statuses, setStatuses] = useState<string[]>(FALLBACK_STATUSES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("field_options")
      .select("value, sort_order, active")
      .eq("field", "inquiry_status")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    const list = (data ?? []).map((d) => d.value as string).filter(Boolean);
    setStatuses(list.length > 0 ? list : FALLBACK_STATUSES);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { statuses, loading, refresh };
};

export { FALLBACK_STATUSES as DEFAULT_INQUIRY_STATUSES };
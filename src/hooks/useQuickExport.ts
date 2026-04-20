// 카테고리별 빠른 다운로드 + 마지막 업데이트 시간 헬퍼
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

export type ExportCategory = "sales" | "inquiries" | "incentives" | "staff";

export interface ExportFilters {
  start_date?: string | null;
  end_date?: string | null;
  manager?: string | null;
  channel?: string | null;
  device_model?: string | null;
  status?: string | null;
}

export const useQuickExport = () => {
  const [busy, setBusy] = useState<ExportCategory | null>(null);

  const exportNow = useCallback(async (category: ExportCategory, filters: ExportFilters = {}) => {
    setBusy(category);
    try {
      const { data, error } = await supabase.functions.invoke("export-data", {
        body: { category, filters },
      });
      if (error) throw error;
      if (data?.signed_url) {
        const a = document.createElement("a");
        a.href = data.signed_url;
        a.download = data.file_name ?? "export.xlsx";
        document.body.appendChild(a); a.click(); a.remove();
        toast.success("다운로드 완료", {
          description: `${data.row_count?.toLocaleString() ?? 0}건 — 다운로드 센터에서 다시 받을 수 있습니다`,
        });
      } else {
        toast.success("생성 완료", { description: "다운로드 센터에서 받기" });
      }
    } catch (e) {
      toast.error("다운로드 실패", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }, []);

  return { busy, exportNow };
};

const TABLE_MAP: Record<ExportCategory, string> = {
  sales: "sales",
  inquiries: "inquiries",
  incentives: "sales",
  staff: "profiles",
};

export const useLastUpdated = (category: ExportCategory) => {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchLast = useCallback(async () => {
    const { data } = await supabase
      .from(TABLE_MAP[category] as any)
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setUpdatedAt((data as any)?.updated_at ?? null);
  }, [category]);

  useEffect(() => { fetchLast(); }, [fetchLast]);

  const text = updatedAt
    ? `데이터 ${formatDistanceToNow(new Date(updatedAt), { addSuffix: true, locale: ko })} 업데이트`
    : "데이터 업데이트 시간 미상";

  return { updatedAt, text, refresh: fetchLast };
};

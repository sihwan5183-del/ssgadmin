import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SegActivity } from "@/hooks/useSegPartners";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activity: SegActivity | null;
  onSaved?: () => void;
}

export function ActivityReportDialog({ open, onOpenChange, activity, onSaved }: Props) {
  const [regularsCount, setRegularsCount] = useState("");
  const [reportMemo, setReportMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && activity) {
      const cf = (activity.custom_fields as any) ?? {};
      setRegularsCount(cf.regulars_count != null ? String(cf.regulars_count) : "");
      setReportMemo(cf.report_memo ?? "");
    }
  }, [open, activity]);

  if (!activity) return null;

  const onSubmit = async () => {
    setSaving(true);
    try {
      const cf = { ...((activity.custom_fields as any) ?? {}) };
      cf.regulars_count = regularsCount ? Number(regularsCount) : null;
      cf.report_memo = reportMemo || null;
      cf.reported_at = new Date().toISOString();

      // 메모 컬럼에 보고 내용을 즉시 반영 (기존 메모는 보존)
      const stamp = `[활동보고 ${new Date().toLocaleDateString("ko-KR")}] 단골등록 ${cf.regulars_count ?? 0}건${reportMemo ? ` · ${reportMemo}` : ""}`;
      const baseContent = (activity.content ?? "").replace(/\n?\[활동보고[^\]]*\][^\n]*/g, "").trim();
      const nextContent = baseContent ? `${baseContent}\n${stamp}` : stamp;

      const { error } = await (supabase as any)
        .from("seg_activities")
        .update({ custom_fields: cf, content: nextContent })
        .eq("id", activity.id);
      if (error) throw error;
      toast.success("활동보고가 저장되었습니다");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>활동보고 · {activity.title || "-"}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">{activity.activity_date}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">단골고객 등록 건수</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={regularsCount}
              onChange={(e) => setRegularsCount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="예: 5"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">활동 성과 메모</Label>
            <Textarea
              rows={6}
              value={reportMemo}
              onChange={(e) => setReportMemo(e.target.value)}
              placeholder="오늘 영업 활동의 성과·특이사항을 자유롭게 작성하세요"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "저장 중…" : "보고 저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PRIORITIES = [
  { value: "high", label: "상", className: "text-rose-600" },
  { value: "mid", label: "중", className: "text-amber-600" },
  { value: "low", label: "하", className: "text-emerald-600" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string; // yyyy-MM-dd
  onSaved?: () => void;
}

export function QuickScheduleDialog({ open, onOpenChange, defaultDate, onSaved }: Props) {
  const { user } = useAuth();
  const [activityName, setActivityName] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [priority, setPriority] = useState("mid");
  const [content, setContent] = useState("");
  const [partnerCount, setPartnerCount] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const date = defaultDate ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (open) {
      setActivityName("");
      setAssigneeName("");
      setPriority("mid");
      setContent("");
      setPartnerCount("");
      // 활동명 칸 자동 포커스
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  const onSubmit = async () => {
    if (!user) return;
    const name = activityName.trim();
    if (!name) { toast.error("활동명을 입력하세요"); nameRef.current?.focus(); return; }

    // 활동명을 임시 파트너로 저장 (제약 없는 자유 입력 보장)
    setSaving(true);
    try {
      // 동일한 자유 입력 활동명에 대해 partner 1건을 (자동) 보장 — 매번 새로 만들지 않도록 가벼운 재사용
      let pid: string | null = null;
      const { data: existing } = await (supabase as any)
        .from("seg_partners")
        .select("id")
        .eq("company_name", name)
        .eq("created_by", user.id)
        .maybeSingle();
      if (existing?.id) {
        pid = existing.id;
      } else {
        const { data, error } = await (supabase as any)
          .from("seg_partners")
          .insert({
            company_name: name,
            business_type: "기타",
            status: "잠재",
            assignee_name: assigneeName || null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        pid = data.id;
      }

      const { error } = await (supabase as any).from("seg_activities").insert({
        partner_id: pid,
        activity_date: date,
        activity_type: "기타",
        title: name,
        content: content || null,
        is_completed: false,
        assignee_name: assigneeName || null,
        custom_fields: {
          priority,
          activity_name: name,
          partner_count: partnerCount ? Number(partnerCount) : null,
        },
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("일정을 등록했습니다");
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
          <DialogTitle>새 일정 등록 · {date}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">활동명</Label>
            <Input
              ref={nameRef}
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="자유롭게 입력 (예: 강남센터 방문)"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              list="no-autocomplete"
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit(); }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">담당자</Label>
              <Input
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                placeholder="담당자명"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">중요도</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={p.className}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">타사등록 갯수 (선택)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={partnerCount}
              onChange={(e) => setPartnerCount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="예: 3"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">메모 (선택)</Label>
            <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="활동 메모" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "저장 중…" : "등록"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
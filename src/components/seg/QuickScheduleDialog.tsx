import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useSegPartners } from "@/hooks/useSegPartners";
import { Plus } from "lucide-react";

const VISIT_PURPOSES = ["방문", "MOU", "상담", "제안", "계약", "사후관리", "이벤트", "기타"];
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
  const { partners } = useSegPartners();
  const [partnerId, setPartnerId] = useState<string>("");
  const [newCompany, setNewCompany] = useState("");
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [purpose, setPurpose] = useState("방문");
  const [assigneeName, setAssigneeName] = useState("");
  const [time, setTime] = useState("");
  const [priority, setPriority] = useState("mid");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const date = defaultDate ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (open) {
      setPartnerId("");
      setNewCompany("");
      setCreatingPartner(false);
      setPurpose("방문");
      setAssigneeName("");
      setTime("");
      setPriority("mid");
      setTitle("");
      setContent("");
    }
  }, [open]);

  const sortedPartners = useMemo(
    () => [...partners].sort((a, b) => a.company_name.localeCompare(b.company_name, "ko")),
    [partners],
  );

  const onSubmit = async () => {
    if (!user) return;
    let pid = partnerId;
    if (creatingPartner) {
      const name = newCompany.trim();
      if (!name) { toast.error("업체명을 입력하세요"); return; }
      setSaving(true);
      try {
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
      } catch (e: any) {
        setSaving(false);
        toast.error(e?.message ?? "업체 등록 실패");
        return;
      }
    }
    if (!pid) { toast.error("업체를 선택하거나 신규 등록하세요"); return; }

    setSaving(true);
    try {
      const { error } = await (supabase as any).from("seg_activities").insert({
        partner_id: pid,
        activity_date: date,
        activity_time: time || null,
        activity_type: purpose,
        title: title || null,
        content: content || null,
        is_completed: false,
        assignee_name: assigneeName || null,
        custom_fields: { priority },
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>새 일정 등록 · {date}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">업체명</Label>
            {!creatingPartner ? (
              <div className="flex gap-2">
                <Select value={partnerId} onValueChange={setPartnerId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="업체 선택" /></SelectTrigger>
                  <SelectContent>
                    {sortedPartners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setCreatingPartner(true)} title="신규 업체">
                  <Plus className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="신규 업체명 입력" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingPartner(false)}>취소</Button>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">방문 목적</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{VISIT_PURPOSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">시간</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">담당자</Label>
            <Input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} placeholder="담당자명" />
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
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">제목</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 1차 미팅 - 제안서 전달" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">메모</Label>
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
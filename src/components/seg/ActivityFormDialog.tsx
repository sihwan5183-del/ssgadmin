import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SegActivity, SegPartner } from "@/hooks/useSegPartners";
import { Paperclip, X } from "lucide-react";

const ACTIVITY_TYPES = ["방문", "전화", "제안", "계약", "사후관리", "이벤트", "기타"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner: SegPartner;
  activity?: SegActivity | null;
  onSaved?: () => void;
}

export function ActivityFormDialog({ open, onOpenChange, partner, activity, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<SegActivity>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        activity ?? {
          activity_type: "방문",
          activity_date: new Date().toISOString().slice(0, 10),
          is_completed: false,
        }
      );
      setFiles([]);
    }
  }, [open, activity]);

  const set = <K extends keyof SegActivity>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async () => {
    if (!user) return;
    if (!form.content?.trim() && !form.title?.trim()) {
      toast.error("활동 내용을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        partner_id: partner.id,
        activity_date: form.activity_date || new Date().toISOString().slice(0, 10),
        activity_time: form.activity_time || null,
        activity_type: form.activity_type || "방문",
        title: form.title || null,
        content: form.content || null,
        next_action_date: form.next_action_date || null,
        next_action_note: form.next_action_note || null,
        is_completed: !!form.is_completed,
        assignee_name: form.assignee_name || null,
        location: form.location || null,
      };
      let activityId = activity?.id;
      if (activity?.id) {
        const { error } = await (supabase as any).from("seg_activities").update(payload).eq("id", activity.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("seg_activities")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        activityId = data.id;
      }
      // upload files
      for (const f of files) {
        const path = `${user.id}/${partner.id}/${activityId}/${Date.now()}_${f.name}`;
        const { error: upErr } = await (supabase as any).storage.from("seg-files").upload(path, f);
        if (upErr) { toast.error(`파일 업로드 실패: ${f.name}`); continue; }
        await (supabase as any).from("seg_attachments").insert({
          partner_id: partner.id,
          activity_id: activityId,
          file_name: f.name,
          storage_path: path,
          file_size: f.size,
          mime_type: f.type,
          uploaded_by: user.id,
        });
      }
      toast.success(activity ? "활동을 수정했습니다" : "활동을 등록했습니다");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{partner.company_name} · {activity ? "활동 수정" : "활동 등록"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="활동 일자">
            <Input type="date" value={form.activity_date ?? ""} onChange={(e) => set("activity_date", e.target.value)} />
          </Field>
          <Field label="시간">
            <Input type="time" value={form.activity_time ?? ""} onChange={(e) => set("activity_time", e.target.value)} />
          </Field>
          <Field label="활동 구분">
            <Select value={form.activity_type ?? "방문"} onValueChange={(v) => set("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="장소">
            <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="제목" full>
            <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="예: 1회차 방문 - 제안서 전달" />
          </Field>
          <Field label="활동 내용" full>
            <Textarea rows={4} value={form.content ?? ""} onChange={(e) => set("content", e.target.value)} placeholder="상담 기록 및 특이사항" />
          </Field>
          <Field label="다음 활동 예정일">
            <Input type="date" value={form.next_action_date ?? ""} onChange={(e) => set("next_action_date", e.target.value)} />
          </Field>
          <Field label="다음 활동 내용">
            <Input value={form.next_action_note ?? ""} onChange={(e) => set("next_action_note", e.target.value)} placeholder="예: 계약서 수령" />
          </Field>
          <Field label="담당자">
            <Input value={form.assignee_name ?? ""} onChange={(e) => set("assignee_name", e.target.value)} />
          </Field>
          <div className="space-y-1.5 flex items-center gap-3 pt-6">
            <Switch checked={!!form.is_completed} onCheckedChange={(v) => set("is_completed", v)} />
            <Label className="text-sm">완료 처리</Label>
          </div>
          <Field label="첨부 파일" full>
            <div className="space-y-2">
              <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-muted">
                      <Paperclip className="size-3" /> {f.name}
                      <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="ml-1">
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
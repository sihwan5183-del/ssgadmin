import { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SegActivity } from "@/hooks/useSegPartners";

const PRIORITIES = [
  { value: "high", label: "상", className: "text-rose-600" },
  { value: "mid", label: "중", className: "text-amber-600" },
  { value: "low", label: "하", className: "text-emerald-600" },
];

function DatePopover({
  label, value, onChange, min, clearable,
}: { label: string; value: string; onChange: (v: string) => void; min?: string; clearable?: boolean }) {
  const date = value ? parseISO(value) : undefined;
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full h-9 justify-start text-left font-normal text-xs", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="size-3.5 mr-1.5 opacity-70" />
            {date ? format(date, "yyyy-MM-dd (eee)", { locale: ko }) : "날짜 선택"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : "")}
            disabled={min ? (d) => format(d, "yyyy-MM-dd") < min : undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
          {clearable && value && (
            <div className="p-2 border-t">
              <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => onChange("")}>지우기</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string; // yyyy-MM-dd
  onSaved?: () => void;
  editing?: SegActivity | null;
}

export function QuickScheduleDialog({ open, onOpenChange, defaultDate, onSaved, editing }: Props) {
  const { user } = useAuth();
  const [activityName, setActivityName] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [priority, setPriority] = useState("mid");
  const [content, setContent] = useState("");
  const [partnerCount, setPartnerCount] = useState<string>("");
  const [activityDate, setActivityDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editing;

  useEffect(() => {
    if (open) {
      if (editing) {
        const cf = (editing.custom_fields as any) ?? {};
        setActivityName(editing.title ?? "");
        setAssigneeName(editing.assignee_name ?? "");
        setPriority(cf.priority ?? "mid");
        setContent(editing.content ?? "");
        setPartnerCount(cf.partner_count != null ? String(cf.partner_count) : "");
        setActivityDate(editing.activity_date);
        setEndDate(cf.end_date ?? "");
      } else {
        setActivityName("");
        setAssigneeName("");
        setPriority("mid");
        setContent("");
        setPartnerCount("");
        setActivityDate(defaultDate ?? new Date().toISOString().slice(0, 10));
        setEndDate("");
      }
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, editing, defaultDate]);

  const onSubmit = async () => {
    if (!user) return;
    const name = activityName.trim();
    if (!name) { toast.error("활동명을 입력하세요"); nameRef.current?.focus(); return; }
    if (!activityDate) { toast.error("시작 날짜를 선택하세요"); return; }
    if (endDate && endDate < activityDate) { toast.error("종료일이 시작일보다 빠를 수 없습니다"); return; }
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");
    if (!isEdit && activityDate < today) {
      const ok = window.confirm("과거 날짜에 일정을 등록하시겠습니까?");
      if (!ok) return;
    }

    setSaving(true);
    try {
      if (isEdit && editing) {
        const cf = { ...((editing.custom_fields as any) ?? {}) };
        cf.priority = priority;
        cf.activity_name = name;
        cf.partner_count = partnerCount ? Number(partnerCount) : null;
        cf.end_date = endDate || null;
        const { error } = await (supabase as any)
          .from("seg_activities")
          .update({
            activity_date: activityDate,
            title: name,
            content: content || null,
            assignee_name: assigneeName || null,
            custom_fields: cf,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("일정이 수정되었습니다");
        onSaved?.();
        onOpenChange(false);
        return;
      }

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
        activity_date: activityDate,
        activity_type: "기타",
        title: name,
        content: content || null,
        is_completed: false,
        assignee_name: assigneeName || null,
        custom_fields: {
          priority,
          activity_name: name,
          partner_count: partnerCount ? Number(partnerCount) : null,
          end_date: endDate || null,
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
          <DialogTitle>{isEdit ? "일정 수정" : "새 일정 등록"} · {activityDate}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
              <CalendarIcon className="size-3.5" /> 활동 날짜
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <DatePopover label="시작" value={activityDate} onChange={setActivityDate} />
              <DatePopover label="종료(선택)" value={endDate} onChange={setEndDate} min={activityDate} clearable />
            </div>
            {endDate && endDate < activityDate && (
              <p className="text-[11px] text-rose-600">종료일이 시작일보다 빠를 수 없습니다.</p>
            )}
          </div>
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
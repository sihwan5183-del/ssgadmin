import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { INQUIRY_STATUSES } from "@/hooks/useInquiries";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Props {
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export const InquiryForm = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const { options: channels } = useFieldOptions("inquiry_channel" as any);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    inquiry_date: today(),
    channel: "",
    customer_name: "",
    phone: "",
    content: "",
    manager: "",
    status: "문의중" as string,
    note: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.channel) {
      toast.error("채널을 선택해주세요");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("inquiries").insert({
      inquiry_date: form.inquiry_date,
      channel: form.channel,
      customer_name: form.customer_name || null,
      phone: form.phone || null,
      content: form.content || null,
      manager: form.manager || null,
      status: form.status,
      note: form.note || null,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error("저장 실패", { description: error.message });
      return;
    }
    toast.success("인입 등록 완료");
    setForm({
      inquiry_date: today(),
      channel: "",
      customer_name: "",
      phone: "",
      content: "",
      manager: "",
      status: "문의중",
      note: "",
    });
    onSaved();
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">날짜</Label>
          <Input type="date" value={form.inquiry_date} onChange={(e) => set("inquiry_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">채널 *</Label>
          <Select value={form.channel} onValueChange={(v) => set("channel", v)}>
            <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
            <SelectContent>
              {channels.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">고객명/가상번호</Label>
          <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">연락처</Label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">담당자</Label>
          <Input value={form.manager} onChange={(e) => set("manager", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">상태</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INQUIRY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-4 space-y-1.5">
          <Label className="text-xs">문의내용</Label>
          <Textarea rows={2} value={form.content} onChange={(e) => set("content", e.target.value)} />
        </div>
        <div className="col-span-2 md:col-span-4 flex justify-end">
          <Button type="submit" disabled={busy} className="gap-2">
            <Plus className="size-4" /> {busy ? "저장 중…" : "인입 등록"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

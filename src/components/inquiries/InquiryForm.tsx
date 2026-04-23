import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { DynamicFieldRenderer } from "@/components/admin/DynamicFieldRenderer";
import { INQUIRY_STATUSES } from "@/hooks/useInquiries";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Props {
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

// 인입 테이블의 실제 컬럼 (이외는 custom_fields에 저장)
const NATIVE_KEYS = new Set([
  "channel",
  "customer_name",
  "phone",
  "content",
  "manager",
  "note",
]);

export const InquiryForm = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const { fields, loading } = useFieldDefinitions("inquiries");
  const [busy, setBusy] = useState(false);
  const [inquiryDate, setInquiryDate] = useState(today());
  const [status, setStatus] = useState<string>("문의중");
  const [values, setValues] = useState<Record<string, any>>({});

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // 필수 필드 검증
    for (const f of fields) {
      if (f.required && f.visible_in_form && !values[f.field_key]) {
        toast.error(`'${f.label}' 항목은 필수입니다`);
        return;
      }
    }

    // native vs custom 분리
    const native: Record<string, any> = {};
    const custom: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.field_key];
      if (v === undefined || v === "") continue;
      if (NATIVE_KEYS.has(f.field_key)) native[f.field_key] = v;
      else custom[f.field_key] = v;
    }

    if (!native.channel) {
      toast.error("채널을 선택해주세요");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("inquiries").insert({
      inquiry_date: inquiryDate,
      channel: native.channel,
      customer_name: native.customer_name || null,
      phone: native.phone || null,
      content: native.content || null,
      manager: native.manager || null,
      note: native.note || null,
      status,
      custom_fields: custom,
      created_by: user.id,
    });
    setBusy(false);
    if (error) {
      toast.error("저장 실패", { description: error.message });
      return;
    }
    toast.success("인입 등록 완료");
    setValues({});
    setStatus("문의중");
    setInquiryDate(today());
    onSaved();
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 시스템 필드: 날짜/상태는 고정 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">날짜</Label>
          <Input type="date" value={inquiryDate} onChange={(e) => setInquiryDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">상태</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INQUIRY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* 관리자가 정의한 동적 필드 */}
        {!loading && (
          <DynamicFieldRenderer fields={fields} values={values} onChange={setValues} />
        )}

        <div className="col-span-2 md:col-span-4 flex justify-end">
          <Button type="submit" disabled={busy} className="gap-2">
            <Plus className="size-4" /> {busy ? "저장 중…" : "인입 등록"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { DynamicFieldRenderer } from "@/components/admin/DynamicFieldRenderer";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useInquiryStatuses } from "@/hooks/useInquiryStatuses";
import { inquiryStatusClass, inquiryStatusSoftClass, INQUIRY_DEFAULT_STATUS } from "@/lib/inquiryStatus";
import { cn } from "@/lib/utils";
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
  "birth_date",
]);

export const InquiryForm = ({ onSaved }: Props) => {
  const { user } = useAuth();
  const { fields, loading } = useFieldDefinitions("inquiries");
  const { options: channelOptions } = useFieldOptions("inquiry_channel");
  const { statuses } = useInquiryStatuses();
  const [busy, setBusy] = useState(false);
  const [inquiryDate, setInquiryDate] = useState(today());
  const [status, setStatus] = useState<string>(INQUIRY_DEFAULT_STATUS);
  const [values, setValues] = useState<Record<string, any>>({});
  // 고객 정보 세트 (이름·생년월일·연락처)
  const [customerName, setCustomerName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  // 관리자 상태 목록이 로드되면 기본값('상담전')이 목록에 있으면 유지,
  // 없으면 첫 번째 항목을 기본값으로 사용.
  useEffect(() => {
    if (statuses.length === 0) return;
    if (!statuses.includes(status)) {
      const next = statuses.includes(INQUIRY_DEFAULT_STATUS)
        ? INQUIRY_DEFAULT_STATUS
        : statuses[0];
      setStatus(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // 동적 필드의 'channel' 옵션을 어드민 [인입 채널] 설정과 100% 동일하게 강제 동기화
  const syncedFields = fields.map((f) =>
    f.field_key === "channel"
      ? { ...f, field_type: "select" as const, options: channelOptions }
      : f,
  );

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

    if (birthDate && !/^\d{6}$/.test(birthDate)) {
      toast.error("생년월일은 숫자 6자리(예: 900101)로 입력해주세요");
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("inquiries").insert({
      inquiry_date: inquiryDate,
      channel: native.channel,
      customer_name: (customerName || native.customer_name || null) as string | null,
      phone: (phone || native.phone || null) as string | null,
      birth_date: birthDate || null,
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
    setCustomerName("");
    setBirthDate("");
    setPhone("");
    setStatus(statuses.includes(INQUIRY_DEFAULT_STATUS) ? INQUIRY_DEFAULT_STATUS : (statuses[0] ?? INQUIRY_DEFAULT_STATUS));
    setInquiryDate(today());
    onSaved();
  };

  // 고객 정보 세트는 폼 상단에 고정 노출하므로, 동적 필드에서는 중복 제거
  const visibleFields = syncedFields.filter(
    (f) => !["customer_name", "phone", "birth_date"].includes(f.field_key),
  );

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
            <SelectTrigger
              className={cn(
                "border border-border/40 font-medium transition-colors hover:border-border hover:brightness-[0.97]",
                inquiryStatusSoftClass(status),
              )}
            >
              <SelectValue>{status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  <Badge variant="outline" className={cn("text-xs", inquiryStatusClass(s))}>
                    {s}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 고객 정보 세트: 고객명 · 생년월일 · 연락처 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">고객명</Label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="홍길동"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">생년월일</Label>
          <Input
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value.replace(/\D+/g, "").slice(0, 6))}
            placeholder="900101"
            inputMode="numeric"
            maxLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">연락처</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(formatPhoneLocal(e.target.value))}
            placeholder="010-0000-0000"
            type="tel"
            inputMode="numeric"
            maxLength={13}
          />
        </div>

        {/* 관리자가 정의한 동적 필드 */}
        {!loading && (
          <DynamicFieldRenderer fields={visibleFields} values={values} onChange={setValues} />
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

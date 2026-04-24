import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { SegPartner } from "@/hooks/useSegPartners";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner?: SegPartner | null;
  onSaved?: () => void;
}

const BUSINESS_TYPES = ["법인", "개인사업자", "기타"];
const CONTRACT_TYPES = ["MOU", "전단지", "공동구매", "제휴", "이벤트", "기타"];
const STATUSES = [
  { value: "active", label: "진행중" },
  { value: "paused", label: "보류" },
  { value: "ended", label: "종료" },
];

export function PartnerFormDialog({ open, onOpenChange, partner, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<SegPartner>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        partner ?? {
          business_type: "법인",
          status: "active",
          contract_date: new Date().toISOString().slice(0, 10),
        }
      );
    }
  }, [open, partner]);

  const set = <K extends keyof SegPartner>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async () => {
    if (!form.company_name?.trim()) {
      toast.error("업체명을 입력하세요");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        company_name: form.company_name!.trim(),
        business_type: form.business_type || "법인",
        contract_type: form.contract_type || null,
        contract_date: form.contract_date || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
        address: form.address || null,
        contract_detail: form.contract_detail || null,
        status: form.status || "active",
        assignee: form.assignee || null,
        assignee_name: form.assignee_name || null,
        note: form.note || null,
      };
      if (partner?.id) {
        const { error } = await (supabase as any).from("seg_partners").update(payload).eq("id", partner.id);
        if (error) throw error;
        toast.success("업체 정보를 수정했습니다");
      } else {
        const { error } = await (supabase as any).from("seg_partners").insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success("업체를 등록했습니다");
      }
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
          <DialogTitle>{partner ? "업체 정보 수정" : "신규 업체 등록"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="업체명 *">
            <Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} />
          </Field>
          <Field label="업체 유형">
            <Select value={form.business_type ?? "법인"} onValueChange={(v) => set("business_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="계약 유형">
            <Select value={form.contract_type ?? ""} onValueChange={(v) => set("contract_type", v)}>
              <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
              <SelectContent>{CONTRACT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="계약일">
            <Input type="date" value={form.contract_date ?? ""} onChange={(e) => set("contract_date", e.target.value)} />
          </Field>
          <Field label="담당자명">
            <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="담당자 연락처">
            <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} />
          </Field>
          <Field label="담당자 이메일">
            <Input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
          </Field>
          <Field label="상태">
            <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="주소" full>
            <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="우리측 담당직원">
            <Input value={form.assignee_name ?? ""} onChange={(e) => set("assignee_name", e.target.value)} placeholder="이름" />
          </Field>
          <Field label="계약 상세 내용" full>
            <Textarea rows={3} value={form.contract_detail ?? ""} onChange={(e) => set("contract_detail", e.target.value)} />
          </Field>
          <Field label="메모" full>
            <Textarea rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} />
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
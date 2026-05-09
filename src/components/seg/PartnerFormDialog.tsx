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
import { Upload, X, FileText, ImageIcon, Paperclip, Lock } from "lucide-react";
import { formatPhone } from "@/lib/phoneFormat";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner?: SegPartner | null;
  onSaved?: () => void;
}

const BUSINESS_TYPES = ["법인", "개인사업자", "기타"];
const CONTRACT_TYPES = ["MOU", "전단지", "공동구매", "제휴", "이벤트", "기타"];
const ACTIVITY_CATEGORIES = ["자체 점두행사", "법인 MOU", "아파트 게시판", "기타"];
const STATUSES = [
  { value: "active", label: "진행중" },
  { value: "paused", label: "보류" },
  { value: "ended", label: "종료" },
];

export function PartnerFormDialog({ open, onOpenChange, partner, onSaved }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<SegPartner>>({});
  const [saving, setSaving] = useState(false);
  const [pricingTerms, setPricingTerms] = useState("");
  const [activityCategory, setActivityCategory] = useState<string>("자체 점두행사");
  const [activityCategoryCustom, setActivityCategoryCustom] = useState<string>("");
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        partner ?? {
          business_type: "법인",
          status: "active",
          contract_date: new Date().toISOString().slice(0, 10),
        }
      );
      setPricingTerms((partner?.custom_fields as any)?.pricing_terms ?? "");
      const cat = (partner?.custom_fields as any)?.activity_category as string | undefined;
      if (cat && ACTIVITY_CATEGORIES.includes(cat)) {
        setActivityCategory(cat);
        setActivityCategoryCustom("");
      } else if (cat) {
        setActivityCategory("기타");
        setActivityCategoryCustom(cat);
      } else {
        setActivityCategory("자체 점두행사");
        setActivityCategoryCustom("");
      }
      setPendingFiles([]);
      setPreviews({});
      setSignedUrls({});
      if (partner?.id) {
        (async () => {
          const { data } = await (supabase as any)
            .from("seg_attachments")
            .select("*")
            .eq("partner_id", partner.id)
            .is("activity_id", null)
            .order("created_at", { ascending: false });
          setExistingAttachments(data ?? []);
          const urls: Record<string, string> = {};
          for (const att of data ?? []) {
            if ((att.mime_type || "").startsWith("image/")) {
              const { data: s } = await (supabase as any).storage
                .from("seg-files").createSignedUrl(att.storage_path, 600);
              if (s?.signedUrl) urls[att.id] = s.signedUrl;
            }
          }
          setSignedUrls(urls);
        })();
      } else {
        setExistingAttachments([]);
      }
    }
  }, [open, partner]);

  const set = <K extends keyof SegPartner>(k: K, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name}: 20MB 이하만 업로드 가능합니다`);
        return false;
      }
      return true;
    });
    setPendingFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        setPreviews((p) => ({ ...p, [`${f.name}_${f.size}_${f.lastModified}`]: url }));
      }
    });
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExisting = async (att: any) => {
    if (!confirm(`${att.file_name} 파일을 삭제할까요?`)) return;
    await (supabase as any).storage.from("seg-files").remove([att.storage_path]);
    await (supabase as any).from("seg_attachments").delete().eq("id", att.id);
    setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("파일을 삭제했습니다");
  };

  const uploadFiles = async (partnerId: string) => {
    for (const f of pendingFiles) {
      const safeName = f.name.replace(/[^\w.\-가-힣]/g, "_");
      const path = `${user.id}/partners/${partnerId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
      const { error: upErr } = await (supabase as any).storage
        .from("seg-files").upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) { toast.error(`${f.name} 업로드 실패: ${upErr.message}`); continue; }
      await (supabase as any).from("seg_attachments").insert({
        partner_id: partnerId,
        file_name: f.name,
        storage_path: path,
        file_size: f.size,
        mime_type: f.type,
        uploaded_by: user!.id,
      });
    }
  };

  const onSubmit = async () => {
    if (!form.company_name?.trim()) {
      toast.error("업체명을 입력하세요");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const finalCategory =
        activityCategory === "기타" && activityCategoryCustom.trim()
          ? activityCategoryCustom.trim()
          : activityCategory;
      const cf = {
        ...(form.custom_fields ?? {}),
        pricing_terms: pricingTerms || undefined,
        activity_category: finalCategory || undefined,
      };
      const payload = {
        company_name: form.company_name!.trim(),
        business_type: form.business_type || "법인",
        contract_type: form.contract_type || null,
        contract_date: form.contract_date || null,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        address: form.address || null,
        contract_detail: form.contract_detail || null,
        status: form.status || "active",
        assignee: form.assignee || null,
        assignee_name: form.assignee_name || null,
        note: form.note || null,
        custom_fields: cf,
      };
      let partnerId = partner?.id;
      if (partner?.id) {
        const { error } = await (supabase as any).from("seg_partners").update(payload).eq("id", partner.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("seg_partners").insert({ ...payload, created_by: user.id }).select("id").single();
        if (error) throw error;
        partnerId = data.id;
      }
      if (partnerId && pendingFiles.length > 0) {
        await uploadFiles(partnerId);
      }
      toast.success(partner ? "업체 정보를 수정했습니다" : "업체를 등록했습니다");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
          <Field label="활동 분류">
            <Select value={activityCategory} onValueChange={(v) => setActivityCategory(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_CATEGORIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {activityCategory === "기타" && (
            <Field label="활동 분류 (직접 입력)">
              <Input
                value={activityCategoryCustom}
                onChange={(e) => setActivityCategoryCustom(e.target.value)}
                placeholder="예: 박람회 부스, 지역 행사 등"
              />
            </Field>
          )}
          <Field label="계약일">
            <Input type="date" value={form.contract_date ?? ""} onChange={(e) => set("contract_date", e.target.value)} />
          </Field>
          <Field label="담당자명">
            <Input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="담당자 연락처">
            <Input value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", formatPhone(e.target.value))} placeholder="010-0000-0000" type="tel" inputMode="numeric" maxLength={13} />
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
          <Field label="단가적용 조건" full>
            <Textarea
              rows={4}
              value={pricingTerms}
              onChange={(e) => setPricingTerms(e.target.value)}
              placeholder={"예시)\n- 월 50대 이상 개통 시 대당 +20,000원 추가 리베이트\n- 갤럭시 S 시리즈 +10,000원\n- 인터넷 결합 시 별도 30,000원 지급"}
            />
          </Field>
          <Field label="계약 상세 내용" full>
            <Textarea rows={3} value={form.contract_detail ?? ""} onChange={(e) => set("contract_detail", e.target.value)} />
          </Field>
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Paperclip className="size-3.5" /> 계약서 / 증빙 파일
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                  <Lock className="size-2.5" /> 권한 보유자만 열람
                </span>
              </Label>
              <label className="text-xs cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-input hover:bg-accent">
                <Upload className="size-3.5" /> 파일 추가
                <input
                  type="file" multiple className="hidden"
                  accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => { onPickFiles(e.target.files); e.currentTarget.value = ""; }}
                />
              </label>
            </div>
            {(existingAttachments.length === 0 && pendingFiles.length === 0) && (
              <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-4 text-center">
                PDF, JPG, PNG 등 계약서 스캔본을 첨부할 수 있습니다 (최대 20MB)
              </div>
            )}
            {(existingAttachments.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {existingAttachments.map((att) => {
                  const isImg = (att.mime_type || "").startsWith("image/");
                  const url = signedUrls[att.id];
                  return (
                    <div key={att.id} className="relative group border border-border rounded-md overflow-hidden bg-muted/30">
                      {isImg && url ? (
                        <button type="button" onClick={() => setLightbox(url)} className="block w-full">
                          <img src={url} alt={att.file_name} className="w-full h-24 object-cover" />
                        </button>
                      ) : (
                        <div className="h-24 grid place-items-center"><FileText className="size-6 text-muted-foreground" /></div>
                      )}
                      <div className="px-1.5 py-1 text-[10px] truncate">{att.file_name}</div>
                      <button
                        type="button" onClick={() => removeExisting(att)}
                        className="absolute top-1 right-1 size-5 rounded-full bg-destructive/90 text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100">
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
                {pendingFiles.map((f, i) => {
                  const key = `${f.name}_${f.size}_${f.lastModified}`;
                  const isImg = f.type.startsWith("image/");
                  const url = previews[key];
                  return (
                    <div key={`p_${i}`} className="relative group border border-primary/40 rounded-md overflow-hidden bg-primary/5">
                      {isImg && url ? (
                        <button type="button" onClick={() => setLightbox(url)} className="block w-full">
                          <img src={url} alt={f.name} className="w-full h-24 object-cover" />
                        </button>
                      ) : (
                        <div className="h-24 grid place-items-center"><FileText className="size-6 text-primary" /></div>
                      )}
                      <div className="px-1.5 py-1 text-[10px] truncate flex items-center gap-1">
                        <span className="text-primary">신규</span>·{f.name}
                      </div>
                      <button
                        type="button" onClick={() => removePending(i)}
                        className="absolute top-1 right-1 size-5 rounded-full bg-destructive/90 text-destructive-foreground grid place-items-center opacity-0 group-hover:opacity-100">
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
    {lightbox && (
      <div
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm grid place-items-center p-6 cursor-zoom-out"
        onClick={() => setLightbox(null)}
      >
        <img src={lightbox} alt="확대 보기" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        <button
          className="absolute top-4 right-4 size-10 rounded-full bg-background/80 grid place-items-center"
          onClick={() => setLightbox(null)}
        >
          <X className="size-5" />
        </button>
      </div>
    )}
    </>
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
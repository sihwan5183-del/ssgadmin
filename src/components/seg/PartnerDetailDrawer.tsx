import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Phone, MapPin, Calendar, Building2, Edit, Trash2, CheckCircle2, Circle, Paperclip, FileText, X, DollarSign } from "lucide-react";
import { useSegActivities, type SegPartner, type SegActivity } from "@/hooks/useSegPartners";
import { ActivityFormDialog } from "./ActivityFormDialog";
import { PartnerFormDialog } from "./PartnerFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPE_COLOR: Record<string, string> = {
  방문: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  전화: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  제안: "bg-purple-500/15 text-purple-600 border-purple-500/30",
  계약: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  사후관리: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  이벤트: "bg-pink-500/15 text-pink-600 border-pink-500/30",
  기타: "bg-muted text-muted-foreground border-border",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  partner: SegPartner | null;
}

export function PartnerDetailDrawer({ open, onOpenChange, partner }: Props) {
  const { activities, refresh } = useSegActivities(partner?.id);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SegActivity | null>(null);
  const [partnerEditOpen, setPartnerEditOpen] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [partnerImageUrls, setPartnerImageUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!partner?.id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("seg_attachments")
        .select("*")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false });
      setAttachments(data ?? []);
      const urls: Record<string, string> = {};
      for (const att of (data ?? []).filter((a: any) => !a.activity_id && (a.mime_type || "").startsWith("image/"))) {
        const { data: s } = await (supabase as any).storage
          .from("seg-files").createSignedUrl(att.storage_path, 600);
        if (s?.signedUrl) urls[att.id] = s.signedUrl;
      }
      setPartnerImageUrls(urls);
    })();
  }, [partner?.id, activities.length]);

  if (!partner) return null;
  const partnerAttachments = attachments.filter((a) => !a.activity_id);
  const pricingTerms = (partner.custom_fields as any)?.pricing_terms as string | undefined;

  const onDeleteActivity = async (id: string) => {
    if (!confirm("이 활동 이력을 삭제할까요?")) return;
    const { error } = await (supabase as any).from("seg_activities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("삭제했습니다"); refresh(); }
  };

  const toggleCompleted = async (a: SegActivity) => {
    const { error } = await (supabase as any)
      .from("seg_activities")
      .update({ is_completed: !a.is_completed })
      .eq("id", a.id);
    if (error) toast.error(error.message); else refresh();
  };

  const downloadAttachment = async (path: string, name: string) => {
    const { data } = await (supabase as any).storage.from("seg-files").createSignedUrl(path, 60);
    if (data?.signedUrl) {
      const a = document.createElement("a");
      a.href = data.signedUrl; a.download = name; a.target = "_blank"; a.click();
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {partner.company_name}
              <Badge variant="outline">{partner.business_type}</Badge>
              {partner.contract_type && <Badge>{partner.contract_type}</Badge>}
            </SheetTitle>
          </SheetHeader>

          <Card className="p-4 mt-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {partner.contract_date && (
                <Info icon={Calendar} label="계약일" value={partner.contract_date} />
              )}
              {partner.contact_name && (
                <Info icon={Building2} label="담당자" value={partner.contact_name} />
              )}
              {partner.contact_phone && (
                <Info icon={Phone} label="연락처" value={partner.contact_phone} />
              )}
              {partner.address && (
                <Info icon={MapPin} label="주소" value={partner.address} full />
              )}
            </div>
            {pricingTerms && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <DollarSign className="size-3" /> 단가적용 조건
                </div>
                <p className="whitespace-pre-wrap text-sm bg-muted/40 rounded-md p-2">{pricingTerms}</p>
              </div>
            )}
            {partner.contract_detail && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground mb-1">계약 내용</div>
                <p className="whitespace-pre-wrap text-sm">{partner.contract_detail}</p>
              </div>
            )}
            {partnerAttachments.length > 0 && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Paperclip className="size-3" /> 첨부 파일 ({partnerAttachments.length})
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {partnerAttachments.map((att) => {
                    const isImg = (att.mime_type || "").startsWith("image/");
                    const url = partnerImageUrls[att.id];
                    return (
                      <div key={att.id} className="border border-border rounded-md overflow-hidden bg-muted/30">
                        {isImg && url ? (
                          <button type="button" onClick={() => setLightbox(url)} className="block w-full">
                            <img src={url} alt={att.file_name} className="w-full h-20 object-cover" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(att.storage_path, att.file_name)}
                            className="w-full h-20 grid place-items-center hover:bg-muted/50">
                            <FileText className="size-6 text-muted-foreground" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadAttachment(att.storage_path, att.file_name)}
                          className="block w-full px-1.5 py-1 text-[10px] truncate text-left hover:underline">
                          {att.file_name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPartnerEditOpen(true)}>
                <Edit className="size-3.5 mr-1" /> 업체 정보 수정
              </Button>
            </div>
          </Card>

          <div className="mt-5 flex items-center justify-between">
            <h3 className="font-semibold">활동 이력 ({activities.length})</h3>
            <Button size="sm" onClick={() => { setEditingActivity(null); setActivityOpen(true); }}>
              <Plus className="size-4 mr-1" /> 활동 추가
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {activities.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                아직 등록된 활동이 없습니다.
              </Card>
            )}
            {activities.map((a) => {
              const acts = attachments.filter((x) => x.activity_id === a.id);
              return (
                <Card key={a.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => toggleCompleted(a)}>
                          {a.is_completed ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : (
                            <Circle className="size-4 text-muted-foreground" />
                          )}
                        </button>
                        <Badge variant="outline" className={TYPE_COLOR[a.activity_type] ?? ""}>{a.activity_type}</Badge>
                        <span className="text-sm font-medium">{a.title || "(제목 없음)"}</span>
                        <span className="text-xs text-muted-foreground">{a.activity_date}{a.activity_time ? ` ${a.activity_time}` : ""}</span>
                      </div>
                      {a.content && <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{a.content}</p>}
                      {a.next_action_date && (
                        <div className="mt-2 text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-700 inline-flex items-center gap-1">
                          <Calendar className="size-3" /> 다음 액션: {a.next_action_date}{a.next_action_note ? ` · ${a.next_action_note}` : ""}
                        </div>
                      )}
                      {acts.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {acts.map((att) => (
                            <button key={att.id}
                              onClick={() => downloadAttachment(att.storage_path, att.file_name)}
                              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70 inline-flex items-center gap-1">
                              <Paperclip className="size-3" /> {att.file_name}
                            </button>
                          ))}
                        </div>
                      )}
                      {a.assignee_name && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">담당: {a.assignee_name}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingActivity(a); setActivityOpen(true); }}>
                        <Edit className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => onDeleteActivity(a.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <ActivityFormDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        partner={partner}
        activity={editingActivity}
        onSaved={refresh}
      />
      <PartnerFormDialog
        open={partnerEditOpen}
        onOpenChange={setPartnerEditOpen}
        partner={partner}
      />
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

function Info({ icon: Icon, label, value, full }: { icon: any; label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="size-3" />{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
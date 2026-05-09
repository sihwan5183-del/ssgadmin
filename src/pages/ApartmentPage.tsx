import { useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Trash2, Pencil, Users2, MapPin, Calendar as CalIcon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  useApartmentPostings, useApartmentLeads,
  computePostingStatus, RESULT_STATUSES,
  type ApartmentPosting, type ApartmentLead,
} from "@/hooks/useApartment";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { useFieldTeams } from "@/hooks/useFieldTeams";
import { DynamicFieldRenderer } from "@/components/admin/DynamicFieldRenderer";
import { formatPhone } from "@/lib/phoneFormat";
import { useStaffNames } from "@/hooks/useStaffNames";
import { cn } from "@/lib/utils";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ApartmentPage() {
  const { user } = useAuth();
  const { rows: postings, refresh: refreshPostings } = useApartmentPostings();
  const { rows: leads, refresh: refreshLeads } = useApartmentLeads();
  const { options: carrierOptions } = useFieldOptions("carrier");
  const { options: resultOptionsCustom } = useFieldOptions("apartment_result");
  const resultOptions = resultOptionsCustom.length > 0 ? resultOptionsCustom : (RESULT_STATUSES as readonly string[]);
  const { rows: fieldTeams } = useFieldTeams(true);
  const teamOptions = fieldTeams.map((t) => t.name);
  const { resolve: resolveStaff } = useStaffNames();
  const [teamTab, setTeamTab] = useState<string>("__all__");
  const { fields: postingFields } = useFieldDefinitions("apartment_posting");
  const { fields: leadFields } = useFieldDefinitions("apartment_lead");

  // ===== posting form =====
  const [pOpen, setPOpen] = useState(false);
  const [pEdit, setPEdit] = useState<ApartmentPosting | null>(null);
  const emptyPosting = {
    team: "",
    apartment_name: "",
    location_detail: "",
    start_date: todayStr(),
    end_date: todayStr(),
    note: "",
    custom_fields: {} as Record<string, unknown>,
  };
  const [pForm, setPForm] = useState(emptyPosting);

  const openCreatePosting = () => {
    setPEdit(null);
    setPForm(emptyPosting);
    setPOpen(true);
  };
  const openEditPosting = (p: ApartmentPosting) => {
    setPEdit(p);
    setPForm({
      team: p.team ?? "",
      apartment_name: p.apartment_name,
      location_detail: p.location_detail ?? "",
      start_date: p.start_date,
      end_date: p.end_date,
      note: p.note ?? "",
      custom_fields: (p.custom_fields ?? {}) as Record<string, unknown>,
    });
    setPOpen(true);
  };
  const savePosting = async () => {
    if (!user) return;
    if (!pForm.apartment_name.trim()) return toast.error("아파트 명칭은 필수입니다");
    if (pForm.end_date < pForm.start_date) return toast.error("종료일은 시작일 이후여야 합니다");
    const payload = {
      team: pForm.team || null,
      apartment_name: pForm.apartment_name.trim(),
      location_detail: pForm.location_detail.trim() || null,
      start_date: pForm.start_date,
      end_date: pForm.end_date,
      note: pForm.note.trim() || null,
      custom_fields: pForm.custom_fields,
    };
    if (pEdit) {
      const { error } = await (supabase as any).from("apartment_postings").update(payload).eq("id", pEdit.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase
        .from("apartment_postings" as any)
        .insert({ ...payload, created_by: user.id });
      if (error) return toast.error(error.message);
      toast.success("게시 활동이 등록되었습니다");
    }
    setPOpen(false);
    refreshPostings();
  };
  const removePosting = async (id: string) => {
    if (!confirm("게시 활동을 삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("apartment_postings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제되었습니다");
    refreshPostings();
  };

  // ===== lead form =====
  const [lOpen, setLOpen] = useState(false);
  const [lEdit, setLEdit] = useState<ApartmentLead | null>(null);
  const emptyLead = {
    posting_id: "",
    team: "",
    apartment_name: "",
    inquiry_date: todayStr(),
    customer_name: "",
    customer_phone: "",
    current_carrier: "",
    inquiry_note: "",
    result_status: "상담중",
    custom_fields: {} as Record<string, unknown>,
  };
  const [lForm, setLForm] = useState(emptyLead);

  const openCreateLead = () => {
    setLEdit(null);
    setLForm(emptyLead);
    setLOpen(true);
  };
  const openEditLead = (l: ApartmentLead) => {
    setLEdit(l);
    setLForm({
      posting_id: l.posting_id ?? "",
      team: l.team ?? "",
      apartment_name: l.apartment_name ?? "",
      inquiry_date: l.inquiry_date,
      customer_name: l.customer_name,
      customer_phone: l.customer_phone ?? "",
      current_carrier: l.current_carrier ?? "",
      inquiry_note: l.inquiry_note ?? "",
      result_status: l.result_status,
      custom_fields: (l.custom_fields ?? {}) as Record<string, unknown>,
    });
    setLOpen(true);
  };
  const onPickPosting = (id: string) => {
    const p = postings.find((x) => x.id === id);
    setLForm((s) => ({
      ...s,
      posting_id: id,
      team: p?.team ?? s.team,
      apartment_name: p?.apartment_name ?? s.apartment_name,
    }));
  };
  const saveLead = async () => {
    if (!user) return;
    if (!lForm.customer_name.trim()) return toast.error("고객명은 필수입니다");
    const payload = {
      posting_id: lForm.posting_id || null,
      team: lForm.team || null,
      apartment_name: lForm.apartment_name.trim() || null,
      inquiry_date: lForm.inquiry_date,
      customer_name: lForm.customer_name.trim(),
      customer_phone: lForm.customer_phone.trim() || null,
      current_carrier: lForm.current_carrier || null,
      inquiry_note: lForm.inquiry_note.trim() || null,
      result_status: lForm.result_status,
      custom_fields: lForm.custom_fields,
    };
    if (lEdit) {
      const { error } = await (supabase as any).from("apartment_leads").update(payload).eq("id", lEdit.id);
      if (error) return toast.error(error.message);
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase
        .from("apartment_leads" as any)
        .insert({ ...payload, created_by: user.id });
      if (error) return toast.error(error.message);
      toast.success("인입 고객이 등록되었습니다");
    }
    setLOpen(false);
    refreshLeads();
  };
  const updateLeadStatus = async (id: string, status: string) => {
    const { error } = await (supabase as any).from("apartment_leads").update({ result_status: status }).eq("id", id);
    if (error) return toast.error(error.message);
    refreshLeads();
  };
  const removeLead = async (id: string) => {
    if (!confirm("인입 고객을 삭제하시겠습니까?")) return;
    const { error } = await (supabase as any).from("apartment_leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refreshLeads();
  };

  // ===== stats =====
  const stats = useMemo(() => {
    const now = todayStr();
    const ongoing = postings.filter((p) => p.start_date <= now && p.end_date >= now).length;
    const endingSoon = postings.filter((p) => {
      const diff = (new Date(p.end_date).getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 3;
    }).length;
    const done = leads.filter((l) => l.result_status === "개통완료").length;
    const successRate = leads.length > 0 ? Math.round((done / leads.length) * 100) : 0;
    return { ongoing, endingSoon, totalLeads: leads.length, successRate };
  }, [postings, leads]);

  const leadCountByPosting = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => {
      if (l.posting_id) m.set(l.posting_id, (m.get(l.posting_id) ?? 0) + 1);
    });
    return m;
  }, [leads]);

  return (
    <div>
      <Header
        title="아파트 게시 영업"
        subtitle="게시 활동 등록 · 인입 고객 관리 · 자동 종료 알림"
        showScopeToggle={false}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Card className="p-4 glass">
          <div className="text-[11px] text-muted-foreground">게시 중</div>
          <div className="text-2xl font-bold mt-1">{stats.ongoing}</div>
        </Card>
        <Card className="p-4 glass">
          <div className="text-[11px] text-muted-foreground">3일 내 종료</div>
          <div className="text-2xl font-bold mt-1 text-amber-500">{stats.endingSoon}</div>
        </Card>
        <Card className="p-4 glass">
          <div className="text-[11px] text-muted-foreground">누적 인입</div>
          <div className="text-2xl font-bold mt-1">{stats.totalLeads}</div>
        </Card>
        <Card className="p-4 glass">
          <div className="text-[11px] text-muted-foreground">개통 성공률</div>
          <div className="text-2xl font-bold mt-1 text-primary">{stats.successRate}%</div>
        </Card>
      </div>

      <Tabs defaultValue="postings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="postings" className="gap-2">
            <Building2 className="size-4" /> 게시 활동 ({postings.length})
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users2 className="size-4" /> 인입 고객 ({leads.length})
          </TabsTrigger>
        </TabsList>

        {/* === Postings === */}
        <TabsContent value="postings">
          <Card className="p-5 glass">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">게시 활동 목록</h3>
              <Button onClick={openCreatePosting}>
                <Plus className="size-4 mr-1.5" /> 새 게시 등록
              </Button>
            </div>
            {/* Team tabs */}
            <div className="-mx-1 mb-3 overflow-x-auto">
              <div className="flex gap-1 px-1 min-w-max">
                {[{ name: "__all__", label: `전체 (${postings.length})` },
                  ...fieldTeams.map((t) => ({
                    name: t.name,
                    label: `${t.name} (${postings.filter((p) => p.team === t.name).length})`,
                  }))].map((t) => {
                  const active = teamTab === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => setTeamTab(t.name)}
                      className={cn(
                        "whitespace-nowrap px-3 py-1.5 text-xs font-medium border transition-colors",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-foreground hover:border-foreground",
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const filtered = teamTab === "__all__"
                ? postings
                : postings.filter((p) => p.team === teamTab);
              if (filtered.length === 0) {
                return (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    등록된 게시 활동이 없습니다
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[11px] text-muted-foreground border-b border-border/50">
                      <tr>
                        <th className="text-left py-1.5 px-2 w-20">상태</th>
                        <th className="text-left py-1.5 px-2">아파트명</th>
                        <th className="text-left py-1.5 px-2 w-32">담당자</th>
                        <th className="text-left py-1.5 px-2 w-28">팀</th>
                        <th className="text-left py-1.5 px-2 w-44">게시 기간</th>
                        <th className="text-right py-1.5 px-2 w-20">인입</th>
                        <th className="text-right py-1.5 px-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => {
                        const status = computePostingStatus(p);
                        const leadCount = leadCountByPosting.get(p.id) ?? 0;
                        const fmt = (d: string) => d.slice(2).replace(/-/g, ".");
                        return (
                          <tr key={p.id} className="border-b border-border/30 hover:bg-muted/30">
                            <td className="py-1.5 px-2 text-foreground text-[12px] font-medium">{status}</td>
                            <td className="py-1.5 px-2">
                              <div className="font-medium truncate">{p.apartment_name}</div>
                              {p.location_detail && (
                                <div className="text-[10px] text-muted-foreground truncate">{p.location_detail}</div>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-foreground/80">{resolveStaff(p.created_by)}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{p.team ?? "-"}</td>
                            <td className="py-1.5 px-2 text-muted-foreground tabular-nums">{fmt(p.start_date)} ~ {fmt(p.end_date)}</td>
                            <td className="py-1.5 px-2 text-right tabular-nums">{leadCount}건</td>
                            <td className="py-1.5 px-2 text-right whitespace-nowrap">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPosting(p)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removePosting(p.id)}>
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* === Leads === */}
        <TabsContent value="leads">
          <Card className="p-5 glass">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">인입 고객 목록</h3>
              <Button onClick={openCreateLead}>
                <Plus className="size-4 mr-1.5" /> 새 인입 등록
              </Button>
            </div>
            {leads.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                등록된 인입 고객이 없습니다
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="text-left py-2 px-2">인입일</th>
                      <th className="text-left py-2 px-2">팀</th>
                      <th className="text-left py-2 px-2">아파트</th>
                      <th className="text-left py-2 px-2">고객</th>
                      <th className="text-left py-2 px-2">연락처</th>
                      <th className="text-left py-2 px-2">현재 통신사</th>
                      <th className="text-left py-2 px-2">결과</th>
                      <th className="text-right py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-b border-border/30 hover:bg-muted/30">
                        <td className="py-2 px-2">{l.inquiry_date}</td>
                        <td className="py-2 px-2 text-muted-foreground">{l.team ?? "-"}</td>
                        <td className="py-2 px-2">{l.apartment_name ?? "-"}</td>
                        <td className="py-2 px-2 font-medium">{l.customer_name}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {l.customer_phone ? formatPhone(l.customer_phone) : "-"}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{l.current_carrier ?? "-"}</td>
                        <td className="py-2 px-2">
                          <Select
                            value={l.result_status}
                            onValueChange={(v) => updateLeadStatus(l.id, v)}
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {resultOptions.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button size="icon" variant="ghost" onClick={() => openEditLead(l)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeLead(l.id)}>
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Posting Dialog ===== */}
      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{pEdit ? "게시 활동 수정" : "새 게시 활동"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">담당 팀</Label>
              <Select value={pForm.team} onValueChange={(v) => setPForm({ ...pForm, team: v })}>
                <SelectTrigger><SelectValue placeholder="팀 선택" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">아파트 명칭 *</Label>
              <Input
                value={pForm.apartment_name}
                onChange={(e) => setPForm({ ...pForm, apartment_name: e.target.value })}
                placeholder="예: 래미안 1단지"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">상세 위치</Label>
              <Input
                value={pForm.location_detail}
                onChange={(e) => setPForm({ ...pForm, location_detail: e.target.value })}
                placeholder="예: 정문 게시판 / 105동 엘리베이터"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">시작일 *</Label>
              <Input
                type="date"
                className="bg-card border-border text-foreground [color-scheme:dark]"
                value={pForm.start_date}
                onChange={(e) => setPForm({ ...pForm, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">종료일 *</Label>
              <Input
                type="date"
                className="bg-card border-border text-foreground [color-scheme:dark]"
                value={pForm.end_date}
                onChange={(e) => setPForm({ ...pForm, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">메모</Label>
              <Textarea
                value={pForm.note}
                onChange={(e) => setPForm({ ...pForm, note: e.target.value })}
              />
            </div>
            {postingFields.length > 0 && (
              <div className="col-span-2 space-y-3 pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">추가 항목</div>
                <DynamicFieldRenderer
                  fields={postingFields}
                  values={pForm.custom_fields}
                  onChange={(v) => setPForm({ ...pForm, custom_fields: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPOpen(false)}>취소</Button>
            <Button onClick={savePosting}>{pEdit ? "수정" : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Lead Dialog ===== */}
      <Dialog open={lOpen} onOpenChange={setLOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lEdit ? "인입 고객 수정" : "새 인입 고객"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">연결된 게시물</Label>
              <Select value={lForm.posting_id} onValueChange={onPickPosting}>
                <SelectTrigger><SelectValue placeholder="게시물 선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  {postings.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.apartment_name} · {p.team ?? "-"} ({p.start_date}~{p.end_date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">담당 팀</Label>
              <Select value={lForm.team} onValueChange={(v) => setLForm({ ...lForm, team: v })}>
                <SelectTrigger><SelectValue placeholder="팀 선택" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">아파트</Label>
              <Input
                value={lForm.apartment_name}
                onChange={(e) => setLForm({ ...lForm, apartment_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">인입 일자</Label>
              <Input
                type="date"
                className="bg-card border-border text-foreground [color-scheme:dark]"
                value={lForm.inquiry_date}
                onChange={(e) => setLForm({ ...lForm, inquiry_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">고객명 *</Label>
              <Input
                value={lForm.customer_name}
                onChange={(e) => setLForm({ ...lForm, customer_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="size-3" /> 고객 번호
              </Label>
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={13}
                placeholder="010-0000-0000"
                value={formatPhone(lForm.customer_phone)}
                onChange={(e) => setLForm({ ...lForm, customer_phone: formatPhone(e.target.value) })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">현재 통신사</Label>
              {carrierOptions.length > 0 ? (
                <Select
                  value={lForm.current_carrier}
                  onValueChange={(v) => setLForm({ ...lForm, current_carrier: v })}
                >
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>
                    {carrierOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={lForm.current_carrier}
                  onChange={(e) => setLForm({ ...lForm, current_carrier: e.target.value })}
                  placeholder="예: SKT / KT / LGU+"
                />
              )}
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">문의 내용</Label>
              <Textarea
                value={lForm.inquiry_note}
                onChange={(e) => setLForm({ ...lForm, inquiry_note: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">
                최종 결과
                <span className="ml-1 text-[10px] text-muted-foreground/70">
                  (관리자 → 입력 옵션 관리 → "아파트 인입 최종결과" 에서 커스텀)
                </span>
              </Label>
              <div className="flex gap-2 flex-wrap">
                {resultOptions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={lForm.result_status === s ? "default" : "outline"}
                    onClick={() => setLForm({ ...lForm, result_status: s })}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            {leadFields.length > 0 && (
              <div className="col-span-2 space-y-3 pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">추가 항목</div>
                <DynamicFieldRenderer
                  fields={leadFields}
                  values={lForm.custom_fields}
                  onChange={(v) => setLForm({ ...lForm, custom_fields: v })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLOpen(false)}>취소</Button>
            <Button onClick={saveLead}>{lEdit ? "수정" : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
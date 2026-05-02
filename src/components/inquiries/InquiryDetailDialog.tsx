import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  User, Smartphone, Wallet, UserCog, Tag, MessageSquare, Send,
  Clock, Sparkles, UserPlus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffNames } from "@/hooks/useStaffNames";
import { useInquiryStatuses } from "@/hooks/useInquiryStatuses";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { inquiryStatusClass, inquiryStatusSoftClass } from "@/lib/inquiryStatus";
import { formatPhone } from "@/lib/phoneFormat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ---------- Types ---------- */
interface InquiryRow {
  id: string;
  customer_name: string | null;
  birth_date: string | null;
  phone: string | null;
  channel: string;
  content: string | null;
  manager: string | null;
  status: string;
  note: string | null;
  converted_sale_id: string | null;
  inquiry_date: string;
  created_at: string;
}
interface LogEntry {
  id: string;
  inquiry_id: string;
  action: string;
  content: string | null;
  created_at: string;
  created_by: string;
}

const OPEN_METHODS = ["선개통", "후개통"];

/* ---------- Helpers ---------- */
const won = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n))
    ? "-"
    : `${Number(n).toLocaleString("ko-KR")}원`;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const formatBirth = (b: string | null | undefined) => {
  if (!b) return "-";
  const d = b.replace(/\D+/g, "");
  if (d.length === 6) return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 6)}`;
  return b;
};

/* ---------- Section primitives ---------- */
const Section = ({
  icon: Icon,
  title,
  children,
  right,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) => (
  <Card className="p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {right}
    </div>
    <div>{children}</div>
  </Card>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-1.5 text-xs">
    <div className="w-24 shrink-0 text-muted-foreground">{label}</div>
    <div className="flex-1 min-w-0 text-foreground/90 break-words">{children}</div>
  </div>
);

/* ---------- Component ---------- */
export function InquiryDetailDialog({
  inquiry,
  open,
  onOpenChange,
  onChanged,
}: {
  inquiry: InquiryRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const { map: staffMap, resolve: resolveStaff } = useStaffNames();
  const { statuses } = useInquiryStatuses();
  const { options: quickMemos } = useFieldOptions("inquiry_quick_memo");

  // editable customer fields (left column header card)
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [phone, setPhone] = useState("");

  // sidebar
  const [manager, setManager] = useState("");
  const [status, setStatus] = useState("");
  const [openMethod, setOpenMethod] = useState<string>("");
  const [memo, setMemo] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sale, setSale] = useState<any | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);

  /* Load on open */
  useEffect(() => {
    if (!open || !inquiry) return;
    setName(inquiry.customer_name ?? "");
    setBirth(inquiry.birth_date ?? "");
    setPhone(inquiry.phone ?? "");
    setManager(inquiry.manager ?? "");
    setStatus(inquiry.status ?? "");
    setOpenMethod(((): string => {
      const v = (inquiry as any).custom_fields?.open_method;
      return typeof v === "string" ? v : "";
    })());
    setMemo("");

    (async () => {
      const { data: logRows } = await supabase
        .from("inquiry_logs")
        .select("*")
        .eq("inquiry_id", inquiry.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((logRows as LogEntry[]) ?? []);

      if (inquiry.converted_sale_id) {
        const { data: s } = await supabase
          .from("sales")
          .select(
            "id,product,sale_type,bundle,carrier,open_method,open_date,device_model,device_serial,usim_model,usim_serial,rate_plan,vas1,vas2,unit_price,vas_fee,distributor_amount,extra_subsidy,cash_support_amount,customer_support_amount,corp_card_amount,receivable_amount,custom_fields",
          )
          .eq("id", inquiry.converted_sale_id)
          .maybeSingle();
        setSale(s ?? null);
      } else {
        setSale(null);
      }
    })();
  }, [open, inquiry]);

  /* Realtime: new logs appended */
  useEffect(() => {
    if (!open || !inquiry) return;
    const ch = supabase
      .channel(`realtime:inquiry_logs:detail:${inquiry.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inquiry_logs",
          filter: `inquiry_id=eq.${inquiry.id}`,
        },
        (p) => {
          const l = p.new as LogEntry;
          setLogs((prev) => (prev.find((x) => x.id === l.id) ? prev : [l, ...prev]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, inquiry]);

  /* Staff list for manager assign */
  const staffOptions = useMemo(
    () =>
      Object.entries(staffMap)
        .map(([uid, label]) => ({ uid, label }))
        .filter((s) => !s.label.includes("(퇴사자)"))
        .sort((a, b) => a.label.localeCompare(b.label, "ko")),
    [staffMap],
  );

  if (!inquiry) return null;

  /* Persist header (name / birth / phone) */
  const saveHeader = async () => {
    setSavingHeader(true);
    const { error } = await supabase
      .from("inquiries")
      .update({
        customer_name: name || null,
        birth_date: birth || null,
        phone: phone || null,
        last_action_at: new Date().toISOString(),
      })
      .eq("id", inquiry.id);
    setSavingHeader(false);
    if (error) {
      toast.error("저장 실패: " + error.message);
      return;
    }
    toast.success("고객 정보 저장됨");
    onChanged();
  };

  /* Update assignee */
  const setAssignee = async (label: string) => {
    setManager(label);
    const { error } = await supabase
      .from("inquiries")
      .update({ manager: label || null, last_action_at: new Date().toISOString() })
      .eq("id", inquiry.id);
    if (error) {
      toast.error("담당자 변경 실패: " + error.message);
      return;
    }
    if (user) {
      await supabase.from("inquiry_logs").insert({
        inquiry_id: inquiry.id,
        action: "담당자",
        content: `담당자 → ${label || "-"}`,
        created_by: user.id,
      });
    }
    toast.success("담당자 배정 완료");
    onChanged();
  };

  const assignSelf = async () => {
    if (!user) return;
    const myName = resolveStaff(user.id, user.email ?? "나");
    await setAssignee(myName);
  };

  /* Update status */
  const changeStatus = async (next: string) => {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    const { error } = await supabase
      .from("inquiries")
      .update({ status: next, last_action_at: new Date().toISOString() })
      .eq("id", inquiry.id);
    if (error) {
      toast.error("상태 변경 실패: " + error.message);
      setStatus(prev);
      return;
    }
    if (user) {
      await supabase.from("inquiry_logs").insert({
        inquiry_id: inquiry.id,
        action: "상태변경",
        content: `${prev || "-"} → ${next}`,
        created_by: user.id,
      });
    }
    toast.success("상태 변경 완료");
    onChanged();
  };

  /* Update open_method (custom_fields) */
  const changeOpenMethod = async (v: string) => {
    setOpenMethod(v);
    const { data: cur } = await supabase
      .from("inquiries")
      .select("custom_fields")
      .eq("id", inquiry.id)
      .maybeSingle();
    const cf = { ...((cur?.custom_fields as any) ?? {}), open_method: v };
    const { error } = await supabase
      .from("inquiries")
      .update({ custom_fields: cf, last_action_at: new Date().toISOString() })
      .eq("id", inquiry.id);
    if (error) {
      toast.error("개통방식 변경 실패: " + error.message);
      return;
    }
    onChanged();
  };

  /* Add memo (and quick memo) */
  const addMemo = async (text?: string) => {
    const body = (text ?? memo).trim();
    if (!body || !user) return;
    setSavingMemo(true);
    const { error } = await supabase.from("inquiry_logs").insert({
      inquiry_id: inquiry.id,
      action: "메모",
      content: body,
      created_by: user.id,
    });
    setSavingMemo(false);
    if (error) {
      toast.error("메모 등록 실패: " + error.message);
      return;
    }
    if (!text) setMemo("");
    toast.success("메모 등록됨");
    onChanged();
  };

  const cf = (sale?.custom_fields as Record<string, any>) ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="size-4 text-primary" />
            고객 상세 — {name || "고객"}
            <Badge
              variant="outline"
              className={cn("ml-2 text-[10px]", inquiryStatusClass(status))}
            >
              {status || "-"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {inquiry.channel}
            </Badge>
            <span className="ml-auto text-[11px] text-muted-foreground mr-2">
              인입일 {inquiry.inquiry_date}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 gap-1 text-xs"
              onClick={() => onOpenChange(false)}
              aria-label="닫기"
            >
              <X className="size-3.5" /> 닫기
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* ===== LEFT (cols 1-2) ===== */}
          <div className="lg:col-span-2 space-y-3">
            {/* Customer info (editable) */}
            <Section
              icon={User}
              title="고객 정보"
              right={
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveHeader} disabled={savingHeader}>
                  {savingHeader ? "저장 중…" : "저장"}
                </Button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">고객명</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">생년월일 (6자리)</label>
                  <Input
                    value={birth}
                    onChange={(e) => setBirth(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                    className="h-9"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="900101"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">연락처</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    className="h-9"
                    type="tel"
                    inputMode="numeric"
                    maxLength={13}
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                <Row label="채널">
                  <Badge variant="outline" className="text-[10px]">{inquiry.channel}</Badge>
                </Row>
                <Row label="생년월일(표시)">{formatBirth(birth)}</Row>
                <Row label="문의 내용">{inquiry.content || "-"}</Row>
                <Row label="등록일">{new Date(inquiry.created_at).toLocaleString("ko-KR")}</Row>
              </div>
            </Section>

            {/* 상담 기기 정보 (인입 단계 입력) + 개통된 경우 기기 정보 */}
            <Section icon={Smartphone} title="상담 기기 정보">
              {(() => {
                const icf = ((inquiry as any).custom_fields ?? {}) as Record<string, any>;
                const cm = icf.consult_device_model || "";
                const cc = icf.consult_device_capacity || "";
                const cl = icf.consult_device_color || "";
                const carrier = sale?.carrier || icf.carrier || cf.carrier || "-";
                const hasConsult = cm || cc || cl;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
                      <div className="rounded-md border border-border/40 bg-muted/30 p-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">모델명</div>
                        <div className="text-xs font-medium text-foreground/90 break-words">{cm || "-"}</div>
                      </div>
                      <div className="rounded-md border border-border/40 bg-muted/30 p-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">용량</div>
                        <div className="text-xs font-medium text-foreground/90">{cc || "-"}</div>
                      </div>
                      <div className="rounded-md border border-border/40 bg-muted/30 p-2.5">
                        <div className="text-[10px] text-muted-foreground mb-0.5">색상</div>
                        <div className="text-xs font-medium text-foreground/90">{cl || "-"}</div>
                      </div>
                    </div>
                    <Row label="통신사">
                      <Badge variant="outline" className="text-[10px]">{carrier}</Badge>
                    </Row>
                    {sale && (
                      <>
                        <Row label="개통 단말기">{sale.device_model || "-"}</Row>
                        <Row label="단말 일련번호">{sale.device_serial || "-"}</Row>
                        <Row label="USIM 일련번호">{sale.usim_serial || "-"}</Row>
                        <Row label="출고가">{won(sale.unit_price)}</Row>
                      </>
                    )}
                    {!hasConsult && !sale && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        상담 기기 정보가 입력되지 않았습니다.
                      </div>
                    )}
                  </>
                );
              })()}
            </Section>

            {/* Settlement / amounts */}
            {sale && (
              <Section icon={Wallet} title="정산 / 금액">
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <Row label="고객 지원금">{won(sale.customer_support_amount)}</Row>
                    <Row label="법인카드">{won(sale.corp_card_amount)}</Row>
                  </div>
                  <div>
                    <Row label="미수금">{won(sale.receivable_amount)}</Row>
                  </div>
                </div>
              </Section>
            )}

            {/* Timeline — wide, left column */}
            <Section
              icon={Clock}
              title="상담 히스토리"
              right={
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  총 {logs.length}건
                </span>
              }
            >
              {logs.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center">
                  기록이 없습니다
                </div>
              ) : (
                <ol className="relative pl-4">
                  {/* vertical guide line */}
                  <span
                    aria-hidden
                    className="absolute left-[5px] top-1 bottom-1 w-px bg-border/60"
                  />
                  {logs.map((log) => (
                    <li key={log.id} className="relative pb-3 last:pb-0">
                      <span
                        aria-hidden
                        className="absolute -left-[11px] top-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                      />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-4">
                          {log.action}
                        </Badge>
                        <span className="text-[11px] text-foreground/80 font-medium">
                          {resolveStaff(log.created_by, "직원")}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                          {formatTime(log.created_at)}
                        </span>
                      </div>
                      {log.content && (
                        <p className="text-xs text-foreground/90 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                          {log.content}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>

          {/* ===== RIGHT SIDEBAR ===== */}
          <div className="space-y-3 lg:sticky lg:top-[68px] lg:self-start">
            {/* Assignee */}
            <Section
              icon={UserCog}
              title="담당자 배정"
              right={
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={assignSelf}>
                  <UserPlus className="size-3" /> 나에게 배정
                </Button>
              }
            >
              <Select value={manager || ""} onValueChange={(v) => setAssignee(v)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="담당자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">직원이 없습니다</div>
                  ) : (
                    staffOptions.map((s) => (
                      <SelectItem key={s.uid} value={s.label}>{s.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                현재 담당자: <span className="text-foreground/80 font-medium">{manager || "미지정"}</span>
              </div>
            </Section>

            {/* Status / open method */}
            <Section icon={Tag} title="고객 상태 관리">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">상태값</label>
                  <Select value={status} onValueChange={changeStatus}>
                    <SelectTrigger className={cn("h-9 text-xs font-medium", inquiryStatusSoftClass(status))}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>
                          <Badge variant="outline" className={cn("text-[10px]", inquiryStatusClass(s))}>{s}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">개통 방식</label>
                  <Select value={openMethod || ""} onValueChange={changeOpenMethod}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="선개통 / 후개통" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPEN_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            {/* Memo + quick memos */}
            <Section icon={MessageSquare} title="메모 작성">
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                placeholder="상담 메모를 입력하세요…"
                className="text-xs"
              />
              <div className="flex items-center justify-between mt-1.5">
                <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Sparkles className="size-3" /> 퀵 메모
                </div>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => addMemo()} disabled={savingMemo || !memo.trim()}>
                  <Send className="size-3" /> 등록
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {quickMemos.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">
                    퀵 메모가 없습니다. 관리자 → 항목 옵션 관리에서 추가하세요.
                  </div>
                ) : (
                  quickMemos.map((q) => (
                    <Button
                      key={q}
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] px-2"
                      onClick={() => {
                        setMemo((m) => (m ? `${m} ${q}` : q));
                      }}
                      onDoubleClick={() => addMemo(q)}
                      title="클릭: 텍스트 추가 · 더블클릭: 즉시 등록"
                    >
                      {q}
                    </Button>
                  ))
                )}
              </div>
            </Section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
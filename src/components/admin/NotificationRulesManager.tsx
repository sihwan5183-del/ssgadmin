import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Send, Save, BookmarkPlus, FileText } from "lucide-react";
import { SortableList, SortableItem } from "@/components/common/SortableList";

interface Rule {
  id: string;
  rule_key: string;
  label: string;
  description: string | null;
  trigger_type: string;
  enabled: boolean;
  send_time: string | null;
  weekdays: number[];
  title_template: string;
  body_template: string;
  link: string | null;
  audience: string;
  last_run_at: string | null;
  sort_order: number;
  repeat_type: string;
  month_days: number[];
  store_filter: string[];
  position_filter: string[];
  conditions: Record<string, any>;
}

interface Template {
  id: string;
  name: string;
  title_template: string;
  body_template: string;
  link: string | null;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const TRIGGER_LABELS: Record<string, string> = {
  seg_d1: "영업 일정 D-1",
  seg_today: "영업 일정 당일",
  sales_zero: "당일 실적 0건",
  sales_threshold: "실적 조건 (N건 미만/이상)",
  pending_unresolved: "미처리 실적 보유 직원",
  broadcast: "자유 스케줄 공지",
  manual: "수동/즉시 발송",
  partner_assigned: "업체 배정 시",
};
const REPEAT_LABELS: Record<string, string> = {
  daily: "매일",
  weekly: "매주 (요일 선택)",
  monthly: "매월 (날짜 선택)",
};
const AUDIENCE_LABELS: Record<string, string> = {
  auto: "자동 (담당자)",
  all: "전 직원 (활성)",
  dashboard_only: "대시보드 노출 직원",
};
const VARIABLES = ["{직원이름}", "{현재실적}", "{목표실적}", "{기준값}", "{미처리건수}", "{활동명}", "{현재시간}", "{오늘날짜}", "{업체명}", "{제목}", "{본문}"];

export function NotificationRulesManager() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [adhoc, setAdhoc] = useState<Record<string, { title: string; body: string }>>({});

  const refresh = async () => {
    setLoading(true);
    const [r, t, p, pos] = await Promise.all([
      supabase.from("notification_rules").select("*").order("sort_order"),
      supabase.from("notification_templates").select("*").order("name"),
      supabase.from("profiles").select("store").not("store", "is", null),
      supabase.from("positions").select("name").eq("active", true).order("sort_order"),
    ]);
    setRules((r.data ?? []) as Rule[]);
    setTemplates((t.data ?? []) as Template[]);
    setStores([...new Set(((p.data ?? []) as { store: string }[]).map((x) => x.store).filter(Boolean))].sort());
    setPositions(((pos.data ?? []) as { name: string }[]).map((x) => x.name));
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const update = (id: string, patch: Partial<Rule>) =>
    setRules((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: Rule) => {
    setSavingId(r.id);
    const { error } = await supabase.from("notification_rules").update({
      label: r.label, description: r.description,
      enabled: r.enabled, send_time: r.send_time, weekdays: r.weekdays,
      title_template: r.title_template, body_template: r.body_template,
      link: r.link, audience: r.audience, trigger_type: r.trigger_type,
      repeat_type: r.repeat_type, month_days: r.month_days,
      store_filter: r.store_filter, position_filter: r.position_filter,
      conditions: r.conditions ?? {},
    }).eq("id", r.id);
    setSavingId(null);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success(`'${r.label}' 저장됨`);
  };

  const remove = async (r: Rule) => {
    if (!confirm(`'${r.label}' 알림 항목을 삭제할까요?`)) return;
    const { error } = await supabase.from("notification_rules").delete().eq("id", r.id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("삭제됨"); refresh();
  };

  const handleReorder = async (newItems: Rule[]) => {
    setRules(newItems);
    const updates = newItems.map((r, idx) =>
      supabase.from("notification_rules").update({ sort_order: idx }).eq("id", r.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) return toast.error("순서 저장 실패");
    toast.success("순서가 변경되었습니다");
  };

  const addNew = async () => {
    const key = prompt("새 알림 항목의 고유 키 (영문/숫자/_)", `custom_${Date.now()}`);
    if (!key) return;
    const { error } = await supabase.from("notification_rules").insert({
      rule_key: key, label: "새 알림", trigger_type: "broadcast",
      title_template: "[알림] {제목}", body_template: "{본문}",
      audience: "all", weekdays: [1,2,3,4,5], repeat_type: "weekly",
      send_time: "09:00", sort_order: 99,
    });
    if (error) return toast.error("추가 실패: " + error.message);
    refresh();
  };

  const runNow = async (r: Rule) => {
    setRunningId(r.id);
    const ad = adhoc[r.id];
    const vars: Record<string, string> = {};
    if (ad) { vars["제목"] = ad.title || ""; vars["본문"] = ad.body || ""; }
    const { data, error } = await supabase.functions.invoke("notification-dispatcher", {
      body: { mode: "run_rule", rule_key: r.rule_key, vars },
    });
    setRunningId(null);
    if (error) return toast.error("실행 실패: " + error.message);
    const d = data as { sent?: number; failed?: number; blocked?: number; recipients?: number };
    toast.success("발송 완료", { description: `대상 ${d?.recipients ?? 0}명 · 성공 ${d?.sent ?? 0} · 실패 ${d?.failed ?? 0} · 차단 ${d?.blocked ?? 0}` });
    refresh();
  };

  const saveAsTemplate = async (r: Rule) => {
    const name = prompt("템플릿 이름", r.label);
    if (!name) return;
    const { error } = await supabase.from("notification_templates").insert({
      name, title_template: r.title_template, body_template: r.body_template, link: r.link,
    });
    if (error) return toast.error("템플릿 저장 실패: " + error.message);
    toast.success("템플릿 저장됨"); refresh();
  };

  const applyTemplate = (r: Rule, tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    update(r.id, { title_template: tpl.title_template, body_template: tpl.body_template, link: tpl.link ?? r.link });
    toast.info(`'${tpl.name}' 템플릿 적용됨 (저장 필요)`);
  };

  const removeTemplate = async (id: string) => {
    if (!confirm("템플릿을 삭제할까요?")) return;
    const { error } = await supabase.from("notification_templates").delete().eq("id", id);
    if (error) return toast.error("삭제 실패: " + error.message);
    refresh();
  };

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">
          변수: {VARIABLES.map((v) => <Badge key={v} variant="outline" className="ml-1 text-[10px] font-mono">{v}</Badge>)}
        </div>
        <Button size="sm" onClick={addNew} className="gap-1.5"><Plus className="size-4" />새 알림 항목</Button>
      </div>

      {templates.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="size-4 text-primary" />
            <span className="text-sm font-semibold">저장된 템플릿</span>
            <span className="text-[10px] text-muted-foreground">— 룰별 '템플릿 적용' 드롭다운에서 불러올 수 있습니다</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Badge key={t.id} variant="secondary" className="gap-1.5 pr-1 py-1">
                {t.name}
                <button onClick={() => removeTemplate(t.id)} className="ml-1 text-destructive hover:bg-destructive/10 rounded px-1">×</button>
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <SortableList items={rules} onReorder={handleReorder}>
        {(r) => {
          const cond = (r.conditions ?? {}) as { op?: string; value?: number; goal?: number };
          const isThreshold = r.trigger_type === "sales_threshold";
          const showSchedule = !["manual", "partner_assigned"].includes(r.trigger_type);
          return (
            <SortableItem key={r.id} id={r.id} className="rounded-lg border bg-card p-4 space-y-3 mb-3 flex items-start gap-2">
              <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
                <Input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} className="h-9 w-56 font-semibold" />
                <Badge variant="secondary" className="text-[10px] font-mono">{r.rule_key}</Badge>
                {r.last_run_at && <span className="text-[10px] text-muted-foreground">최근: {new Date(r.last_run_at).toLocaleString("ko-KR")}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => saveAsTemplate(r)} className="gap-1.5" title="현재 제목/본문을 템플릿으로 저장">
                  <BookmarkPlus className="size-3.5" />템플릿
                </Button>
                <Button size="sm" variant="outline" disabled={savingId === r.id} onClick={() => save(r)} className="gap-1.5">
                  <Save className="size-3.5" />{savingId === r.id ? "저장 중…" : "저장"}
                </Button>
                <Button size="sm" disabled={runningId === r.id} onClick={() => runNow(r)} className="gap-1.5">
                  <Send className="size-3.5" />{runningId === r.id ? "발송 중…" : "즉시 발송"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">트리거 유형</Label>
                <Select value={r.trigger_type} onValueChange={(v) => update(r.id, { trigger_type: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">반복 주기</Label>
                <Select value={r.repeat_type ?? "weekly"} onValueChange={(v) => update(r.id, { repeat_type: v })} disabled={!showSchedule}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPEAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">발송 시간 (KST)</Label>
                <Input type="time" value={r.send_time?.slice(0, 5) ?? ""} onChange={(e) => update(r.id, { send_time: e.target.value || null })} disabled={!showSchedule} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">대상 기본</Label>
                <Select value={r.audience} onValueChange={(v) => update(r.id, { audience: v })}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showSchedule && r.repeat_type === "weekly" && (
              <div>
                <Label className="text-xs">발송 요일</Label>
                <div className="flex gap-1 mt-1">
                  {WEEKDAY_LABELS.map((w, i) => {
                    const on = r.weekdays?.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => {
                          const set = new Set(r.weekdays ?? []);
                          if (on) set.delete(i); else set.add(i);
                          update(r.id, { weekdays: [...set].sort() });
                        }}
                        className={`size-8 rounded-md text-xs font-medium border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"}`}
                      >{w}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {showSchedule && r.repeat_type === "monthly" && (
              <div>
                <Label className="text-xs">발송 일자 (1~31)</Label>
                <div className="grid grid-cols-10 gap-1 mt-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const on = r.month_days?.includes(d);
                    return (
                      <button key={d} type="button"
                        onClick={() => {
                          const set = new Set(r.month_days ?? []);
                          if (on) set.delete(d); else set.add(d);
                          update(r.id, { month_days: [...set].sort((a,b)=>a-b) });
                        }}
                        className={`h-7 rounded text-[11px] font-medium border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"}`}
                      >{d}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {isThreshold && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">조건</Label>
                  <Select value={cond.op ?? "lt"} onValueChange={(v) => update(r.id, { conditions: { ...cond, op: v } })}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lt">실적 N건 미만</SelectItem>
                      <SelectItem value="gte">실적 N건 이상</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">기준 N건</Label>
                  <Input type="number" min={0} value={cond.value ?? 0} onChange={(e) => update(r.id, { conditions: { ...cond, value: Number(e.target.value) } })} className="h-9 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">목표 (선택, {"{목표실적}"})</Label>
                  <Input type="number" min={0} value={cond.goal ?? 0} onChange={(e) => update(r.id, { conditions: { ...cond, goal: Number(e.target.value) } })} className="h-9 mt-1" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">지점 필터 (비우면 전체)</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {stores.map((s) => {
                    const on = r.store_filter?.includes(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const set = new Set(r.store_filter ?? []);
                          if (on) set.delete(s); else set.add(s);
                          update(r.id, { store_filter: [...set] });
                        }}
                        className={`px-2 h-7 rounded text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"}`}
                      >{s}</button>
                    );
                  })}
                  {stores.length === 0 && <span className="text-[11px] text-muted-foreground">등록된 지점 없음</span>}
                </div>
              </div>
              <div>
                <Label className="text-xs">직급 필터 (비우면 전체)</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {positions.map((p) => {
                    const on = r.position_filter?.includes(p);
                    return (
                      <button key={p} type="button"
                        onClick={() => {
                          const set = new Set(r.position_filter ?? []);
                          if (on) set.delete(p); else set.add(p);
                          update(r.id, { position_filter: [...set] });
                        }}
                        className={`px-2 h-7 rounded text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"}`}
                      >{p}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">제목 템플릿</Label>
                  {templates.length > 0 && (
                    <Select onValueChange={(v) => applyTemplate(r, v)}>
                      <SelectTrigger className="h-7 w-40 text-[10px]"><SelectValue placeholder="템플릿 적용…" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Input value={r.title_template} onChange={(e) => update(r.id, { title_template: e.target.value })} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs">본문 템플릿</Label>
                <Textarea value={r.body_template} onChange={(e) => update(r.id, { body_template: e.target.value })} rows={2} className="mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-xs">클릭 시 이동 URL</Label>
              <Input value={r.link ?? ""} onChange={(e) => update(r.id, { link: e.target.value })} placeholder="/input" className="h-9 mt-1" />
            </div>

            {(r.trigger_type === "manual" || r.trigger_type === "broadcast") && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="text-xs font-semibold text-primary">즉시 발송용 입력 (변수 {"{제목}, {본문}"} 채움)</div>
                <Input placeholder="제목" value={adhoc[r.id]?.title ?? ""}
                  onChange={(e) => setAdhoc((p) => ({ ...p, [r.id]: { ...(p[r.id] ?? { title: "", body: "" }), title: e.target.value } }))} className="h-9" />
                <Textarea placeholder="본문" value={adhoc[r.id]?.body ?? ""}
                  onChange={(e) => setAdhoc((p) => ({ ...p, [r.id]: { ...(p[r.id] ?? { title: "", body: "" }), body: e.target.value } }))} rows={2} />
              </div>
            )}
              </div>
            </SortableItem>
          );
        }}
      </SortableList>
    </div>
  );
}

import { useEffect, useState } from "react";
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
import { Plus, Trash2, Send, Save } from "lucide-react";

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
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const TRIGGER_LABELS: Record<string, string> = {
  seg_d1: "영업 일정 D-1",
  seg_today: "영업 일정 당일",
  sales_zero: "당일 실적 0건",
  manual: "수동/즉시 발송",
  partner_assigned: "업체 배정 시",
};
const AUDIENCE_LABELS: Record<string, string> = {
  auto: "자동 (담당자)",
  all: "전 직원 (활성)",
  dashboard_only: "대시보드 노출 직원",
};
const VARIABLES = ["{직원이름}", "{활동명}", "{현재시간}", "{오늘날짜}", "{업체명}", "{제목}", "{본문}"];

export function NotificationRulesManager() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  // 즉시 발송용 임시 입력 (manual 룰)
  const [adhoc, setAdhoc] = useState<Record<string, { title: string; body: string }>>({});

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("notification_rules").select("*").order("sort_order");
    setRules((data ?? []) as Rule[]);
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
      link: r.link, audience: r.audience,
    }).eq("id", r.id);
    setSavingId(null);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success(`'${r.label}' 저장됨`);
  };

  const remove = async (r: Rule) => {
    if (!confirm(`'${r.label}' 알림 항목을 삭제할까요?`)) return;
    const { error } = await supabase.from("notification_rules").delete().eq("id", r.id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("삭제됨");
    refresh();
  };

  const addNew = async () => {
    const key = prompt("새 알림 항목의 고유 키를 입력하세요 (영문/숫자/_)", "custom_alert_1");
    if (!key) return;
    const { error } = await supabase.from("notification_rules").insert({
      rule_key: key, label: "새 알림", trigger_type: "manual",
      title_template: "[알림] {제목}", body_template: "{본문}",
      audience: "all", weekdays: [0,1,2,3,4,5,6], sort_order: 99,
    });
    if (error) return toast.error("추가 실패: " + error.message);
    refresh();
  };

  const runNow = async (r: Rule) => {
    setRunningId(r.id);
    const ad = adhoc[r.id];
    const vars: Record<string, string> = {};
    if (r.trigger_type === "manual" && ad) {
      vars["제목"] = ad.title || "";
      vars["본문"] = ad.body || "";
    }
    const { data, error } = await supabase.functions.invoke("notification-dispatcher", {
      body: { mode: "run_rule", rule_key: r.rule_key, vars },
    });
    setRunningId(null);
    if (error) return toast.error("실행 실패: " + error.message);
    const d = data as { sent?: number; failed?: number; blocked?: number; recipients?: number };
    toast.success(`발송 완료`, {
      description: `대상 ${d?.recipients ?? 0}명 · 성공 ${d?.sent ?? 0} · 실패 ${d?.failed ?? 0} · 차단 ${d?.blocked ?? 0}`,
    });
    refresh();
  };

  if (loading) return <div className="text-sm text-muted-foreground">불러오는 중…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          사용 가능한 변수: {VARIABLES.map((v) => <Badge key={v} variant="outline" className="ml-1 text-[10px] font-mono">{v}</Badge>)}
        </div>
        <Button size="sm" onClick={addNew} className="gap-1.5"><Plus className="size-4" />새 알림 항목</Button>
      </div>

      {rules.map((r) => (
        <Card key={r.id} className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
              <Input
                value={r.label}
                onChange={(e) => update(r.id, { label: e.target.value })}
                className="h-9 w-56 font-semibold"
              />
              <Badge variant="secondary" className="text-[10px] font-mono">{r.rule_key}</Badge>
              <Badge variant="outline" className="text-[10px]">{TRIGGER_LABELS[r.trigger_type] ?? r.trigger_type}</Badge>
              {r.last_run_at && (
                <span className="text-[10px] text-muted-foreground">최근 실행: {new Date(r.last_run_at).toLocaleString("ko-KR")}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" disabled={savingId === r.id} onClick={() => save(r)} className="gap-1.5">
                <Save className="size-3.5" />{savingId === r.id ? "저장 중…" : "저장"}
              </Button>
              <Button size="sm" disabled={runningId === r.id} onClick={() => runNow(r)} className="gap-1.5 bg-primary">
                <Send className="size-3.5" />{runningId === r.id ? "발송 중…" : "즉시 발송"}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">발송 시간 (KST, HH:MM)</Label>
              <Input
                type="time"
                value={r.send_time?.slice(0, 5) ?? ""}
                onChange={(e) => update(r.id, { send_time: e.target.value || null })}
                disabled={r.trigger_type === "manual" || r.trigger_type === "partner_assigned"}
                className="h-9 mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">대상</Label>
              <Select value={r.audience} onValueChange={(v) => update(r.id, { audience: v })}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">클릭 시 이동 URL</Label>
              <Input value={r.link ?? ""} onChange={(e) => update(r.id, { link: e.target.value })} placeholder="/input" className="h-9 mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">발송 요일</Label>
            <div className="flex gap-1 mt-1">
              {WEEKDAY_LABELS.map((w, i) => {
                const on = r.weekdays?.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const set = new Set(r.weekdays ?? []);
                      if (on) set.delete(i); else set.add(i);
                      update(r.id, { weekdays: [...set].sort() });
                    }}
                    className={`size-8 rounded-md text-xs font-medium border ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border text-muted-foreground"
                    }`}
                  >{w}</button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">제목 템플릿</Label>
              <Input value={r.title_template} onChange={(e) => update(r.id, { title_template: e.target.value })} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">본문 템플릿</Label>
              <Textarea value={r.body_template} onChange={(e) => update(r.id, { body_template: e.target.value })} rows={2} className="mt-1" />
            </div>
          </div>

          {r.trigger_type === "manual" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-primary">즉시 발송용 입력 (변수 {"{제목}, {본문}"} 채움)</div>
              <Input
                placeholder="제목 (예: 시스템 점검 안내)"
                value={adhoc[r.id]?.title ?? ""}
                onChange={(e) => setAdhoc((p) => ({ ...p, [r.id]: { ...(p[r.id] ?? { title: "", body: "" }), title: e.target.value } }))}
                className="h-9"
              />
              <Textarea
                placeholder="본문 내용"
                value={adhoc[r.id]?.body ?? ""}
                onChange={(e) => setAdhoc((p) => ({ ...p, [r.id]: { ...(p[r.id] ?? { title: "", body: "" }), body: e.target.value } }))}
                rows={2}
              />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
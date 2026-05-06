import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BellRing, Clock, Send } from "lucide-react";

type Schedule = { enabled: boolean; d1_time: string; today_time: string };

const DEFAULTS: Schedule = { enabled: true, d1_time: "20:00", today_time: "10:00" };

function normalizeTime(v: string): string {
  // "HH:MM" or "HH:MM:SS" → "HH:MM"
  const m = v?.match?.(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "20:00";
}

export function PushScheduleSettings() {
  const [cfg, setCfg] = useState<Schedule>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"d1" | "today" | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "notifications.push_schedule")
      .maybeSingle();
    if (data?.value) {
      const v = data.value as Partial<Schedule>;
      setCfg({
        enabled: v.enabled ?? true,
        d1_time: normalizeTime(v.d1_time ?? DEFAULTS.d1_time),
        today_time: normalizeTime(v.today_time ?? DEFAULTS.today_time),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: "notifications.push_schedule",
          value: {
            enabled: cfg.enabled,
            d1_time: normalizeTime(cfg.d1_time),
            today_time: normalizeTime(cfg.today_time),
          },
          description: "영업 일정 푸시 리마인드 발송 시간 (KST)",
        },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) toast.error("저장 실패: " + error.message);
    else toast.success("푸시 발송 시간이 저장되었습니다");
  };

  const sendTest = async (mode: "d1" | "today") => {
    setTesting(mode);
    try {
      const { data, error } = await supabase.functions.invoke("seg-push-reminders", {
        body: { mode },
      });
      if (error) throw error;
      const r = (data ?? {}) as { activities?: number; sent?: number; failed?: number };
      toast.success(`테스트 발송 완료 · 대상 ${r.activities ?? 0}건 / 발송 ${r.sent ?? 0} / 실패 ${r.failed ?? 0}`);
    } catch (e) {
      toast.error("테스트 실패: " + (e as Error).message);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <Card className="p-6 glass text-sm text-muted-foreground">불러오는 중…</Card>;
  }

  return (
    <Card className="p-6 glass space-y-6">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-xl bg-primary/15 text-primary-glow grid place-items-center shrink-0">
          <BellRing className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">푸시 알림 발송 시간</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            영업 일정 리마인드 푸시 알림이 발송되는 시간을 설정합니다 (한국 시간 기준).
            저장한 시간은 매일 자동으로 적용됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">활성화</Label>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg((p) => ({ ...p, enabled: v }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-border/50 bg-background/40 space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Clock className="size-3.5" /> 전일 리마인드 (D-1)
          </Label>
          <Input
            type="time"
            value={cfg.d1_time}
            disabled={!cfg.enabled}
            onChange={(e) => setCfg((p) => ({ ...p, d1_time: e.target.value }))}
            className="h-11"
          />
          <p className="text-[11px] text-muted-foreground">
            내일 일정이 있는 직원에게 발송 (예: 20:00)
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1 gap-1.5"
            disabled={testing !== null}
            onClick={() => sendTest("d1")}
          >
            <Send className="size-3.5" />
            {testing === "d1" ? "발송 중…" : "테스트 발송 (내일 일정)"}
          </Button>
        </div>

        <div className="p-4 rounded-xl border border-border/50 bg-background/40 space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <Clock className="size-3.5" /> 당일 리마인드
          </Label>
          <Input
            type="time"
            value={cfg.today_time}
            disabled={!cfg.enabled}
            onChange={(e) => setCfg((p) => ({ ...p, today_time: e.target.value }))}
            className="h-11"
          />
          <p className="text-[11px] text-muted-foreground">
            오늘 일정이 있는 직원에게 발송 (예: 10:00)
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1 gap-1.5"
            disabled={testing !== null}
            onClick={() => sendTest("today")}
          >
            <Send className="size-3.5" />
            {testing === "today" ? "발송 중…" : "테스트 발송 (오늘 일정)"}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "저장 중…" : "발송 시간 저장"}
        </Button>
      </div>

      <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-3">
        💡 시스템이 매분 시간을 확인하여 설정한 시각에 자동으로 발송합니다. 변경 사항은 즉시 적용됩니다.
      </div>
    </Card>
  );
}
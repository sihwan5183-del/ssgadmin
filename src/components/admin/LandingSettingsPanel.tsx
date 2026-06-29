import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Smartphone, Globe, MessageCircleQuestion } from "lucide-react";

const PLAN_OPTIONS = [
  { price: 95000, label: "플러스플랜 95", desc: "월 71,250원 (선택약정)" },
  { price: 115000, label: "플러스플랜 115", desc: "월 86,250원 (선택약정)" },
  { price: 130000, label: "플러스플랜 130", desc: "월 97,500원 (선택약정)" },
];

interface Props {
  upsert: (key: string, value: any) => Promise<{ error: any }>;
  settings: Record<string, any>;
}

export function LandingSettingsPanel({ upsert, settings }: Props) {
  const stored: number[] = settings["landing.visible_plans"] ?? [95000];
  const storedInetQ: boolean = settings["landing.show_inet_new_question"] ?? true;

  const [visible, setVisible] = useState<number[]>(stored);
  const [showInetQ, setShowInetQ] = useState<boolean>(storedInetQ);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVisible(settings["landing.visible_plans"] ?? [95000]);
  }, [JSON.stringify(settings["landing.visible_plans"])]);

  useEffect(() => {
    setShowInetQ(settings["landing.show_inet_new_question"] ?? true);
  }, [settings["landing.show_inet_new_question"]]);

  const togglePlan = async (price: number) => {
    let next: number[];
    if (visible.includes(price)) {
      if (visible.length === 1) { toast.error("요금제는 최소 1개 이상 표시해야 합니다."); return; }
      next = visible.filter((p) => p !== price);
    } else {
      next = [...visible, price].sort((a, b) => a - b);
    }
    setSaving(true);
    const { error } = await upsert("landing.visible_plans", next);
    setSaving(false);
    if (error) toast.error("저장 실패: " + error.message);
    else { setVisible(next); toast.success(`요금제 업데이트 (${next.map(p => `플러스플랜${p/1000}`).join(", ")})`); }
  };

  const toggleInetQ = async (val: boolean) => {
    setSaving(true);
    const { error } = await upsert("landing.show_inet_new_question", val);
    setSaving(false);
    if (error) toast.error("저장 실패: " + error.message);
    else {
      setShowInetQ(val);
      toast.success(val ? "인터넷 신규가입 질문 ON" : "인터넷 신규가입 질문 OFF (자동 신규가입 처리)");
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      {/* 요금제 ON/OFF */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="size-5 text-blue-600" />
          <span className="font-bold text-base">올인원 랜딩 요금제 표시</span>
          <a
            href="https://landing.uplusdak.com/allinone"
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-blue-500 hover:underline"
          >
            <Globe className="size-3" /> 랜딩 바로가기
          </a>
        </div>
        <p className="text-sm text-muted-foreground mb-4">ON인 요금제만 랜딩 페이지에서 탭으로 표시됩니다.</p>
        <div className="space-y-3">
          {PLAN_OPTIONS.map((plan) => {
            const isOn = visible.includes(plan.price);
            return (
              <div key={plan.price} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {plan.label}
                    {isOn
                      ? <Badge className="bg-green-600 text-white text-[10px] px-1.5">ON</Badge>
                      : <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">OFF</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{plan.desc}</div>
                </div>
                <Switch checked={isOn} disabled={saving} onCheckedChange={() => togglePlan(plan.price)} />
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
          현재 표시 중: <span className="font-bold text-foreground">
            {visible.map(p => `플러스플랜${p/1000}`).join(", ")}
          </span>
        </div>
      </Card>

      {/* 인터넷 신규가입 질문 ON/OFF */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircleQuestion className="size-5 text-orange-500" />
          <span className="font-bold text-base">인터넷 신규가입 여부 질문</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          인터넷 통신사 선택 후 표시되는 신규가입 질문 ON/OFF입니다.<br />
          <span className="text-orange-600 font-medium">
            OFF 시 질문 없이 신규가입 자동 선택 후 바로 진행됩니다.
          </span>
        </p>
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              신규가입 질문 표시
              {showInetQ
                ? <Badge className="bg-green-600 text-white text-[10px] px-1.5">ON</Badge>
                : <Badge className="bg-orange-500 text-white text-[10px] px-1.5">OFF (자동)</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {showInetQ ? "고객에게 질문 표시" : "질문 스킵 → 신규가입 자동 처리"}
            </div>
          </div>
          <Switch checked={showInetQ} disabled={saving} onCheckedChange={toggleInetQ} />
        </div>
      </Card>
    </div>
  );
}

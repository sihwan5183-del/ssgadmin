import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bell, BellOff, Zap, ShieldCheck, ShieldAlert, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  isLeadsNotifyEnabled,
  setLeadsNotifyEnabled,
  showLeadToast,
} from "@/components/leads/LeadsRealtimeNotifier";
import { subscribeDeviceToPush } from "@/hooks/usePushSubscription";
import { useAuth } from "@/contexts/AuthContext";

type Perm = "granted" | "denied" | "default" | "unsupported";

function getPerm(): Perm {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as Perm;
}

export function LeadsNotifierSettings() {
  const { user } = useAuth();
  const [perm, setPerm] = useState<Perm>(getPerm());
  const [meta, setMeta] = useState<boolean>(isLeadsNotifyEnabled("meta"));
  const [dogmaru, setDogmaru] = useState<boolean>(isLeadsNotifyEnabled("dogmaru"));
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const onFocus = () => setPerm(getPerm());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const requestPerm = async () => {
    if (!("Notification" in window)) {
      toast.error("이 브라우저는 알림을 지원하지 않습니다.");
      return;
    }
    try {
      const next = await Notification.requestPermission();
      setPerm(next as Perm);
      if (next === "granted") toast.success("브라우저 알림 권한이 허용되었습니다.");
      else toast.warning("권한이 허용되지 않았습니다. 브라우저 설정에서 직접 허용해 주세요.");
    } catch {
      toast.error("권한 요청 중 오류가 발생했습니다.");
    }
  };

  const toggleMeta = (on: boolean) => {
    setMeta(on);
    setLeadsNotifyEnabled("meta", on);
    toast.success(`메타광고 신규 인입 알림 ${on ? "ON" : "OFF"}`);
  };
  const toggleDogmaru = (on: boolean) => {
    setDogmaru(on);
    setLeadsNotifyEnabled("dogmaru", on);
    toast.success(`도그마루 신규 인입 알림 ${on ? "ON" : "OFF"}`);
  };

  const sendTest = (channel: "meta" | "dogmaru") => {
    showLeadToast({
      channel,
      isTest: true,
      name: channel === "dogmaru" ? "테스트(도그마루)" : "테스트(메타)",
      phone: "010-0000-0000",
    });
  };

  const subscribePhone = async () => {
    if (!user?.id) {
      toast.error("로그인 후 이용해 주세요.");
      return;
    }
    setSubscribing(true);
    const r = await subscribeDeviceToPush(user.id);
    setSubscribing(false);
    setPerm(getPerm());
    if (r.ok) toast.success("이 기기에 푸시 알림이 구독되었습니다. 화면을 꺼도 알림이 전송됩니다.");
    else toast.error((r as { ok: false; reason: string }).reason);
  };

  const permBadge = (() => {
    if (perm === "granted") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="size-2 rounded-full bg-emerald-500" />
          🟢 브라우저 알림 수신 중
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 ring-1 ring-rose-200">
        <span className="size-2 rounded-full bg-rose-500" />
        🔴 브라우저 알림 {perm === "denied" ? "차단됨" : "미허용"}
      </div>
    );
  })();

  return (
    <div className="space-y-5">
      {/* 브라우저 권한 상태 */}
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.12),0_10px_36px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900">
              {perm === "granted" ? (
                <ShieldCheck className="size-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="size-4 text-rose-600" />
              )}
              <h3 className="text-[15px] font-bold">브라우저 알림 권한</h3>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              실시간 인입 알림 토스트와 사운드는 사이트 내에서 작동합니다. 시스템 푸시(잠금화면)까지
              받으려면 브라우저 알림 권한을 허용하세요.
            </p>
            <div>{permBadge}</div>
          </div>
          {perm !== "granted" && (
            <Button
              onClick={requestPerm}
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 shrink-0"
            >
              <Bell className="size-4 mr-2" /> 알림 권한 허용하기
            </Button>
          )}
        </div>
      </Card>

      {/* 채널 토글 */}
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.12),0_10px_36px_-12px_rgba(15,23,42,0.18)]">
        <div className="mb-4">
          <h3 className="text-[15px] font-bold text-slate-900">채널별 인입 알림</h3>
          <p className="text-[12px] text-slate-600 mt-1">
            각 채널의 신규 잠재고객 인입 시 사운드와 함께 우측 상단에 토스트가 표시됩니다.
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          <ToggleRow
            title="메타광고 신규 인입 알림"
            desc="📢 메타광고 채널로 신규 리드가 등록되면 즉시 알림 (사운드 포함)"
            checked={meta}
            onChange={toggleMeta}
            onTest={() => sendTest("meta")}
          />
          <ToggleRow
            title="도그마루 신규 인입 알림"
            desc="🐶 도그마루 제휴 채널로 신규 리드가 등록되면 즉시 알림 (사운드 포함)"
            checked={dogmaru}
            onChange={toggleDogmaru}
            onTest={() => sendTest("dogmaru")}
          />
        </div>
      </Card>

      {/* 테스트 버튼 */}
      <Card className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-[0_4px_16px_-8px_rgba(15,23,42,0.18),0_10px_36px_-12px_rgba(15,23,42,0.25)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-[15px] font-bold">테스트 알림 발송</h3>
            <p className="text-[12px] text-slate-200">
              실제 인입과 동일한 경로로 토스트와 사운드를 1회 재생합니다.
            </p>
          </div>
          <Button
            onClick={() =>
              showLeadToast({
                channel: "meta",
                isTest: true,
              })
            }
            className="rounded-xl bg-amber-400 text-slate-900 hover:bg-amber-300 font-bold shrink-0"
          >
            <Zap className="size-4 mr-2" /> ⚡ 테스트 알림 발송
          </Button>
        </div>
      </Card>

      {/* 스마트폰 푸시 구독 */}
      <Card className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_16px_-8px_rgba(15,23,42,0.12),0_10px_36px_-12px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-slate-900">
              <Smartphone className="size-4 text-slate-700" />
              <h3 className="text-[15px] font-bold">스마트폰 푸시 알림 구독</h3>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              본인 스마트폰 브라우저(Chrome/Safari)에서 로그인한 뒤 아래 버튼을 누르면,
              브라우저를 닫거나 화면을 꺼도 신규 인입 시 휴대폰 상단 알림으로 전송됩니다.
            </p>
          </div>
          <Button
            onClick={subscribePhone}
            disabled={subscribing}
            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 shrink-0"
          >
            <Smartphone className="size-4 mr-2" />
            {subscribing ? "구독 중..." : "스마트폰 알림 구독하기"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  onTest,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  onTest: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        {checked ? (
          <Bell className="size-4 mt-0.5 text-slate-700" />
        ) : (
          <BellOff className="size-4 mt-0.5 text-slate-400" />
        )}
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-slate-900">{title}</div>
          <div className="text-[11.5px] text-slate-600 mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          className="rounded-lg text-slate-700 border-slate-200 hover:bg-slate-50"
        >
          테스트
        </Button>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

export default LeadsNotifierSettings;

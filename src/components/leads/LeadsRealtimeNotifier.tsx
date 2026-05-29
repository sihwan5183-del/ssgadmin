import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DOGMARU_CAMPAIGN = "도그마루_홈캠";

export const LEADS_NOTIFY_KEYS = {
  meta: "leads_notify_meta",
  dogmaru: "leads_notify_dogmaru",
} as const;

export function isLeadsNotifyEnabled(channel: "meta" | "dogmaru"): boolean {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(LEADS_NOTIFY_KEYS[channel]);
  // default ON
  return v === null ? true : v === "1" || v === "true";
}

export function setLeadsNotifyEnabled(channel: "meta" | "dogmaru", on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEADS_NOTIFY_KEYS[channel], on ? "1" : "0");
}

/** 짧고 맑은 알림 차임을 WebAudio 로 즉시 생성 (오디오 파일 의존성 0) */
export function playChime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = (playChime as any)._ctx ?? ((playChime as any)._ctx = new Ctx());
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const make = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, now + start);
      g.gain.setValueAtTime(0, now + start);
      g.gain.linearRampToValueAtTime(0.18, now + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(now + start);
      o.stop(now + start + dur + 0.02);
    };
    make(880, 0, 0.18);
    make(1320, 0.12, 0.22);
  } catch {
    /* 무음 환경 무시 */
  }
}

const maskPhone = (p?: string | null) => {
  if (!p) return "";
  const digits = p.replace(/[^0-9]/g, "");
  if (digits.length >= 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  if (digits.length >= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  return p;
};

type LeadRow = {
  id: string;
  name?: string | null;
  phone?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  campaign_name?: string | null;
};

/** 토스트+사운드 발사 (실시간 인입 / 테스트 공용) */
export function showLeadToast(opts: {
  channel: "meta" | "dogmaru";
  name?: string | null;
  phone?: string | null;
  leadId?: string | null;
  isTest?: boolean;
  navigate?: (to: string) => void;
}) {
  const { channel, name, phone, leadId, isTest, navigate } = opts;
  if (!isTest && !isLeadsNotifyEnabled(channel)) return;
  const displayName = name || "(이름 미상)";
  const displayPhone = maskPhone(phone);
  const baseLabel =
    channel === "dogmaru"
      ? "🐶 [도그마루] 제휴 인입건이 등록되었습니다!"
      : "📢 [메타광고] 신규 잠재고객이 등록되었습니다!";
  const channelLabel = isTest
    ? "📢 [테스트] 실시간 알림 시스템이 정상 작동 중입니다!"
    : baseLabel;
  playChime();
  toast.custom(
    (id) => (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          toast.dismiss(id);
          if (!isTest && navigate && leadId) {
            navigate(`/leads?tab=${channel}&highlight=${leadId}`);
          }
        }}
        className="group flex w-[360px] cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_45px_-12px_rgba(15,23,42,0.35)]"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 leading-snug">{channelLabel}</div>
          {!isTest && (
            <div className="mt-1 text-[12px] text-slate-700 truncate">
              <span className="font-semibold text-slate-900">{displayName}</span>
              {displayPhone ? <span className="ml-1 text-slate-600">· {displayPhone}</span> : null}
            </div>
          )}
          <div className="mt-1.5 text-[11px] text-slate-500">
            {isTest ? "사운드와 토스트가 모두 정상 동작합니다." : "클릭하면 해당 탭으로 이동합니다"}
          </div>
        </div>
        <button
          type="button"
          aria-label="알림 닫기"
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(id);
          }}
          className="-mr-1 -mt-1 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>
      </div>
    ),
    { duration: isTest ? 5000 : 8000 },
  );
}

/** 로그인 직후부터 전 페이지에서 leads INSERT 를 구독해
 *  토스트 + 차임 + 클릭 시 /leads 로 이동(탭/하이라이트 쿼리포함) 한다. */
export function LeadsRealtimeNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // 자기 자신/중복 INSERT 방지
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const handle = (row: LeadRow) => {
      if (!row?.id || seen.current.has(row.id)) return;
      seen.current.add(row.id);
      // 메모리 폭주 방지
      if (seen.current.size > 500) {
        const first = seen.current.values().next().value;
        if (first) seen.current.delete(first);
      }
      const isDogmaru = row.campaign_name === DOGMARU_CAMPAIGN;
      const channel = isDogmaru ? "dogmaru" : "meta";
      const name = (isDogmaru ? row.customer_name : row.name) || row.name || row.customer_name;
      const phone = (isDogmaru ? row.customer_phone : row.phone) || row.phone || row.customer_phone;
      showLeadToast({ channel, name, phone, leadId: row.id, navigate });
    };

    const ch = supabase
      .channel("global-leads-notify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => handle(payload.new as LeadRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, navigate]);

  return null;
}

export default LeadsRealtimeNotifier;
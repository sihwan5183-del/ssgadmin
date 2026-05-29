import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY =
  "BFAusrgMamWLSIDJSapOqEhv-M_JmsUVPD7GZIERX9bO22jT6cMKXzyKFAh8eJ8VNQmiA8KU-3ymsR3kIw0RK_E";

const PROMPT_KEY = "udak_push_prompted_v1";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buf;
}

function bufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function saveSubscription(userId: string, sub: PushSubscription) {
  const json = sub.toJSON();
  const endpoint = json.endpoint!;
  const p256dh = json.keys?.p256dh ?? bufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufferToBase64(sub.getKey("auth"));
  await supabase.from("user_push_tokens").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
}

/** 사용자가 "스마트폰 알림 구독하기" 버튼을 눌렀을 때 수동 구독 트리거 */
export async function subscribeDeviceToPush(userId: string): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  try {
    if (typeof window === "undefined") return { ok: false, reason: "환경 미지원" };
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, reason: "이 브라우저는 Web Push를 지원하지 않습니다." };
    }
    if (Notification.permission === "denied") {
      return { ok: false, reason: "알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용하세요." };
    }
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return { ok: false, reason: "알림 권한이 허용되지 않았습니다." };
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await saveSubscription(userId, sub);
    return { ok: true };
  } catch (e) {
    console.warn("[push] manual subscribe failed", e);
    return { ok: false, reason: (e as Error).message || "구독 실패" };
  }
}

export function usePushSubscription(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        if (cancelled) return;

        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(userId, existing);
          return;
        }

        // 권한 요청 — 1회만 자동 프롬프트
        if (Notification.permission === "denied") return;
        if (Notification.permission === "default") {
          if (sessionStorage.getItem(PROMPT_KEY)) return;
          sessionStorage.setItem(PROMPT_KEY, "1");
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await saveSubscription(userId, sub);
        toast.success("알림이 활성화되었습니다");
      } catch (e) {
        console.warn("[push] subscribe failed", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
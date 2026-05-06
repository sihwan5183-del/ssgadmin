import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY =
  "BFAusrgMamWLSIDJSapOqEhv-M_JmsUVPD7GZIERX9bO22jT6cMKXzyKFAh8eJ8VNQmiA8KU-3ymsR3kIw0RK_E";

const PROMPT_KEY = "udak_push_prompted_v1";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
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
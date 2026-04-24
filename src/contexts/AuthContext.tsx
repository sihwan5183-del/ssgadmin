import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profileStatus: string | null;
  profileName: string | null;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const KNOWN_DEVICES_KEY = "udak_known_devices";

function getDeviceFingerprint(): string {
  // 가벼운 디바이스 핑거프린트 (UA + 화면 해상도 + 타임존)
  const ua = navigator.userAgent;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return btoa(unescape(encodeURIComponent(`${ua}|${screen}|${tz}`))).slice(0, 32);
}

async function recordLoginAttempt(userId: string, email: string | undefined) {
  try {
    const fp = getDeviceFingerprint();
    const known: string[] = JSON.parse(localStorage.getItem(KNOWN_DEVICES_KEY) || "[]");
    const isNewDevice = !known.includes(fp);

    // auth_attempts 에 기록 (RLS: insert는 막혀있지만 시도. 실패 시 무시)
    let ip: string | null = null;
    try {
      const r = await fetch("https://api.ipify.org?format=json");
      const d = await r.json();
      ip = d.ip;
    } catch {
      /* ignore */
    }

    if (isNewDevice) {
      known.push(fp);
      localStorage.setItem(KNOWN_DEVICES_KEY, JSON.stringify(known.slice(-20)));

      // 본인 알림 (recipient_id = self 는 RLS 통과)
      await supabase.from("notifications").insert({
        recipient_id: userId,
        kind: "new_device_login",
        title: "새 기기/위치에서 로그인",
        message: `IP: ${ip ?? "알 수 없음"} · ${navigator.userAgent.slice(0, 80)}`,
        metadata: { ip, fingerprint: fp, ua: navigator.userAgent },
      });
    }
  } catch (e) {
    console.warn("[auth] device check failed", e);
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const enforceActive = async (s: Session | null) => {
    if (!s?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("status, display_name")
      .eq("user_id", s.user.id)
      .maybeSingle();
    if (data) {
      setProfileStatus(data.status);
      setProfileName(data.display_name);
      if (data.status === "leave" || data.status === "resigned") {
        toast.error(
          data.status === "leave"
            ? "휴직 상태입니다. 관리자에게 문의하세요."
            : "비활성화된 계정입니다. 관리자에게 문의하세요."
        );
        await supabase.auth.signOut();
      }
      if (data.status === "suspended") {
        toast.error("정지된 계정입니다. 관리자에게 문의하세요.");
        await supabase.auth.signOut();
      }
      // pending status is handled in ProtectedRoute
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // 다음 tick에서 실행 (deadlock 방지)
        setTimeout(() => enforceActive(s), 0);
      }
      if (event === "SIGNED_IN" && s?.user) {
        setTimeout(() => recordLoginAttempt(s.user.id, s.user.email), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      setTimeout(() => enforceActive(data.session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 30분 무활동 자동 로그아웃
  useEffect(() => {
    if (!session?.user) return;
    let timerId: number | undefined;
    const reset = () => {
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(async () => {
        toast.info("30분간 활동이 없어 자동 로그아웃되었습니다");
        await supabase.auth.signOut();
      }, IDLE_TIMEOUT_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timerId) window.clearTimeout(timerId);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, profileStatus, profileName, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};

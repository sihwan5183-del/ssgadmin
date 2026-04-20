import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, LogIn, UserPlus, Smartphone, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getDeviceToken, saveDeviceToken, deviceLabel } from "@/lib/trustedDevice";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-user-management`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Step = "credentials" | "magic_pending";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [team, setTeam] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [magicInfo, setMagicInfo] = useState<{
    token: string; phone_masked: string | null; expires_at: string; display_name: string | null;
  } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const nav = useNavigate();
  const loc = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      // 로그인 완료 시 신뢰기기 등록 (체크된 경우)
      const pending = sessionStorage.getItem("register_trust");
      if (pending === "1") {
        sessionStorage.removeItem("register_trust");
        supabase.functions.invoke("admin-user-management", {
          body: { action: "register_trusted_device", device_label: deviceLabel() },
        }).then(({ data }) => {
          const t = (data as any)?.token;
          if (t) {
            saveDeviceToken(t);
            toast.success("이 기기를 30일간 신뢰합니다");
          }
        });
      }
      const from = (loc.state as { from?: string } | null)?.from || "/";
      nav(from, { replace: true });
    }
  }, [session, nav, loc.state]);

  // 카운트다운
  useEffect(() => {
    if (!magicInfo) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(magicInfo.expires_at).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [magicInfo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").update({
            team: team || null, phone: phone || null,
          }).eq("user_id", data.user.id);
        }
        toast.success("가입 완료", { description: "이메일 인증 후 로그인하세요." });
        setMode("login");
      } else {
        // 1) 신뢰기기 토큰이 있으면 빠른 경로 시도
        const trusted = getDeviceToken();
        if (trusted) {
          const r = await fetch(FN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ANON },
            body: JSON.stringify({
              action: "verify_trusted_device", email, password, token: trusted,
            }),
          });
          const j = await r.json();
          if (r.ok && j.trusted && j.hashed_token) {
            const { error } = await supabase.auth.verifyOtp({
              type: "magiclink", token_hash: j.hashed_token,
            });
            if (!error) {
              toast.success("신뢰 기기로 로그인 완료");
              return;
            }
          }
        }
        // 2) 매직링크 발급
        const r = await fetch(FN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ANON },
          body: JSON.stringify({ action: "request_magic_link", email, password }),
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "인증 요청 실패");
        if (rememberDevice) sessionStorage.setItem("register_trust", "1");
        else sessionStorage.removeItem("register_trust");
        setMagicInfo({
          token: j.token,
          phone_masked: j.phone_masked,
          expires_at: j.expires_at,
          display_name: j.display_name,
        });
        setStep("magic_pending");
      }
    } catch (err) {
      toast.error(mode === "signup" ? "가입 실패" : "인증 요청 실패", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const magicLink = magicInfo ? `${window.location.origin}/magic-link?token=${magicInfo.token}` : "";

  const resetToCredentials = () => {
    setStep("credentials");
    setMagicInfo(null);
  };

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-card-elevated">
        <div className="flex items-center gap-3 mb-7">
          <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">신세계정보통신</div>
            <div className="text-lg font-bold tracking-tight">실적 원장 시스템</div>
          </div>
        </div>

        {step === "credentials" && (
          <>
            <div className="flex p-1 rounded-2xl bg-muted/50 border border-border/40 mb-5">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m} type="button" onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                    mode === m ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground"
                  }`}
                >
                  {m === "login" ? "로그인" : "회원가입"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">이름</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="홍길동" className="h-11 bg-input/60" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">소속 팀</Label>
                      <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="예: 1팀" className="h-11 bg-input/60" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">휴대폰</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="h-11 bg-input/60" />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">이메일</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com" className="h-11 bg-input/60" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">비밀번호</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 bg-input/60" minLength={6} required />
              </div>

              {mode === "login" && (
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <Checkbox checked={rememberDevice} onCheckedChange={(v) => setRememberDevice(!!v)} />
                  <span className="text-xs text-muted-foreground">
                    이 기기를 30일간 신뢰 (다음부터 간편인증 생략)
                  </span>
                </label>
              )}

              <Button type="submit" disabled={busy} className="w-full h-12 bg-gradient-primary shadow-glow rounded-2xl text-base font-semibold">
                {mode === "login" ? <Smartphone className="size-4 mr-2" /> : <UserPlus className="size-4 mr-2" />}
                {busy ? "처리 중…" : mode === "login" ? "인증 요청" : "가입하기"}
              </Button>
            </form>
          </>
        )}

        {step === "magic_pending" && magicInfo && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="size-14 mx-auto rounded-2xl bg-primary/15 grid place-items-center mb-3">
                <Smartphone className="size-7 text-primary" />
              </div>
              <h3 className="font-semibold">간편인증 요청 완료</h3>
              <p className="text-xs text-muted-foreground">
                {magicInfo.phone_masked
                  ? <>등록된 번호 <span className="text-foreground font-medium">{magicInfo.phone_masked}</span> 로 승인 링크를 발송했습니다</>
                  : "관리자에게 휴대폰 번호 등록을 요청하세요"}
              </p>
            </div>

            <div className="rounded-2xl border border-border/50 bg-background/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">테스트용 시뮬레이션 링크</span>
                <span className={`text-xs font-mono ${secondsLeft < 30 ? "text-destructive" : "text-primary"}`}>
                  {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <div className="text-[11px] break-all bg-background/60 rounded-lg p-2 font-mono leading-relaxed">
                {magicLink}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                  navigator.clipboard.writeText(magicLink);
                  toast.success("링크 복사됨");
                }}>
                  <Copy className="size-3.5 mr-1" /> 복사
                </Button>
                <Button size="sm" className="flex-1" onClick={() => window.location.href = magicLink}>
                  바로 승인
                </Button>
              </div>
            </div>

            <Button variant="ghost" className="w-full" onClick={resetToCredentials}>
              <RotateCcw className="size-3.5 mr-2" /> 처음으로
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              링크는 3분간 유효하며 1회만 사용 가능합니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;

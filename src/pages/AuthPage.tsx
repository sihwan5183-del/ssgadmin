import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

const AuthPage = () => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [team, setTeam] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      const from = (loc.state as { from?: string } | null)?.from || "/";
      nav(from, { replace: true });
    }
  }, [session, nav, loc.state]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ team: team || null, phone: phone || null })
            .eq("user_id", data.user.id);
        }
        toast.success("가입 완료", { description: "이제 로그인하세요." });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("로그인 완료");
      }
    } catch (err) {
      toast.error(mode === "signup" ? "가입 실패" : "로그인 실패", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-card-elevated relative">
        <div className="flex items-center gap-3 mb-7">
          <div className="size-11 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium tracking-wide">연합통신</div>
            <div className="text-lg font-bold tracking-tight">영업관리 시스템</div>
          </div>
        </div>

        <div className="flex p-1 rounded-2xl bg-muted/50 border border-border/40 mb-5">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-all ${
                mode === m
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground"
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
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="홍길동"
                  className="h-11 bg-input/60"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">소속 팀</Label>
                  <Input
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="예: 1팀"
                    className="h-11 bg-input/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">휴대폰</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="h-11 bg-input/60"
                  />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">이메일</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@team.com"
              className="h-11 bg-input/60"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">비밀번호</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 bg-input/60"
              minLength={6}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="w-full h-12 bg-gradient-primary shadow-glow rounded-2xl text-base font-semibold"
          >
            {mode === "login" ? <LogIn className="size-4 mr-2" /> : <UserPlus className="size-4 mr-2" />}
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하기"}
          </Button>
        </form>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          © {new Date().getFullYear()} 연합통신. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;

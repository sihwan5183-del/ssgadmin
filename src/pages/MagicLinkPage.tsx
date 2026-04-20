import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-user-management`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const MagicLinkPage = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("로그인 처리 중…");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMsg("토큰이 없습니다");
      return;
    }
    (async () => {
      try {
        const r = await fetch(FN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: ANON },
          body: JSON.stringify({ action: "consume_magic_link", token }),
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "실패");

        // verifyOtp로 세션 생성
        const { error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: j.hashed_token,
        });
        if (error) throw error;

        setState("ok");
        setMsg("로그인 완료! 잠시 후 이동합니다…");
        setTimeout(() => nav("/", { replace: true }), 1200);
      } catch (e) {
        setState("error");
        setMsg(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params, nav]);

  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-md glass-strong rounded-3xl p-10 shadow-card-elevated text-center">
        <div className="size-14 mx-auto rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-5">
          <Sparkles className="size-6 text-primary-foreground" />
        </div>
        {state === "loading" && (
          <>
            <Loader2 className="size-8 mx-auto animate-spin text-primary mb-3" />
            <h2 className="font-semibold mb-1">간편인증 처리 중</h2>
            <p className="text-sm text-muted-foreground">{msg}</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="size-10 mx-auto text-emerald-400 mb-3" />
            <h2 className="font-semibold mb-1">인증 성공</h2>
            <p className="text-sm text-muted-foreground">{msg}</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="size-10 mx-auto text-destructive mb-3" />
            <h2 className="font-semibold mb-1">인증 실패</h2>
            <p className="text-sm text-muted-foreground mb-5">{msg}</p>
            <Button onClick={() => nav("/auth")} variant="outline">로그인 화면으로</Button>
          </>
        )}
      </div>
    </div>
  );
};

export default MagicLinkPage;

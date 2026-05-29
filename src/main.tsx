import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── 빌드 버전이 바뀌면 구형 레이아웃/필터 캐시 자동 폐기 ───
// 이 상수만 올리면 모든 직원 브라우저에서 다음 진입 시 1회 자동 초기화 수행.
const APP_CACHE_VERSION = "2026-05-29-toss-premium-pass";
if (typeof window !== "undefined") {
  try {
    const prev = localStorage.getItem("__app_cache_version");
    if (prev !== APP_CACHE_VERSION) {
      // 레이아웃/필터/뷰 캐시만 정리 — 인증 토큰(sb-*)은 보존
      const KILL_PREFIXES = [
        "dashboard:",
        "dashboard_",
        "rgl-",
        "lovable:",
        "leads:",
        "leads_",
        "intake:",
        "intake_",
        "ledger:",
        "ledger_",
        "widget:",
        "layout:",
        "filters:",
      ];
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (KILL_PREFIXES.some((p) => k.startsWith(p))) toRemove.push(k);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem("__app_cache_version", APP_CACHE_VERSION);
    }
  } catch {
    /* localStorage 접근 불가 환경 무시 */
  }
}

// HTTPS 강제 리다이렉트 (localhost 제외)
if (
  typeof window !== "undefined" &&
  window.location.protocol === "http:" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
) {
  window.location.replace(
    "https://" +
      window.location.host +
      window.location.pathname +
      window.location.search +
      window.location.hash,
  );
}

createRoot(document.getElementById("root")!).render(<App />);

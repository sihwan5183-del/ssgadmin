import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ─── 배포 직후 옛날 탭에서 "Failed to fetch dynamically imported module" 자동 복구 ───
// Vite 코드 스플리팅 특성상, 배포하면 청크 파일명이 바뀜. 배포 전부터 열려있던 탭이
// 그 사이 새 페이지로 이동(지연 로딩)하면 이미 없어진 옛날 파일명을 찾다가 실패함.
// 무한 새로고침 방지를 위해 세션당 1회만 자동 새로고침.
if (typeof window !== "undefined") {
  const isChunkLoadError = (msg: unknown) =>
    typeof msg === "string" &&
    (msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module"));

  const recoverFromStaleChunk = () => {
    const key = "__stale_chunk_reload_done";
    if (sessionStorage.getItem(key)) return; // 이미 한 번 시도했으면 무한루프 방지 위해 중단
    sessionStorage.setItem(key, "1");
    window.location.reload();
  };

  window.addEventListener("error", (e) => {
    if (isChunkLoadError(e?.message)) recoverFromStaleChunk();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    const msg = typeof reason === "string" ? reason : reason?.message;
    if (isChunkLoadError(msg)) recoverFromStaleChunk();
  });
}

// ─── 빌드 버전이 바뀌면 구형 레이아웃/필터 캐시 자동 폐기 ───
// 이 상수만 올리면 모든 직원 브라우저에서 다음 진입 시 1회 자동 초기화 수행.
const APP_CACHE_VERSION = "2026-05-29-seg-daymodal";
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

// 정상적으로 앱이 떴다는 뜻이므로, 다음에 또 배포 직후 같은 문제가 생기면
// 다시 자동 복구를 시도할 수 있게 가드를 잠시 후 해제.
if (typeof window !== "undefined") {
  setTimeout(() => {
    try { sessionStorage.removeItem("__stale_chunk_reload_done"); } catch { /* 무시 */ }
  }, 5000);
}

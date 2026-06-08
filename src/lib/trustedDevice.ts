// 신뢰기기 토큰은 cookie 에만 저장한다. localStorage 백업은 XSS 시 탈취 위험이 있어 제거함.
const COOKIE = "td_token";
const DAYS = 30;

export function getDeviceToken(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (m) return decodeURIComponent(m[1]);
  return null;
}

export function saveDeviceToken(token: string) {
  const exp = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toUTCString();
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Expires=${exp}; Path=/; SameSite=Strict${secure}`;
}

export function clearDeviceToken() {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/`;
  // 기존 설치 정리: 이전 버전에서 저장된 localStorage 백업 제거
  try { localStorage.removeItem("td_token"); } catch { /* noop */ }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|Android/i.test(ua);
  const browser =
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Edg\//.test(ua) ? "Edge" : "Browser";
  return `${isMobile ? "모바일" : "데스크톱"} · ${browser}`;
}

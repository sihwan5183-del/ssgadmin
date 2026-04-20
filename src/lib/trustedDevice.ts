// 신뢰기기 토큰을 cookie + localStorage 백업으로 저장 (httpOnly 불가능한 클라이언트 환경)
const KEY = "td_token";
const COOKIE = "td_token";
const DAYS = 30;

export function getDeviceToken(): string | null {
  // cookie 우선
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  if (m) return decodeURIComponent(m[1]);
  return localStorage.getItem(KEY);
}

export function saveDeviceToken(token: string) {
  const exp = new Date(Date.now() + DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; Expires=${exp}; Path=/; SameSite=Lax`;
  localStorage.setItem(KEY, token);
}

export function clearDeviceToken() {
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/`;
  localStorage.removeItem(KEY);
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

/** 전화번호 마스킹: 010-3975-1390 → 010-3***-1*** (각 그룹 첫 자리만 노출) */
export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 8) return "****";
  const head = digits.slice(0, 3);
  const last = digits.slice(-4);
  const mid = digits.slice(3, -4);
  return `${head}-${mid[0] ?? ""}${"*".repeat(Math.max(mid.length - 1, 0))}-${last[0]}***`;
};

/** 이름 마스킹: 김민석 → 김*석, 김수 → 김* (가운데만 가림) */
export const maskName = (name: string | null | undefined): string => {
  if (!name) return "";
  const t = name.trim();
  if (t.length <= 1) return t;
  if (t.length === 2) return t[0] + "*";
  return t[0] + "*".repeat(t.length - 2) + t[t.length - 1];
};

/** 계좌번호 마스킹: 끝 4자리만 노출 → ****-****-1234 */
export const maskAccount = (account: string | null | undefined): string => {
  if (!account) return "";
  const digits = account.replace(/[^0-9]/g, "");
  if (digits.length <= 4) return "****";
  return "****-****-" + digits.slice(-4);
};

/** 카드번호 마스킹: 1234-****-****-5678 */
export const maskCardNumber = (card: string | null | undefined): string => {
  if (!card) return "";
  const digits = card.replace(/[^0-9]/g, "");
  if (digits.length < 8) return "****";
  return digits.slice(0, 4) + "-****-****-" + digits.slice(-4);
};

/** 유효기간 마스킹: 모두 별표 처리 */
export const maskCardExpiry = (expiry: string | null | undefined): string => {
  if (!expiry) return "";
  return "**/**";
};
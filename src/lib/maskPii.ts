/** 전화번호 중간자리 마스킹: 010-1234-5678 → 010-****-5678 */
export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  if (phone.length > 4) {
    const mid = Math.floor(phone.length / 3);
    return phone.slice(0, mid) + "****" + phone.slice(-mid);
  }
  return "****";
};

/** 이름 끝자리 마스킹: 홍길동 → 홍길*, 김수 → 김* */
export const maskName = (name: string | null | undefined): string => {
  if (!name) return "";
  if (name.length <= 1) return "*";
  return name.slice(0, -1) + "*";
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
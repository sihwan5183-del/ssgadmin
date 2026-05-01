/**
 * 한국 전화번호 자동 포맷터.
 *
 * - 숫자만 허용 (그 외 문자는 모두 제거)
 * - 입력 길이에 따라 하이픈을 동적으로 삽입
 * - 휴대폰(010, 011, 016~019), 서울(02), 그 외 지역번호(031, 032 …),
 *   대표번호(15xx/16xx/18xx)까지 포괄적으로 처리.
 *
 * DB에는 화면 표시값과 동일하게 하이픈 포함 문자열을 저장한다 (조회 편의).
 */

/** 입력에서 숫자만 추출 */
export const onlyDigits = (raw: string): string => (raw ?? "").replace(/\D+/g, "");

/**
 * 숫자 문자열에 한국식 하이픈을 삽입.
 * 부분 입력(자릿수 미달)도 자연스럽게 포맷한다.
 */
export function formatPhone(raw: string | null | undefined): string {
  const d = onlyDigits(String(raw ?? "")).slice(0, 11);
  if (!d) return "";

  // 대표번호: 1588-0000 등 (8자리)
  if (/^1[5-9]\d{2}/.test(d)) {
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  }

  // 서울 (02)
  if (d.startsWith("02")) {
    // 02-XXX-XXXX (9) 또는 02-XXXX-XXXX (10)
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  // 휴대폰 / 기타 지역번호 (3자리 prefix)
  // 010-XXXX-XXXX (11), 010-XXX-XXXX (10), 031-XXX-XXXX (10), 031-XXXX-XXXX (11)
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

/** Input onChange에서 사용: e.target.value를 그대로 받아 포맷된 문자열을 반환 */
export const handlePhoneChange = (value: string): string => formatPhone(value);

/** 표시용 (저장값이 어떤 포맷이든 일관되게 보이게) */
export const displayPhone = (raw: string | null | undefined): string =>
  raw ? formatPhone(raw) : "";

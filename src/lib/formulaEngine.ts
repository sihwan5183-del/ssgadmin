/**
 * 안전한 사칙연산 수식 엔진
 *
 * 허용:
 *   - 변수명 (영문 _)
 *   - 숫자, 소수점
 *   - 연산자 + - * /
 *   - 괄호 ( )
 *
 * 차단:
 *   - 함수 호출, 객체 접근, 비교문, 비트연산, eval/Function 등
 *
 * 사용 예:
 *   evaluateFormula("a + b - c", { a: 100, b: 20, c: 30 }) // 90
 */

const ALLOWED_RE = /^[\sA-Za-z_][\sA-Za-z0-9_+\-*/().]*$|^[\s\d+\-*/().]+$/;
// 더 정확한 전체 허용 문자 검사
const STRICT_ALLOWED = /^[\sA-Za-z0-9_+\-*/().]+$/;

export interface FormulaResult {
  ok: boolean;
  value?: number;
  error?: string;
}

/** 변수명만 추출 (검증/UI용) */
export const extractVariables = (formula: string): string[] => {
  const tokens = formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return Array.from(new Set(tokens));
};

/**
 * 수식 평가
 * @param formula  예: "unit_price + vas_fee - distributor_amount"
 * @param vars     변수값 맵
 */
export const evaluateFormula = (
  formula: string,
  vars: Record<string, number | null | undefined>,
): FormulaResult => {
  if (!formula || typeof formula !== "string") {
    return { ok: false, error: "수식이 비어 있습니다" };
  }
  if (!STRICT_ALLOWED.test(formula)) {
    return { ok: false, error: "허용되지 않은 문자가 포함되어 있습니다" };
  }
  // 변수명을 숫자로 치환
  let expr = formula;
  const usedVars = extractVariables(formula);
  for (const v of usedVars) {
    const val = Number(vars[v] ?? 0);
    if (!Number.isFinite(val)) {
      return { ok: false, error: `변수 "${v}" 값이 올바르지 않습니다` };
    }
    // 단어 경계로 정확히 치환
    expr = expr.replace(new RegExp(`\\b${v}\\b`, "g"), `(${val})`);
  }
  // 치환 후엔 숫자/연산자/괄호/공백만 남아야 함
  if (!/^[\s\d+\-*/().]+$/.test(expr)) {
    return { ok: false, error: "치환 후 안전하지 않은 토큰이 발견되었습니다" };
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { ok: false, error: "계산 결과가 숫자가 아닙니다" };
    }
    return { ok: true, value: result };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "수식 평가 실패" };
  }
};

/** 수식 검증 (저장 전 호출용) — 더미값으로 평가 시도 */
export const validateFormula = (
  formula: string,
  allowedVars: string[],
): { ok: boolean; error?: string } => {
  const used = extractVariables(formula);
  const invalid = used.filter((v) => !allowedVars.includes(v));
  if (invalid.length) {
    return { ok: false, error: `허용되지 않은 변수: ${invalid.join(", ")}` };
  }
  const dummy: Record<string, number> = {};
  used.forEach((v) => (dummy[v] = 1));
  const r = evaluateFormula(formula, dummy);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
};

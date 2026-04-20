import * as XLSX from "xlsx";

export type FieldRule = {
  field_key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "date" | "boolean" | "select";
  options?: string[];
};

export type RowError = {
  row: number; // 1-based 사용자 표시용 (헤더 행 제외)
  field_key: string;
  label: string;
  value: unknown;
  reason: string;
};

export type ValidationResult = {
  valid: Record<string, any>[];
  errors: RowError[];
  rowStatuses: Array<"ok" | "error">;
};

const TRUE_LIKE = ["o", "y", "유", "예", "true", "1", "yes"];
const FALSE_LIKE = ["x", "n", "무", "아니오", "false", "0", "no", ""];

export const coerceNumber = (v: unknown): { ok: boolean; value: number | null } => {
  if (v == null || v === "") return { ok: true, value: null };
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, value: null };
};

export const coerceBool = (v: unknown): { ok: boolean; value: boolean } => {
  if (typeof v === "boolean") return { ok: true, value: v };
  const s = String(v ?? "").trim().toLowerCase();
  if (TRUE_LIKE.includes(s)) return { ok: true, value: true };
  if (FALSE_LIKE.includes(s)) return { ok: true, value: false };
  return { ok: false, value: false };
};

export const coerceDate = (v: unknown): { ok: boolean; value: string | null } => {
  if (v == null || v === "") return { ok: true, value: null };
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return { ok: true, value: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` };
    return { ok: false, value: null };
  }
  const s = String(v).trim();
  const m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (m) {
    const y = new Date().getFullYear();
    return { ok: true, value: `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` };
  }
  // YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
  const norm = s.replace(/[./]/g, "-");
  const d = new Date(norm);
  if (!Number.isNaN(d.getTime())) return { ok: true, value: d.toISOString().slice(0, 10) };
  return { ok: false, value: null };
};

/**
 * mappedRows: ExcelMappingDialog가 생성한 [{field_key: rawValue}, ...]
 * rules: 검증 규칙
 */
export const validateRows = (
  mappedRows: Record<string, any>[],
  rules: FieldRule[],
): ValidationResult => {
  const ruleMap = new Map(rules.map((r) => [r.field_key, r]));
  const valid: Record<string, any>[] = [];
  const errors: RowError[] = [];
  const rowStatuses: Array<"ok" | "error">  = [];

  mappedRows.forEach((raw, idx) => {
    const rowNo = idx + 1;
    const out: Record<string, any> = {};
    let hasErr = false;

    // 모든 매핑된 필드 처리
    for (const [key, val] of Object.entries(raw)) {
      const rule = ruleMap.get(key);
      if (!rule) {
        // 규칙 없는 추가 필드 → 그대로 통과 (custom_fields.* 등)
        out[key] = val;
        continue;
      }
      const isEmpty = val == null || val === "";
      if (rule.required && isEmpty) {
        errors.push({ row: rowNo, field_key: key, label: rule.label, value: val, reason: "필수 항목 누락" });
        hasErr = true;
        continue;
      }
      if (isEmpty) { out[key] = null; continue; }

      switch (rule.type) {
        case "number": {
          const r = coerceNumber(val);
          if (!r.ok) { errors.push({ row: rowNo, field_key: key, label: rule.label, value: val, reason: "숫자 형식 오류" }); hasErr = true; }
          else out[key] = r.value;
          break;
        }
        case "date": {
          const r = coerceDate(val);
          if (!r.ok) { errors.push({ row: rowNo, field_key: key, label: rule.label, value: val, reason: "날짜 형식 오류 (예: 2024-04-10)" }); hasErr = true; }
          else out[key] = r.value;
          break;
        }
        case "boolean": {
          const r = coerceBool(val);
          if (!r.ok) { errors.push({ row: rowNo, field_key: key, label: rule.label, value: val, reason: "Y/N 형식 오류" }); hasErr = true; }
          else out[key] = r.value;
          break;
        }
        case "select": {
          const sv = String(val).trim();
          if (rule.options && rule.options.length && !rule.options.includes(sv)) {
            errors.push({ row: rowNo, field_key: key, label: rule.label, value: val, reason: `허용되지 않은 값 (${rule.options.slice(0, 4).join(", ")}…)` });
            hasErr = true;
          } else out[key] = sv;
          break;
        }
        default:
          out[key] = typeof val === "string" ? val.trim() : val;
      }
    }

    // 빈 행은 skip (모든 값이 비어있음)
    const allEmpty = Object.values(raw).every((v) => v == null || v === "");
    if (allEmpty) { rowStatuses.push("ok"); return; }

    if (hasErr) {
      rowStatuses.push("error");
    } else {
      rowStatuses.push("ok");
      valid.push(out);
    }
  });

  return { valid, errors, rowStatuses };
};

/** 오류 리포트를 xlsx로 다운로드 */
export const downloadErrorReport = (errors: RowError[], fileName = "업로드_오류리포트.xlsx") => {
  const aoa: any[][] = [
    ["행 번호", "필드", "입력값", "오류 사유"],
    ...errors.map((e) => [e.row, e.label, String(e.value ?? ""), e.reason]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 24 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "오류");
  XLSX.writeFile(wb, fileName);
};

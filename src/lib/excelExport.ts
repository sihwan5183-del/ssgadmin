import * as XLSX from "xlsx";
import { toast } from "sonner";

/**
 * 한국어 헤더 매핑을 적용해 .xlsx 다운로드
 * @param rows 원본 객체 배열
 * @param columns [원본키, 한국어헤더] 순서대로 정의 → 컬럼 순서 보장
 * @param fileName .xlsx 확장자 없이
 * @param sheetName 시트명
 */
export const exportToExcel = <T extends Record<string, any>>(
  rows: T[],
  columns: Array<[keyof T & string, string]>,
  fileName: string,
  sheetName = "Sheet1",
) => {
  if (!rows || rows.length === 0) {
    toast.warning("내보낼 데이터가 없습니다");
    return;
  }
  const remapped = rows.map((r) => {
    const o: Record<string, any> = {};
    for (const [key, label] of columns) {
      const v = r[key];
      o[label] = v == null ? "" : v;
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(remapped, {
    header: columns.map(([, label]) => label),
  });
  // 컬럼 폭 자동 (한글 가중치)
  const colWidths = columns.map(([key, label]) => {
    const headerLen = label.length * 2;
    const maxBody = rows.reduce((m, r) => {
      const s = String(r[key] ?? "");
      return Math.max(m, s.length);
    }, 0);
    return { wch: Math.min(40, Math.max(headerLen, maxBody) + 2) };
  });
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${stamp}.xlsx`);
  toast.success(`${rows.length}건 엑셀로 내보냈습니다`);
};

/** 여러 시트를 하나의 워크북으로 저장 */
export const exportMultiSheet = (
  sheets: Array<{ name: string; rows: any[]; columns: Array<[string, string]> }>,
  fileName: string,
) => {
  const wb = XLSX.utils.book_new();
  let total = 0;
  for (const s of sheets) {
    if (!s.rows || s.rows.length === 0) continue;
    const remapped = s.rows.map((r) => {
      const o: Record<string, any> = {};
      for (const [key, label] of s.columns) o[label] = r[key] ?? "";
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(remapped, {
      header: s.columns.map(([, l]) => l),
    });
    XLSX.utils.book_append_sheet(wb, ws, s.name);
    total += s.rows.length;
  }
  if (total === 0) {
    toast.warning("내보낼 데이터가 없습니다");
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${stamp}.xlsx`);
  toast.success(`총 ${total}건 엑셀로 내보냈습니다`);
};

/** 컬럼 매핑 — 실적 sales */
export const SALES_COLUMNS: Array<[string, string]> = [
  ["seq", "순번"],
  ["open_date", "개통일"],
  ["channel", "인입경로"],
  ["manager", "담당자"],
  ["product", "가입상품"],
  ["sale_type", "판매유형"],
  ["open_method", "개통방식"],
  ["status", "최종상태"],
  ["customer_name", "고객명"],
  ["birth_date", "생년월일"],
  ["phone", "연락처"],
  ["device_model", "단말기"],
  ["device_serial", "단말 일련번호"],
  ["usim_model", "USIM"],
  ["usim_serial", "USIM 일련번호"],
  ["rate_plan", "개통요금제"],
  ["vas1", "부가서비스1(주셋톱)"],
  ["vas2", "부가서비스2(부셋톱)"],
  ["unit_price", "단가표 기준(₩)"],
  ["vas_fee", "부가서비스 수수료(₩)"],
  ["distributor_amount", "유통망(₩)"],
  ["extra_subsidy", "추가지원금(₩)"],
  ["cash_support_amount", "현금지원금(₩)"],
  ["receivable_amount", "미수금(₩)"],
  ["receivable_paid", "미수금 입금"],
  ["voucher", "상품권"],
  ["voucher_returned", "상품권 회수"],
  ["delivery_type", "발송유형"],
  ["tracking_no", "운송장"],
  ["bundle", "동판/번들"],
  ["note", "비고"],
];

export const AD_SPEND_COLUMNS: Array<[string, string]> = [
  ["spend_date", "집행일"],
  ["spend_month", "집행월"],
  ["category", "분류"],
  ["media", "매체/항목"],
  ["expense_type", "지출항목"],
  ["channel", "인입경로"],
  ["campaign", "캠페인/적요"],
  ["amount", "금액(₩)"],
  ["note", "메모"],
];

export const DEVICE_INVENTORY_COLUMNS: Array<[string, string]> = [
  ["model", "모델"],
  ["serial_no", "일련번호/IMEI"],
  ["color", "색상"],
  ["capacity", "용량"],
  ["status", "상태"],
  ["stock_in_date", "입고일"],
  ["purchase_price", "매입가(₩)"],
  ["supplier", "공급처"],
  ["note", "메모"],
];

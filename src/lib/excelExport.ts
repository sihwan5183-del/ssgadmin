import * as XLSX from "xlsx";
import { toast } from "sonner";
import { calcDashboardProfit } from "@/lib/profit";

/**
 * 한국어 헤더 매핑을 적용해 .xlsx 다운로드
 * @param rows 원본 객체 배열
 * @param columns [원본키, 한국어헤더] 순서대로 정의 → 컬럼 순서 보장
 * @param fileName .xlsx 확장자 없이
 * @param sheetName 시트명
 */
export type ColumnDef = [string, string] | [string, string, (row: any) => any];

const resolveValue = (row: any, col: ColumnDef) => {
  if (col.length === 3 && typeof col[2] === "function") {
    try { return col[2](row); } catch { return ""; }
  }
  return row[col[0]];
};

export const exportToExcel = <T extends Record<string, any>>(
  rows: T[],
  columns: Array<ColumnDef>,
  fileName: string,
  sheetName = "Sheet1",
) => {
  if (!rows || rows.length === 0) {
    toast.warning("내보낼 데이터가 없습니다");
    return;
  }
  const remapped = rows.map((r) => {
    const o: Record<string, any> = {};
    for (const col of columns) {
      const [, label] = col;
      const v = resolveValue(r, col);
      o[label] = v == null ? "" : v;
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(remapped, {
    header: columns.map(([, label]) => label),
  });
  // 컬럼 폭 자동 (한글 가중치)
  const colWidths = columns.map((col) => {
    const [, label] = col;
    const headerLen = label.length * 2;
    const maxBody = rows.reduce((m, r) => {
      const s = String(resolveValue(r, col) ?? "");
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

/* =====================================================================
 * 판매원장 — 풀 스펙 엑셀 내보내기
 * - 모든 입력 필드를 개별 셀로 추출
 * - 토글(모요 미적용, 현금개통, 제휴카드, 중고폰 등) 상태를 명문화
 * - 시스템 계산 [최종 순수익]을 '값'으로 포함 (수식 아님)
 * - 금액/숫자 포맷, 헤더 강조(굵게/배경), 자동 컬럼 폭
 * - 담당자 UID + 성함, 인입 채널 포함
 * =====================================================================*/
const yn = (v: any, on = "Y", off = "") =>
  v === true || v === "true" || v === 1 || v === "Y" || v === "유" ? on : off;

const pickCustom = (row: any, key: string) => {
  const cf = row?.custom_fields ?? {};
  return cf?.[key];
};

/** 풀 스펙 컬럼 정의: [원본키, 한국어 헤더, 추출함수?, 숫자포맷?] */
type FullCol = [string, string, ((r: any) => any)?, string?];

export const FULL_SALES_COLUMNS: FullCol[] = [
  ["seq", "순번"],
  ["open_date", "개통일"],
  ["open_month", "개통월"],
  ["status", "최종상태"],
  ["approval_status", "검수상태"],
  // 담당자/채널
  ["created_by", "담당자 UID"],
  ["manager", "담당자명"],
  ["channel", "인입경로"],
  // 가입 정보
  ["product", "가입상품"],
  ["sale_type", "판매유형(신규/MNP/기변)"],
  ["open_method", "개통방식"],
  // 고객 정보
  ["customer_name", "고객명"],
  ["birth_date", "생년월일"],
  ["phone", "연락처"],
  // 단말 / USIM
  ["device_model", "단말기"],
  ["device_serial", "단말 일련번호"],
  ["usim_model", "USIM"],
  ["usim_serial", "USIM 일련번호"],
  // 요금제 / 부가서비스
  ["rate_plan", "개통요금제"],
  ["vas1", "부가서비스1"],
  ["vas2", "부가서비스2"],
  // ===== 수익 항목 =====
  ["unit_price", "단가표 수수료(₩)", undefined, "#,##0;(#,##0);-"],
  ["vas_fee", "부가서비스 수수료(₩)", undefined, "#,##0;(#,##0);-"],
  ["receivable_amount", "미수금(₩)", undefined, "#,##0;(#,##0);-"],
  ["receivable_paid", "미수금 입금상태", (r) => yn(r.receivable_paid === "유" || r.receivable_paid === "완료", "수급완료", "미수")],
  ["voucher", "상품권"],
  ["voucher_returned", "상품권 회수상태", (r) => yn(r.voucher_returned === "유", "반납완료", "미반납")],
  ["voucher_amount", "상품권 금액(₩)", (r) => Number(pickCustom(r, "voucher_amount") ?? 0) || 0, "#,##0;(#,##0);-"],
  ["trade_in_enabled", "중고폰 사용", (r) => yn(r.trade_in_enabled, "사용", "미사용")],
  ["trade_in_model", "중고폰 모델"],
  ["trade_in_confirmed", "중고폰 확정금액(₩)", undefined, "#,##0;(#,##0);-"],
  // ===== 지출 항목 =====
  ["distributor_amount", "유통망 지원금(₩)", undefined, "#,##0;(#,##0);-"],
  ["extra_subsidy", "추가지원금(₩)", undefined, "#,##0;(#,##0);-"],
  ["customer_support_amount", "고객지원금(₩)", undefined, "#,##0;(#,##0);-"],
  ["cash_support_amount", "현금개통 금액(₩)", undefined, "#,##0;(#,##0);-"],
  ["cash_open", "현금개통 사용", (r) => yn(r.cash_open, "사용", "미사용")],
  ["cash_bank", "은행"],
  ["cash_account", "입금계좌"],
  ["cash_holder", "예금주"],
  ["corp_card_amount", "법인카드 결제금액(₩)", undefined, "#,##0;(#,##0);-"],
  // ===== 토글/옵션 명문화 =====
  ["moyo_excluded", "모요 적용 여부", (r) => {
    const ch = String(r?.channel ?? "").trim().toLowerCase();
    const isMoyo = ch === "모요" || ch.includes("moyo");
    const isMobile = String(r?.product ?? "").trim() === "모바일";
    if (!isMoyo || !isMobile) return "해당없음";
    return r.moyo_excluded === true ? "적용안함" : "적용함";
  }],
  ["partner_card_enabled", "제휴카드 사용 여부", (r) => yn(pickCustom(r, "partner_card_enabled"), "사용함", "사용 안 함")],
  ["partner_card_company", "제휴카드 카드사", (r) => pickCustom(r, "partner_card_company") ?? ""],
  ["partner_card_number", "제휴카드 번호", (r) => pickCustom(r, "partner_card_number") ?? ""],
  ["partner_card_expiry", "제휴카드 유효기간", (r) => pickCustom(r, "partner_card_expiry") ?? ""],
  ["partner_card_discount_type", "제휴카드 할인유형", (r) => pickCustom(r, "partner_card_discount_type") ?? ""],
  ["partner_card_discount", "제휴카드 할인액(₩)", (r) => Number(pickCustom(r, "partner_card_discount") ?? 0) || 0, "#,##0;(#,##0);-"],
  ["bundle", "동판/번들"],
  // ===== 계산 결과 (값으로) =====
  ["calc_revenue", "[계산] 총 수익(₩)", (r) => calcDashboardProfit(r).revenue, "#,##0;(#,##0);-"],
  ["calc_expense", "[계산] 총 지출(₩)", (r) => calcDashboardProfit(r).expense, "#,##0;(#,##0);-"],
  ["calc_profit", "[계산] 최종 순수익(₩)", (r) => calcDashboardProfit(r).profit, "#,##0;(#,##0);-"],
  ["calc_moyo_fee", "[계산] 모요 수수료(₩)", (r) => calcDashboardProfit(r).moyoFee, "#,##0;(#,##0);-"],
  // ===== 배송/메모 =====
  ["delivery_type", "발송유형"],
  ["tracking_no", "운송장"],
  ["note", "비고"],
  ["created_at", "생성일시"],
  ["updated_at", "수정일시"],
];

/**
 * 판매원장 풀 스펙 엑셀 내보내기 (담당자 UID → 성함 매핑 포함)
 * @param rows  sales rows (custom_fields 포함된 raw row)
 * @param uidToName  user_id → display_name 매핑
 */
export const exportSalesFullExcel = (
  rows: any[],
  uidToName: Record<string, string> = {},
  fileName = "실적장표_상세",
  sheetName = "판매원장",
) => {
  if (!rows || rows.length === 0) {
    toast.warning("내보낼 데이터가 없습니다");
    return;
  }

  const enriched = rows.map((r) => ({
    ...r,
    manager: r.manager || uidToName[r.created_by] || r.manager || "",
  }));

  // AOA 방식으로 작성 (셀 단위 type/format 제어)
  const headerRow = FULL_SALES_COLUMNS.map(([, label]) => label);
  const aoa: any[][] = [headerRow];

  for (const row of enriched) {
    const line = FULL_SALES_COLUMNS.map(([key, , fn]) => {
      let v: any;
      if (typeof fn === "function") {
        try { v = fn(row); } catch { v = ""; }
      } else {
        v = row[key];
      }
      return v == null ? "" : v;
    });
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 숫자 포맷 + 셀 타입 적용
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let c = 0; c < FULL_SALES_COLUMNS.length; c++) {
    const [, , , fmt] = FULL_SALES_COLUMNS[c];
    if (!fmt) continue;
    for (let r = 1; r <= range.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const num = typeof cell.v === "number" ? cell.v : Number(String(cell.v).replace(/,/g, ""));
      if (Number.isFinite(num)) {
        cell.t = "n";
        cell.v = num;
        cell.z = fmt;
      }
    }
  }

  // 헤더 셀 스타일 (xlsx 커뮤니티는 일부만 반영 — 폰트 굵게 시도)
  for (let c = 0; c < FULL_SALES_COLUMNS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1F2937" }, patternType: "solid" },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  }

  // 자동 컬럼 폭
  ws["!cols"] = FULL_SALES_COLUMNS.map((col, idx) => {
    const label = col[1];
    const headerLen = label.length * 2;
    const maxBody = aoa.slice(1).reduce((m, line) => {
      const s = String(line[idx] ?? "");
      return Math.max(m, s.length);
    }, 0);
    return { wch: Math.min(45, Math.max(headerLen, maxBody) + 2) };
  });

  // 첫 행 고정
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${stamp}.xlsx`, { cellStyles: true });
  toast.success(`${rows.length}건 엑셀로 내보냈습니다 (전체 항목)`);
};

/** 여러 시트를 하나의 워크북으로 저장 */
export const exportMultiSheet = (
  sheets: Array<{ name: string; rows: any[]; columns: Array<ColumnDef> }>,
  fileName: string,
) => {
  const wb = XLSX.utils.book_new();
  let total = 0;
  for (const s of sheets) {
    if (!s.rows || s.rows.length === 0) continue;
    const remapped = s.rows.map((r) => {
      const o: Record<string, any> = {};
      for (const col of s.columns) {
        const v = resolveValue(r, col);
        o[col[1]] = v ?? "";
      }
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
const tvLinesText = (row: any): string => {
  const lines = row?.custom_fields?.tv_lines;
  if (!Array.isArray(lines) || lines.length === 0) return "";
  return lines
    .map((l: any, i: number) => {
      const plan = l?.rate_plan ?? "";
      const settop = l?.settop ?? "";
      return `TV${i + 1}: ${plan}${settop ? ` / ${settop}` : ""}`;
    })
    .join(" | ");
};

export const SALES_COLUMNS: Array<ColumnDef> = [
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
  ["vas1", "부가서비스1"],
  ["vas2", "부가서비스2"],
  ["tv_lines", "TV 추가회선", tvLinesText],
  ["unit_price", "단가표 기준(₩)"],
  ["vas_fee", "부가서비스 수수료(₩)"],
  ["distributor_amount", "유통망(₩)"],
  ["extra_subsidy", "추가지원금(₩)"],
  ["cash_support_amount", "현금지원금(₩)"],
  ["receivable_amount", "미수금(₩)"],
  ["receivable_paid", "미수금 입금"],
  ["voucher", "상품권"],
  ["voucher_returned", "상품권 회수"],
  ["voucher_amount", "상품권 금액(₩, 수익)", (r: any) => Number(r?.custom_fields?.voucher_amount ?? 0) || ""],
  ["delivery_type", "발송유형"],
  ["tracking_no", "운송장"],
  ["bundle", "동판/번들"],
  ["note", "비고"],
];

/** 컬럼 매핑 — 오퍼(지원금) 관리 전용 */
export const OFFER_COLUMNS: Array<ColumnDef> = [
  ["seq", "순번"],
  ["open_date", "개통일"],
  ["channel", "인입경로"],
  ["manager", "담당자"],
  ["customer_name", "고객명"],
  ["phone", "연락처"],
  ["product", "가입상품"],
  ["sale_type", "판매유형"],
  ["device_model", "단말기"],
  ["rate_plan", "개통요금제"],
  ["unit_price", "단가표 기준(₩)"],
  ["vas_fee", "부가서비스 수수료(₩)"],
  ["distributor_amount", "유통망 지원금(₩)"],
  ["extra_subsidy", "추가지원금(₩)"],
  ["cash_support_amount", "현금 지원금(₩)"],
  ["receivable_amount", "미수금(₩)"],
  ["receivable_paid", "미수금 입금"],
  ["cash_open", "현금개통"],
  ["cash_bank", "은행"],
  ["cash_account", "입금계좌"],
  ["cash_holder", "예금주"],
  ["voucher", "상품권"],
  ["voucher_returned", "상품권 회수"],
  ["voucher_amount", "상품권 금액(₩, 수익)", (r: any) => Number(r?.custom_fields?.voucher_amount ?? 0) || ""],
  ["net_fee", "회수 마진/수수료(₩)"],
  ["approval_status", "검수상태"],
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
  ["purchase_price", "매입가"],
  ["note", "메모"],
];

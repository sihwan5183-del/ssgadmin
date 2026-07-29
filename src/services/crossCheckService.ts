// ============================================================
// 확정(서류작성) 건 ↔ LG본사 전산 크로스체크 — 서비스 레이어
// ============================================================
// 본사에서 받은 엑셀(가입자 리스트)을 업로드하면
// 전화번호 기준으로 우리 확정 목록과 매칭해서
//   일치 / 정보상이(기기·용량·컬러 다름) / 본사만있음 / 우리만있음
// 4가지로 분류합니다. (은행 대사 방식과 동일)
// ============================================================
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { onlyDigits } from '@/lib/phoneFormat';
import {
  fetchConfirmedReservations,
  normalizeDevice,
  normalizeCapacity,
  normalizeColor,
  type ConfirmedRow,
} from './confirmedOrderService';

export type MatchStatus = '일치' | '정보상이' | '본사만있음';

export interface HqRawRow {
  phone_raw: string;
  phone_norm: string;
  name: string | null;
  device: string | null;
  capacity: string | null;
  color: string | null;
  serial_no: string | null;
  raw: Record<string, any>;
}

function pick(r: any, ...keys: string[]): any {
  for (const k of keys) {
    if (r[k] != null && String(r[k]).trim() !== '') return r[k];
  }
  return null;
}

/**
 * 본사 엑셀 파싱. 컬럼명이 정확히 뭘로 올지 몰라서
 * 흔히 쓰일 만한 헤더 이름들을 폭넓게 허용합니다.
 * (기존 DeviceInventoryPage.tsx 의 handleXlsx 패턴과 동일)
 */
export function parseHqExcel(buf: ArrayBuffer): HqRawRow[] {
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  return data
    .map((r) => {
      const phoneRaw = String(
        pick(r, '연락처', '전화번호', '휴대폰번호', '휴대전화', '휴대폰', '가입자번호', '가입번호', 'Phone', 'phone', '고객번호') ?? '',
      ).trim();
      const phoneNorm = onlyDigits(phoneRaw);
      const nameVal = pick(r, '고객명', '가입자명', '성명', '이름', 'Name', 'name');
      const deviceVal = pick(r, '기기', '모델', '모델명', '단말기', '단말', 'Model', 'model');
      const capacityVal = pick(r, '용량', 'Capacity', 'capacity');
      const colorVal = pick(r, '색상', '컬러', 'Color', 'color');
      const serialVal = pick(r, '일련번호', 'IMEI', 'imei', '시리얼', 'Serial', 'serial');

      return {
        phone_raw: phoneRaw,
        phone_norm: phoneNorm,
        name: nameVal ? String(nameVal).trim() : null,
        device: deviceVal ? String(deviceVal).trim() : null,
        capacity: capacityVal ? String(capacityVal).trim() : null,
        color: colorVal ? String(colorVal).trim() : null,
        serial_no: serialVal ? String(serialVal).trim() : null,
        raw: r,
      };
    })
    .filter((r) => r.phone_norm.length >= 9); // 유효한 번호만 (010xxxxxxxx 등)
}

export interface MatchedItem {
  row: HqRawRow;
  reservation: ConfirmedRow;
  mismatchFields: string[];
}

export interface CrossCheckResult {
  importId: string;
  fileName: string;
  matched: MatchedItem[];
  mismatched: MatchedItem[];
  hqOnly: HqRawRow[];       // 본사 데이터엔 있는데 우리 확정목록에 없음
  oursOnly: ConfirmedRow[]; // 우리 확정목록엔 있는데 본사 데이터에 없음
}

function fieldMismatches(row: HqRawRow, res: ConfirmedRow): string[] {
  const out: string[] = [];
  if (row.device) {
    if (normalizeDevice(row.device) !== res.device_norm) out.push('기기');
  }
  if (row.capacity) {
    if (normalizeCapacity(row.capacity) !== res.capacity_norm) out.push('용량');
  }
  if (row.color) {
    if (normalizeColor(row.color) !== res.color_norm) out.push('컬러');
  }
  return out;
}

/** 파일 업로드 → 매칭 실행 → DB 저장까지 한번에 처리 */
export async function runCrossCheck(file: File, uploaderId: string | null): Promise<CrossCheckResult> {
  const buf = await file.arrayBuffer();
  const hqRows = parseHqExcel(buf);
  if (hqRows.length === 0) {
    throw new Error('엑셀에서 유효한 연락처를 찾지 못했습니다. 컬럼명을 확인해주세요 (예: 연락처, 전화번호)');
  }

  // 항상 최신 확정 목록 기준으로 매칭 (캐시된 값 X)
  const confirmed = await fetchConfirmedReservations({});
  const byPhone = new Map<string, ConfirmedRow>();
  confirmed.forEach((c) => {
    const p = onlyDigits(c.phone ?? '');
    if (p && !byPhone.has(p)) byPhone.set(p, c); // 동일 번호 중복 확정건은 최초 1건만 매칭
  });

  const usedIds = new Set<string>();
  const matched: MatchedItem[] = [];
  const mismatched: MatchedItem[] = [];
  const hqOnly: HqRawRow[] = [];

  hqRows.forEach((row) => {
    const res = byPhone.get(row.phone_norm);
    if (!res) {
      hqOnly.push(row);
      return;
    }
    usedIds.add(res.id);
    const mismatchFields = fieldMismatches(row, res);
    if (mismatchFields.length === 0) matched.push({ row, reservation: res, mismatchFields });
    else mismatched.push({ row, reservation: res, mismatchFields });
  });

  const oursOnly = confirmed.filter((c) => !usedIds.has(c.id));

  // ── 저장 (imports 요약 + rows 상세) ──
  const { data: imp, error: impErr } = await supabase
    .from('hq_cross_check_imports')
    .insert({
      file_name: file.name,
      row_count: hqRows.length,
      matched_count: matched.length,
      mismatched_count: mismatched.length,
      hq_only_count: hqOnly.length,
      ours_only_count: oursOnly.length,
      uploaded_by: uploaderId,
    })
    .select()
    .single();
  if (impErr) throw impErr;

  const toInsert = [
    ...matched.map(({ row, reservation }) => rowPayload(imp.id, row, reservation.id, '일치', [])),
    ...mismatched.map(({ row, reservation, mismatchFields }) =>
      rowPayload(imp.id, row, reservation.id, '정보상이', mismatchFields),
    ),
    ...hqOnly.map((row) => rowPayload(imp.id, row, null, '본사만있음', [])),
  ];

  if (toInsert.length > 0) {
    // 대량 삽입 시 500건씩 나눠서
    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await supabase.from('hq_cross_check_rows').insert(toInsert.slice(i, i + 500));
      if (error) throw error;
    }
  }

  return { importId: imp.id, fileName: file.name, matched, mismatched, hqOnly, oursOnly };
}

function rowPayload(
  importId: string,
  row: HqRawRow,
  matchedReservationId: string | null,
  status: MatchStatus,
  mismatchFields: string[],
) {
  return {
    import_id: importId,
    phone_raw: row.phone_raw,
    phone_norm: row.phone_norm,
    name: row.name,
    device: row.device,
    capacity: row.capacity,
    color: row.color,
    serial_no: row.serial_no,
    raw: row.raw,
    matched_reservation_id: matchedReservationId,
    match_status: status,
    mismatch_fields: mismatchFields,
  };
}

// ── 조회 ──────────────────────────────────────────────────
export interface HqImportSummary {
  id: string;
  file_name: string | null;
  row_count: number;
  matched_count: number;
  mismatched_count: number;
  hq_only_count: number;
  ours_only_count: number;
  uploaded_by: string | null;
  created_at: string;
}

export async function fetchLatestImport(): Promise<HqImportSummary | null> {
  const { data, error } = await supabase
    .from('hq_cross_check_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as HqImportSummary | null;
}

export async function fetchImportHistory(limit = 10): Promise<HqImportSummary[]> {
  const { data, error } = await supabase
    .from('hq_cross_check_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HqImportSummary[];
}

export interface HqCrossCheckRow {
  id: string;
  import_id: string;
  phone_raw: string | null;
  phone_norm: string | null;
  name: string | null;
  device: string | null;
  capacity: string | null;
  color: string | null;
  serial_no: string | null;
  matched_reservation_id: string | null;
  match_status: MatchStatus;
  mismatch_fields: string[];
  created_at: string;
}

export async function fetchImportRows(importId: string): Promise<HqCrossCheckRow[]> {
  const { data, error } = await supabase
    .from('hq_cross_check_rows')
    .select('*')
    .eq('import_id', importId);
  if (error) throw error;
  return (data ?? []) as HqCrossCheckRow[];
}

/**
 * 최신 본사 업로드 기준으로, 지금 시점의 확정 목록에 대사 상태를 매핑.
 * (업로드 이후 새로 확정된 건은 자동으로 '확인전'으로 표시됨)
 */
export async function fetchCrossCheckStatusMap(): Promise<{
  latestImport: HqImportSummary | null;
  statusByReservationId: Map<string, { status: MatchStatus; mismatchFields: string[] }>;
  hqOnlyRows: HqCrossCheckRow[];
}> {
  const latestImport = await fetchLatestImport();
  if (!latestImport) {
    return { latestImport: null, statusByReservationId: new Map(), hqOnlyRows: [] };
  }
  const rows = await fetchImportRows(latestImport.id);
  const statusByReservationId = new Map<string, { status: MatchStatus; mismatchFields: string[] }>();
  const hqOnlyRows: HqCrossCheckRow[] = [];
  rows.forEach((r) => {
    if (r.matched_reservation_id) {
      statusByReservationId.set(r.matched_reservation_id, {
        status: r.match_status,
        mismatchFields: r.mismatch_fields ?? [],
      });
    } else {
      hqOnlyRows.push(r);
    }
  });
  return { latestImport, statusByReservationId, hqOnlyRows };
}

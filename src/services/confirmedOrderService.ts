// ============================================================
// 확정(서류작성) 발주 집계 — 서비스 레이어
// ============================================================
// reservations 테이블에서 status='확정' 건만 읽어와
// 기기 / 용량 / 컬러 분포도를 계산합니다. (읽기 전용, 신규 테이블 없음)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type { Reservation } from '@/types/reservation';
import { DEVICE_COLOR_MAP } from '@/types/reservation';

export const CONFIRMED_STATUS = '확정';
export const UNSET = '미정';

// 정규화 기준값
// 대시보드 표시 순서: 좌(폴드8) / 가운데(폴드8 울트라) / 우(플립8)
export const DEVICE_CANON = [
  '갤럭시 Z 폴드8',
  '갤럭시 Z 폴드8 울트라',
  '갤럭시 Z 플립8',
] as const;

export const CAPACITY_CANON = ['256GB', '512GB', '1TB'] as const;

// 전체 컬러 목록 (중복 제거, 등장 순서 유지)
export const COLOR_CANON = Array.from(
  new Set(Object.values(DEVICE_COLOR_MAP).flat()),
);

// ── 정규화 ────────────────────────────────────────────────
// 관심기기는 랜딩페이지/수기입력 혼재라 오타·구칭·띄어쓰기가 섞여 있음.
// types/reservation.ts 의 getColorsForDevice 와 동일한 판정 로직을 사용.
export function normalizeDevice(raw: string | null | undefined): string {
  if (!raw) return UNSET;
  const d = raw.replace(/\s+/g, '');
  if (d.includes('트라') || d.includes('와이드')) return '갤럭시 Z 폴드8 울트라';
  if (d.includes('플립')) return '갤럭시 Z 플립8';
  if (d.includes('폴드')) return '갤럭시 Z 폴드8';
  return raw.trim() || UNSET;
}

export function normalizeCapacity(raw: string | null | undefined): string {
  if (!raw) return UNSET;
  const c = raw.replace(/\s+/g, '').toUpperCase();
  if (c.includes('1TB') || c.includes('1024')) return '1TB';
  if (c.includes('512')) return '512GB';
  if (c.includes('256')) return '256GB';
  if (c.includes('128')) return '128GB';
  return raw.trim() || UNSET;
}

export function normalizeColor(raw: string | null | undefined): string {
  if (!raw) return UNSET;
  const c = raw.replace(/\s+/g, '');
  if (c === '' || c === UNSET) return UNSET;
  const hit = COLOR_CANON.find((x) => x.replace(/\s+/g, '') === c);
  return hit ?? raw.trim();
}

// 가입유형 자동계산 — 통신사=LG U+ → 기기변경, 그 외(SKT/KT/알뜰폰 등) → MNP(통신사)
// subscription_type 컬럼이 비어있을 때 화면/CSV에서 이 값을 기본값으로 보여준다.
// (DB에 강제로 써넣지 않음 — 담당자가 예외 케이스면 직접 수정 가능)
export function computeSubscriptionType(carrier: string | null | undefined): string {
  const c = (carrier ?? '').trim();
  if (!c) return '';
  return c === 'LG U+' ? '기기변경' : `MNP(${c})`;
}

// ── 조회 ──────────────────────────────────────────────────
export interface ConfirmedRow extends Reservation {
  device_norm: string;
  capacity_norm: string;
  color_norm: string;
  /** 기기·용량·컬러가 모두 확정되어 바로 발주 가능한 건 */
  order_ready: boolean;
}

export interface ConfirmedFilters {
  /** 접수일(created_at) 기준 YYYY-MM-DD */
  dateStart?: string;
  dateEnd?: string;
  channel?: string;
  assignedTo?: string;
}

const CHUNK = 1000;

/** status='확정' 전체 건을 페이지네이션 없이 모두 가져옵니다. */
export async function fetchConfirmedReservations(
  filters: ConfirmedFilters = {},
): Promise<ConfirmedRow[]> {
  const { dateStart, dateEnd, channel, assignedTo } = filters;
  const all: Reservation[] = [];

  for (let from = 0; ; from += CHUNK) {
    let q = supabase
      .from('reservations')
      .select('*')
      .eq('status', CONFIRMED_STATUS)
      .order('created_at', { ascending: false })
      .range(from, from + CHUNK - 1);

    if (channel) q = q.eq('channel', channel);
    if (assignedTo) q = q.eq('assigned_to', assignedTo);
    if (dateStart) q = q.gte('created_at', `${dateStart}T00:00:00`);
    if (dateEnd) q = q.lte('created_at', `${dateEnd}T23:59:59`);

    const { data, error } = await q;
    if (error) throw error;
    const page = (data ?? []) as unknown as Reservation[];
    all.push(...page);
    if (page.length < CHUNK) break;
  }

  return all.map((r) => {
    const device_norm = normalizeDevice(r.device_interest);
    const capacity_norm = normalizeCapacity(r.capacity);
    const color_norm = normalizeColor(r.product_color);
    return {
      ...r,
      device_norm,
      capacity_norm,
      color_norm,
      order_ready:
        device_norm !== UNSET && capacity_norm !== UNSET && color_norm !== UNSET,
    };
  });
}

// ── 집계 ──────────────────────────────────────────────────
export interface CountItem {
  key: string;
  count: number;
  ratio: number; // 0~100
}

export interface ComboItem {
  device: string;
  capacity: string;
  color: string;
  count: number;
  ratio: number;
  ready: boolean;
}

export interface DevicePivot {
  device: string;
  colors: string[];        // 해당 기기의 컬러 축 (미정 포함)
  capacities: string[];    // 해당 기기의 용량 축 (미정 포함)
  cells: Record<string, number>;  // `${capacity}|${color}` → count
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  total: number;
}

export interface ConfirmedSummary {
  total: number;
  deviceUnset: number;
  capacityUnset: number;
  colorUnset: number;
  orderReady: number;
  byDevice: CountItem[];
  byCapacity: CountItem[];
  byColor: CountItem[];
  combos: ComboItem[];
  pivots: DevicePivot[];
}

function toCountItems(map: Record<string, number>, total: number, order: readonly string[]): CountItem[] {
  const keys = Object.keys(map).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    if (a === UNSET) return 1;
    if (b === UNSET) return -1;
    return map[b] - map[a];
  });
  return keys.map((k) => ({
    key: k,
    count: map[k],
    ratio: total > 0 ? Math.round((map[k] / total) * 1000) / 10 : 0,
  }));
}

export function buildConfirmedSummary(rows: ConfirmedRow[]): ConfirmedSummary {
  const total = rows.length;

  const dMap: Record<string, number> = {};
  const cMap: Record<string, number> = {};
  const colMap: Record<string, number> = {};
  const comboMap: Record<string, number> = {};

  rows.forEach((r) => {
    dMap[r.device_norm] = (dMap[r.device_norm] ?? 0) + 1;
    cMap[r.capacity_norm] = (cMap[r.capacity_norm] ?? 0) + 1;
    colMap[r.color_norm] = (colMap[r.color_norm] ?? 0) + 1;
    const key = `${r.device_norm}|${r.capacity_norm}|${r.color_norm}`;
    comboMap[key] = (comboMap[key] ?? 0) + 1;
  });

  const deviceOrder = [...DEVICE_CANON] as string[];

  const combos: ComboItem[] = Object.entries(comboMap)
    .map(([key, count]) => {
      const [device, capacity, color] = key.split('|');
      return {
        device,
        capacity,
        color,
        count,
        ratio: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        ready: device !== UNSET && capacity !== UNSET && color !== UNSET,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.device.localeCompare(b.device);
    });

  // 기기별 피벗 (행=용량, 열=컬러)
  // 대시보드는 좌/가운데/우 3단 고정 레이아웃이라, 확정 건이 0건이어도
  // 폴드8/폴드8 울트라/플립8 3개 컬럼은 항상 노출한다 (그 외 미분류 기기는 뒤에 추가).
  const nonCanonKeys = Object.keys(dMap)
    .filter((k) => !deviceOrder.includes(k) && k !== UNSET)
    .sort((a, b) => dMap[b] - dMap[a]);
  const deviceKeys = [...deviceOrder, ...nonCanonKeys];

  const pivots: DevicePivot[] = deviceKeys.map((device) => {
    const sub = rows.filter((r) => r.device_norm === device);

    const baseColors = DEVICE_COLOR_MAP[device] ?? [];
    const usedColors = Array.from(new Set(sub.map((r) => r.color_norm)));
    const colors = [
      ...baseColors.filter((c) => usedColors.includes(c) || baseColors.length > 0),
      ...usedColors.filter((c) => !baseColors.includes(c) && c !== UNSET),
    ];
    if (usedColors.includes(UNSET)) colors.push(UNSET);

    const usedCaps = Array.from(new Set(sub.map((r) => r.capacity_norm)));
    // 컬러축과 동일하게: 데이터가 0건이어도 256GB/512GB/1TB 축은 항상 노출 (빈 그리드로 보여줌)
    const capacities = [
      ...CAPACITY_CANON,
      ...usedCaps.filter((c) => !CAPACITY_CANON.includes(c as any) && c !== UNSET),
    ];
    if (usedCaps.includes(UNSET)) capacities.push(UNSET);

    const cells: Record<string, number> = {};
    const rowTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};

    sub.forEach((r) => {
      const k = `${r.capacity_norm}|${r.color_norm}`;
      cells[k] = (cells[k] ?? 0) + 1;
      rowTotals[r.capacity_norm] = (rowTotals[r.capacity_norm] ?? 0) + 1;
      colTotals[r.color_norm] = (colTotals[r.color_norm] ?? 0) + 1;
    });

    return {
      device,
      colors: Array.from(new Set(colors)),
      capacities: Array.from(new Set(capacities)),
      cells,
      rowTotals,
      colTotals,
      total: sub.length,
    };
  });

  return {
    total,
    deviceUnset: dMap[UNSET] ?? 0,
    capacityUnset: cMap[UNSET] ?? 0,
    colorUnset: colMap[UNSET] ?? 0,
    orderReady: rows.filter((r) => r.order_ready).length,
    byDevice: toCountItems(dMap, total, deviceOrder),
    byCapacity: toCountItems(cMap, total, CAPACITY_CANON),
    byColor: toCountItems(colMap, total, COLOR_CANON),
    combos,
    pivots,
  };
}

// ── CSV ───────────────────────────────────────────────────
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

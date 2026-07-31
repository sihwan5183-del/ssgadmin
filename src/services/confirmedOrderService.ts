// ============================================================
// 확정(서류작성) 발주 집계 — 서비스 레이어
// ============================================================
// reservations 테이블에서 status='확정' 건만 읽어와
// 기기 / 용량 / 컬러 분포도를 계산합니다. (읽기 전용, 신규 테이블 없음)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type { Reservation } from '@/types/reservation';
import { DEVICE_COLOR_MAP } from '@/types/reservation';

// v20260731: 택배발송 완료된 건도 계속 "확정 파이프라인"에 남아 보여야 하므로
// (발주표/스펙시트/팀리포트/2ND통계/본사대사에서 사라지면 안 됨) 확정+택배발송 둘 다 포함.
export const CONFIRMED_STATUS = '확정'; // 하위호환용 단일값 (신규 코드에서는 CONFIRMED_STATUSES 사용)
export const CONFIRMED_STATUSES = ['확정', '택배발송'] as const;
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
      .in('status', CONFIRMED_STATUSES)
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

export function downloadCsvRaw(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 팀별 확정 현황 리포트 ────────────────────────────────
// 기기별 용량×컬러 표 + 가입유형/부가서비스 비율 + 2ND 상품 리스트를
// 팀 단위로 묶어서 하나의 CSV로 뽑는다. (엑셀 서식 그대로 재현)
export function classifySubscriptionType(r: ConfirmedRow): 'MNP' | '기기변경' | '기타' {
  const v = (r.subscription_type ?? computeSubscriptionType(r.carrier) ?? '').trim();
  if (v.startsWith('MNP')) return 'MNP';
  if (v.includes('기기변경')) return '기기변경';
  return '기타';
}

function buildTeamReportBlock(teamName: string, rows: ConfirmedRow[]): (string | number)[][] {
  const total = rows.length;
  const colorUnset = rows.filter((r) => r.color_norm === UNSET).length;
  const out: (string | number)[][] = [];

  out.push([`⚠️ 컬러 미정 총 ${colorUnset}건 (전체 ${total}건 중)`]);
  out.push([]);
  out.push([`${teamName} 전체 확정 합계`, `${total}건`]);
  out.push([]);

  // 기기별 용량×컬러 표 (좌: 폴드8 / 가운데: 폴드8 울트라 / 우: 플립8 순서, 데이터 있는 기기만)
  DEVICE_CANON.forEach((device) => {
    const sub = rows.filter((r) => r.device_norm === device);
    if (sub.length === 0) return;

    const map: Record<string, number> = {};
    sub.forEach((r) => {
      const k = `${r.capacity_norm}|${r.color_norm}`;
      map[k] = (map[k] ?? 0) + 1;
    });
    const combos = Object.entries(map)
      .map(([k, count]) => {
        const [cap, col] = k.split('|');
        return { cap, col, count };
      })
      .sort((a, b) => {
        const ia = CAPACITY_CANON.indexOf(a.cap as any);
        const ib = CAPACITY_CANON.indexOf(b.cap as any);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.col.localeCompare(b.col, 'ko');
      });

    out.push([device]);
    out.push(['용량', '컬러', '수량']);
    combos.forEach((c) => out.push([c.cap, c.col, c.count]));
    out.push(['', '소계', sub.length]);
    out.push([]);
  });

  // 가입유형 · 부가서비스 비율
  const mnpCount = rows.filter((r) => classifySubscriptionType(r) === 'MNP').length;
  const changeCount = rows.filter((r) => classifySubscriptionType(r) === '기기변경').length;
  const etcCount = total - mnpCount - changeCount;
  const bundleCount = rows.filter((r) => (r.bundle_watch ?? '').trim() !== '' || (r.bundle_tablet ?? '').trim() !== '').length;
  const internetCount = rows.filter((r) => (r.home_internet ?? '').trim() !== '').length;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}%` : '0%');

  out.push([`가입유형 · 부가서비스 비율 (확정 ${total}건 기준)`]);
  out.push(['구분', '건수', '비율']);
  out.push(['MNP', mnpCount, pct(mnpCount)]);
  out.push(['기기변경', changeCount, pct(changeCount)]);
  if (etcCount > 0) out.push(['기타', etcCount, pct(etcCount)]);
  out.push(['번들(2ND)', bundleCount, pct(bundleCount)]);
  out.push(['인터넷(동판)', internetCount, pct(internetCount)]);
  out.push([]);

  // 2ND (워치·태블릿) — 상품명 합쳐서 한 표로
  const productMap: Record<string, number> = {};
  rows.forEach((r) => {
    const w = (r.bundle_watch ?? '').trim();
    if (w) productMap[w] = (productMap[w] ?? 0) + 1;
    const t = (r.bundle_tablet ?? '').trim();
    if (t) {
      const key = t.toUpperCase(); // X236/x236 표기 통일 (통계 페이지와 동일 규칙)
      productMap[key] = (productMap[key] ?? 0) + 1;
    }
  });
  out.push(['2ND (워치·태블릿)']);
  out.push(['상품명', '수량']);
  Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => out.push([name, count]));

  return out;
}

/**
 * 팀별 확정 현황 리포트 CSV 다운로드.
 * staffTeamMap: assigned_to(user_id) → 팀명. 팀 미배정 담당자는 "미배정"으로 묶임.
 */
export function downloadTeamReportCsv(rows: ConfirmedRow[], staffTeamMap: Record<string, string | null>) {
  const teamGroups = new Map<string, ConfirmedRow[]>();
  rows.forEach((r) => {
    const team = (r.assigned_to && staffTeamMap[r.assigned_to]) || '미배정';
    if (!teamGroups.has(team)) teamGroups.set(team, []);
    teamGroups.get(team)!.push(r);
  });

  const allRows: (string | number)[][] = [];
  Array.from(teamGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([team, teamRows], idx) => {
      if (idx > 0) {
        allRows.push([]);
        allRows.push([]);
      }
      allRows.push(...buildTeamReportBlock(team, teamRows));
    });

  downloadCsvRaw(`팀별_확정현황_${new Date().toISOString().slice(0, 10)}.csv`, allRows);
}

// ── 제품(기기) × 용량 × 컬러 위계 리포트 ──────────────────
// 확정 목록(확정+택배발송) 전체를 기기 → 용량 → 컬러 순서로 들여쓰기 없이
// 표 단위로 끊어서 정리한다. (팀 구분 없이 전체 합산 버전)
export function buildHierarchyReportRows(rows: ConfirmedRow[]): (string | number)[][] {
  const out: (string | number)[][] = [];
  const total = rows.length;
  const colorUnset = rows.filter((r) => r.color_norm === UNSET).length;

  out.push([`⚠️ 컬러 미정 총 ${colorUnset}건 (전체 ${total}건 중)`]);
  out.push([]);
  out.push(['제품별 · 용량별 · 컬러별 확정 현황', `${total}건`]);
  out.push([]);

  DEVICE_CANON.forEach((device) => {
    const sub = rows.filter((r) => r.device_norm === device);
    if (sub.length === 0) return;

    const map: Record<string, number> = {};
    sub.forEach((r) => {
      const k = `${r.capacity_norm}|${r.color_norm}`;
      map[k] = (map[k] ?? 0) + 1;
    });
    const combos = Object.entries(map)
      .map(([k, count]) => {
        const [cap, col] = k.split('|');
        return { cap, col, count };
      })
      .sort((a, b) => {
        const ia = CAPACITY_CANON.indexOf(a.cap as any);
        const ib = CAPACITY_CANON.indexOf(b.cap as any);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.col.localeCompare(b.col, 'ko');
      });

    out.push([device, '', '', `${sub.length}건`]);
    out.push(['용량', '컬러', '수량', '비중']);
    combos.forEach((c) => {
      const pct = sub.length > 0 ? `${Math.round((c.count / sub.length) * 1000) / 10}%` : '0%';
      out.push([c.cap, c.col, c.count, pct]);
    });
    out.push(['', '소계', sub.length, '100%']);
    out.push([]);
  });

  out.push(['전체 합계', '', total]);
  return out;
}

export function downloadHierarchyReportCsv(rows: ConfirmedRow[]) {
  if (rows.length === 0) return;
  downloadCsvRaw(`제품별_용량별_컬러별_확정현황_${new Date().toISOString().slice(0, 10)}.csv`, buildHierarchyReportRows(rows));
}

// 기기별 용량×컬러 표만 뽑아내는 재사용 헬퍼 (헤더/합계 없이 표 블록만) — 상위 리포트에서 그룹별로 반복 사용
function buildDeviceCapacityColorBlocks(rows: ConfirmedRow[]): (string | number)[][] {
  const out: (string | number)[][] = [];
  DEVICE_CANON.forEach((device) => {
    const sub = rows.filter((r) => r.device_norm === device);
    if (sub.length === 0) return;

    const map: Record<string, number> = {};
    sub.forEach((r) => {
      const k = `${r.capacity_norm}|${r.color_norm}`;
      map[k] = (map[k] ?? 0) + 1;
    });
    const combos = Object.entries(map)
      .map(([k, count]) => {
        const [cap, col] = k.split('|');
        return { cap, col, count };
      })
      .sort((a, b) => {
        const ia = CAPACITY_CANON.indexOf(a.cap as any);
        const ib = CAPACITY_CANON.indexOf(b.cap as any);
        if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        return a.col.localeCompare(b.col, 'ko');
      });

    out.push([device, '', '', `${sub.length}건`]);
    out.push(['용량', '컬러', '수량', '비중']);
    combos.forEach((c) => {
      const pct = sub.length > 0 ? `${Math.round((c.count / sub.length) * 1000) / 10}%` : '0%';
      out.push([c.cap, c.col, c.count, pct]);
    });
    out.push(['', '소계', sub.length, '100%']);
    out.push([]);
  });
  return out;
}

// ── MNP vs 자사(기기변경) 분리 리포트 ────────────────────
// 발주대상(확정, 택배발송 제외) 건을 가입유형으로 나눠서 각각 기기×용량×컬러 매트릭스를 같이 보여준다.
export interface MnpSplitSummary {
  total: number;
  mnpCount: number;
  ownCount: number;
  etcCount: number;
}

export function buildMnpSplitSummary(rows: ConfirmedRow[]): MnpSplitSummary {
  const total = rows.length;
  const mnpCount = rows.filter((r) => classifySubscriptionType(r) === 'MNP').length;
  const ownCount = rows.filter((r) => classifySubscriptionType(r) === '기기변경').length;
  const etcCount = total - mnpCount - ownCount;
  return { total, mnpCount, ownCount, etcCount };
}

export function buildMnpSplitReportRows(rows: ConfirmedRow[]): (string | number)[][] {
  const s = buildMnpSplitSummary(rows);
  const mnpRows = rows.filter((r) => classifySubscriptionType(r) === 'MNP');
  const ownRows = rows.filter((r) => classifySubscriptionType(r) === '기기변경');
  const etcRows = rows.filter((r) => classifySubscriptionType(r) === '기타');

  const out: (string | number)[][] = [];
  out.push(['MNP · 자사(기기변경) 분리 현황 (발주대상, 택배발송 제외)', `${s.total}건`]);
  out.push([]);
  out.push(['구분', '건수', '비율']);
  out.push(['MNP', s.mnpCount, s.total > 0 ? `${Math.round((s.mnpCount / s.total) * 1000) / 10}%` : '0%']);
  out.push(['자사(기기변경)', s.ownCount, s.total > 0 ? `${Math.round((s.ownCount / s.total) * 1000) / 10}%` : '0%']);
  if (s.etcCount > 0) out.push(['기타', s.etcCount, s.total > 0 ? `${Math.round((s.etcCount / s.total) * 1000) / 10}%` : '0%']);
  out.push([]);

  out.push([`[MNP] ${mnpRows.length}건`]);
  out.push([]);
  out.push(...buildDeviceCapacityColorBlocks(mnpRows));

  out.push([`[자사(기기변경)] ${ownRows.length}건`]);
  out.push([]);
  out.push(...buildDeviceCapacityColorBlocks(ownRows));

  if (etcRows.length > 0) {
    out.push([`[기타] ${etcRows.length}건`]);
    out.push([]);
    out.push(...buildDeviceCapacityColorBlocks(etcRows));
  }

  return out;
}

export function downloadMnpSplitReportCsv(rows: ConfirmedRow[]) {
  if (rows.length === 0) return;
  downloadCsvRaw(`MNP_자사_분리현황_${new Date().toISOString().slice(0, 10)}.csv`, buildMnpSplitReportRows(rows));
}


// ============================================================
// 스타일 있는 엑셀(.xls) 출력 — HTML 테이블을 엑셀이 그대로 읽어서
// 색상/테두리/병합셀까지 살아있는 실제 엑셀 파일로 열리게 한다.
// (진짜 .xlsx 바이너리 대신 엑셀호환 HTML을 .xls로 저장하는 방식 — 새 라이브러리 없이 동작)
// ============================================================
const XLS_NAVY = '#1F3864';
const XLS_DEVICE_BG = '#D9E2F3';
const XLS_UNSET_BG = '#FADBD8';
const XLS_UNSET_COLOR = '#C0392B';
const XLS_SUBTOTAL_BG = '#D9D9D9';
const XLS_WARN_BG = '#FDEDEC';
const XLS_WARN_COLOR = '#C0392B';
const XLS_BORDER = '1px solid #999999';

function xlsEsc(v: string | number): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function xlsTitleRow(text: string, sub?: string): string {
  return `<table style="border-collapse:collapse;margin-bottom:10px;"><tr>
    <td style="background:${XLS_NAVY};color:#ffffff;font-weight:bold;font-size:14px;padding:8px 12px;border:${XLS_BORDER};">${xlsEsc(text)}</td>
    ${sub ? `<td style="background:${XLS_NAVY};color:#ffffff;font-weight:bold;font-size:14px;padding:8px 12px;border:${XLS_BORDER};text-align:center;">${xlsEsc(sub)}</td>` : ''}
  </tr></table>`;
}

function xlsWarnBanner(text: string): string {
  return `<table style="border-collapse:collapse;margin-bottom:10px;"><tr>
    <td style="background:${XLS_WARN_BG};color:${XLS_WARN_COLOR};font-weight:bold;font-size:12px;padding:6px 12px;border:${XLS_BORDER};">${xlsEsc(text)}</td>
  </tr></table>`;
}

/** 기기 하나 = 용량×컬러 표 하나. 좌측에 기기명 병합셀(rowspan), 미정 행은 빨간 하이라이트, 소계는 회색 강조. */
function xlsDeviceTable(device: string, sub: ConfirmedRow[]): string {
  const map: Record<string, number> = {};
  sub.forEach((r) => {
    const k = `${r.capacity_norm}|${r.color_norm}`;
    map[k] = (map[k] ?? 0) + 1;
  });
  const combos = Object.entries(map)
    .map(([k, count]) => {
      const [cap, col] = k.split('|');
      return { cap, col, count };
    })
    .sort((a, b) => {
      const ia = CAPACITY_CANON.indexOf(a.cap as any);
      const ib = CAPACITY_CANON.indexOf(b.cap as any);
      if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.col.localeCompare(b.col, 'ko');
    });
  if (combos.length === 0) return '';

  const headerCells = ['용량', '컬러', '수량']
    .map((h) => `<td style="border:${XLS_BORDER};padding:6px 10px;background:${XLS_NAVY};color:#ffffff;font-weight:bold;font-size:12px;text-align:center;">${h}</td>`)
    .join('');
  const headerRow = `<tr><td style="border:${XLS_BORDER};background:${XLS_NAVY};"></td>${headerCells}</tr>`;

  const dataRows = combos.map((c, i) => {
    const isUnset = c.cap === UNSET || c.col === UNSET;
    const rowBg = isUnset ? XLS_UNSET_BG : (i % 2 === 0 ? '#FFFFFF' : '#F2F5FA');
    const textColor = isUnset ? XLS_UNSET_COLOR : '#333333';
    const weight = isUnset ? 'font-weight:bold;' : '';
    const deviceCell = i === 0
      ? `<td rowspan="${combos.length + 1}" style="border:${XLS_BORDER};padding:6px 10px;background:${XLS_DEVICE_BG};font-weight:bold;font-size:13px;text-align:center;vertical-align:middle;">${xlsEsc(device)}</td>`
      : '';
    return `<tr>${deviceCell}
      <td style="border:${XLS_BORDER};padding:4px 8px;background:${rowBg};color:${textColor};font-size:12px;text-align:center;${weight}">${xlsEsc(c.cap)}</td>
      <td style="border:${XLS_BORDER};padding:4px 8px;background:${rowBg};color:${textColor};font-size:12px;text-align:center;${weight}">${xlsEsc(c.col)}</td>
      <td style="border:${XLS_BORDER};padding:4px 8px;background:${rowBg};color:${textColor};font-size:12px;text-align:center;font-weight:bold;">${c.count}</td>
    </tr>`;
  }).join('');

  const subtotalRow = `<tr>
    <td colspan="2" style="border:${XLS_BORDER};padding:4px 8px;background:${XLS_SUBTOTAL_BG};font-weight:bold;font-size:12px;text-align:center;">소계</td>
    <td style="border:${XLS_BORDER};padding:4px 8px;background:${XLS_SUBTOTAL_BG};font-weight:bold;font-size:12px;text-align:center;">${sub.length}</td>
  </tr>`;

  return `<table style="border-collapse:collapse;margin-bottom:14px;">${headerRow}${dataRows}${subtotalRow}</table>`;
}

/** 여러 기기(DEVICE_CANON 순서)의 표를 이어붙임 */
function xlsDeviceTables(rows: ConfirmedRow[]): string {
  return DEVICE_CANON.map((device) => {
    const sub = rows.filter((r) => r.device_norm === device);
    return sub.length > 0 ? xlsDeviceTable(device, sub) : '';
  }).join('');
}

/** 구분/건수/비율 형태의 작은 요약표 (가입유형, MNP비율 등 공용) */
function xlsRatioTable(title: string, items: { label: string; count: number; ratio: string; accent?: string }[]): string {
  const rowsHtml = items.map((it) => `<tr>
    <td style="border:${XLS_BORDER};padding:5px 10px;font-size:12px;${it.accent ? `background:${it.accent};font-weight:bold;` : ''}">${xlsEsc(it.label)}</td>
    <td style="border:${XLS_BORDER};padding:5px 10px;font-size:12px;text-align:center;font-weight:bold;">${it.count}</td>
    <td style="border:${XLS_BORDER};padding:5px 10px;font-size:12px;text-align:center;">${xlsEsc(it.ratio)}</td>
  </tr>`).join('');
  return `<table style="border-collapse:collapse;margin-bottom:14px;">
    <tr>
      <td style="border:${XLS_BORDER};padding:6px 10px;background:${XLS_NAVY};color:#fff;font-weight:bold;font-size:12px;" colspan="3">${xlsEsc(title)}</td>
    </tr>
    <tr>
      <td style="border:${XLS_BORDER};padding:5px 10px;background:#E8EDF5;font-weight:bold;font-size:12px;">구분</td>
      <td style="border:${XLS_BORDER};padding:5px 10px;background:#E8EDF5;font-weight:bold;font-size:12px;text-align:center;">건수</td>
      <td style="border:${XLS_BORDER};padding:5px 10px;background:#E8EDF5;font-weight:bold;font-size:12px;text-align:center;">비율</td>
    </tr>
    ${rowsHtml}
  </table>`;
}

/** 상품명/수량 형태의 작은 표 (2ND 워치·태블릿 등) */
function xlsNameCountTable(title: string, items: { name: string; count: number }[]): string {
  const rowsHtml = items.map((it) => `<tr>
    <td style="border:${XLS_BORDER};padding:5px 10px;font-size:12px;">${xlsEsc(it.name)}</td>
    <td style="border:${XLS_BORDER};padding:5px 10px;font-size:12px;text-align:center;font-weight:bold;">${it.count}</td>
  </tr>`).join('');
  return `<table style="border-collapse:collapse;margin-bottom:14px;">
    <tr><td style="border:${XLS_BORDER};padding:6px 10px;background:${XLS_NAVY};color:#fff;font-weight:bold;font-size:12px;" colspan="2">${xlsEsc(title)}</td></tr>
    <tr>
      <td style="border:${XLS_BORDER};padding:5px 10px;background:#E8EDF5;font-weight:bold;font-size:12px;">상품명</td>
      <td style="border:${XLS_BORDER};padding:5px 10px;background:#E8EDF5;font-weight:bold;font-size:12px;text-align:center;">수량</td>
    </tr>
    ${rowsHtml}
  </table>`;
}

/** HTML 문자열을 엑셀이 인식하는 .xls 파일로 다운로드 (색상·병합셀 그대로 유지) */
export function downloadStyledXls(filename: string, bodyHtml: string) {
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>td{font-family:맑은 고딕, Malgun Gothic, sans-serif;}</style>
</head>
<body>${bodyHtml}</body></html>`;
  const blob = new Blob(['\ufeff' + doc], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 제품·용량·컬러 위계 리포트 (엑셀 서식) ────────────────
export function buildHierarchyReportXlsHtml(rows: ConfirmedRow[]): string {
  const total = rows.length;
  const colorUnset = rows.filter((r) => r.color_norm === UNSET).length;
  let html = '';
  if (colorUnset > 0) html += xlsWarnBanner(`⚠️ 컬러 미정 총 ${colorUnset}건 (전체 ${total}건 중)`);
  html += xlsTitleRow('제품별 · 용량별 · 컬러별 확정 현황', `${total}건`);
  html += xlsDeviceTables(rows);
  return html;
}

export function downloadHierarchyReportXls(rows: ConfirmedRow[]) {
  if (rows.length === 0) return;
  downloadStyledXls(
    `제품별_용량별_컬러별_확정현황_${new Date().toISOString().slice(0, 10)}.xls`,
    buildHierarchyReportXlsHtml(rows),
  );
}

// ── MNP vs 자사(기기변경) 분리 리포트 (엑셀 서식) ─────────
export function buildMnpSplitReportXlsHtml(rows: ConfirmedRow[]): string {
  const s = buildMnpSplitSummary(rows);
  const mnpRows = rows.filter((r) => classifySubscriptionType(r) === 'MNP');
  const ownRows = rows.filter((r) => classifySubscriptionType(r) === '기기변경');
  const etcRows = rows.filter((r) => classifySubscriptionType(r) === '기타');
  const pct = (n: number) => (s.total > 0 ? `${Math.round((n / s.total) * 1000) / 10}%` : '0%');

  let html = xlsTitleRow('MNP · 자사(기기변경) 분리 현황 (발주대상, 택배발송 제외)', `${s.total}건`);
  html += xlsRatioTable('가입유형 비율', [
    { label: 'MNP', count: s.mnpCount, ratio: pct(s.mnpCount), accent: '#E8EAF6' },
    { label: '자사(기기변경)', count: s.ownCount, ratio: pct(s.ownCount), accent: '#E3F2FD' },
    ...(s.etcCount > 0 ? [{ label: '기타', count: s.etcCount, ratio: pct(s.etcCount) }] : []),
  ]);
  html += xlsTitleRow(`[MNP] ${mnpRows.length}건`);
  html += xlsDeviceTables(mnpRows);
  html += xlsTitleRow(`[자사(기기변경)] ${ownRows.length}건`);
  html += xlsDeviceTables(ownRows);
  if (etcRows.length > 0) {
    html += xlsTitleRow(`[기타] ${etcRows.length}건`);
    html += xlsDeviceTables(etcRows);
  }
  return html;
}

export function downloadMnpSplitReportXls(rows: ConfirmedRow[]) {
  if (rows.length === 0) return;
  downloadStyledXls(
    `MNP_자사_분리현황_${new Date().toISOString().slice(0, 10)}.xls`,
    buildMnpSplitReportXlsHtml(rows),
  );
}

// ── 팀별 확정 현황 리포트 (엑셀 서식) ─────────────────────
function xlsTeamReportBlock(teamName: string, rows: ConfirmedRow[]): string {
  const total = rows.length;
  const colorUnset = rows.filter((r) => r.color_norm === UNSET).length;
  const mnpCount = rows.filter((r) => classifySubscriptionType(r) === 'MNP').length;
  const changeCount = rows.filter((r) => classifySubscriptionType(r) === '기기변경').length;
  const etcCount = total - mnpCount - changeCount;
  const bundleCount = rows.filter((r) => (r.bundle_watch ?? '').trim() !== '' || (r.bundle_tablet ?? '').trim() !== '').length;
  const internetCount = rows.filter((r) => (r.home_internet ?? '').trim() !== '').length;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}%` : '0%');

  const productMap: Record<string, number> = {};
  rows.forEach((r) => {
    const w = (r.bundle_watch ?? '').trim();
    if (w) productMap[w] = (productMap[w] ?? 0) + 1;
    const t = (r.bundle_tablet ?? '').trim();
    if (t) { const key = t.toUpperCase(); productMap[key] = (productMap[key] ?? 0) + 1; }
  });

  let html = '';
  if (colorUnset > 0) html += xlsWarnBanner(`⚠️ 컬러 미정 총 ${colorUnset}건 (전체 ${total}건 중)`);
  html += xlsTitleRow(`${teamName} 전체 확정 합계`, `${total}건`);
  html += xlsDeviceTables(rows);
  html += xlsRatioTable(`가입유형 · 부가서비스 비율 (확정 ${total}건 기준)`, [
    { label: 'MNP', count: mnpCount, ratio: pct(mnpCount), accent: '#E8EAF6' },
    { label: '기기변경', count: changeCount, ratio: pct(changeCount), accent: '#E3F2FD' },
    ...(etcCount > 0 ? [{ label: '기타', count: etcCount, ratio: pct(etcCount) }] : []),
    { label: '번들(2ND)', count: bundleCount, ratio: pct(bundleCount) },
    { label: '인터넷(동판)', count: internetCount, ratio: pct(internetCount) },
  ]);
  html += xlsNameCountTable(
    '2ND (워치·태블릿)',
    Object.entries(productMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
  );
  return html;
}

export function downloadTeamReportXls(rows: ConfirmedRow[], staffTeamMap: Record<string, string | null>) {
  const teamGroups = new Map<string, ConfirmedRow[]>();
  rows.forEach((r) => {
    const team = (r.assigned_to && staffTeamMap[r.assigned_to]) || '미배정';
    if (!teamGroups.has(team)) teamGroups.set(team, []);
    teamGroups.get(team)!.push(r);
  });

  let html = '';
  Array.from(teamGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([team, teamRows]) => {
      html += xlsTeamReportBlock(team, teamRows);
      html += '<br/>';
    });

  downloadStyledXls(`팀별_확정현황_${new Date().toISOString().slice(0, 10)}.xls`, html);
}

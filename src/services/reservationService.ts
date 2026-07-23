// ============================================================
// 사전예약 관리 — Supabase 서비스 레이어
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type {
  Reservation,
  ReservationInsert,
  ReservationUpdate,
  ReservationFailReason,
  ReservationStatus,
  ReservationMemoLog,
} from '@/types/reservation';

// ── 실패 사유 목록 ─────────────────────────────────────────
export async function fetchFailReasons(): Promise<ReservationFailReason[]> {
  const { data, error } = await supabase
    .from('reservation_fail_reasons')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ReservationFailReason[];
}

// ── 목록 조회 ──────────────────────────────────────────────
export interface FetchReservationsParams {
  status?: ReservationStatus | '';
  prospect_grade?: string;
  assigned_to?: string;
  search?: string;
  channel?: string;
  dateStart?: string;
  dateEnd?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchReservations(params: FetchReservationsParams = {}): Promise<{
  data: Reservation[];
  count: number;
}> {
  const { status, prospect_grade, assigned_to, search, channel, dateStart, dateEnd, page = 1, pageSize = 50 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('reservations')
    .select(
      `*, 
       fail_reason:reservation_fail_reasons(id, reason, sort_order, created_at)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  if (prospect_grade) query = query.eq('prospect_grade', prospect_grade);
  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (channel) query = query.eq('channel', channel);
  if (dateStart) query = query.gte('contact_date', dateStart);
  if (dateEnd) query = query.lte('contact_date', dateEnd + 'T23:59:59');
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as unknown as Reservation[], count: count ?? 0 };
}

// ── 단건 조회 ──────────────────────────────────────────────
export async function fetchReservationById(id: string): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .select(
      `*, 
       fail_reason:reservation_fail_reasons(id, reason, sort_order, created_at)`
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as unknown as Reservation;
}

// ── 등록 ───────────────────────────────────────────────────
export async function insertReservation(payload: ReservationInsert): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert({ ...payload, status: payload.status ?? '신규' })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Reservation;
}

// ── 수정 ───────────────────────────────────────────────────
export async function updateReservation(
  id: string,
  payload: ReservationUpdate
): Promise<Reservation> {
  // 상담실패 → fail_stage 자동 세팅
  if (payload.status === '상담실패' && !payload.fail_stage) {
    payload = { ...payload, fail_stage: '상담' };
  }
  // 예약완료 → reservation_confirmed_at 자동 세팅
  if (payload.status === '예약완료' && !payload.reservation_confirmed_at) {
    payload = { ...payload, reservation_confirmed_at: new Date().toISOString() };
  }
  // 개통완료 → activated_at 자동 세팅
  if (payload.status === '개통완료' && !payload.activated_at) {
    payload = { ...payload, activated_at: new Date().toISOString() };
  }

  const { data, error } = await supabase
    .from('reservations')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Reservation;
}

// ── 삭제 ───────────────────────────────────────────────────
export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}

// ── 메모 히스토리 ──────────────────────────────────────────
// 메모는 덮어쓰기가 아닌 누적 로그로 관리합니다 (reservation_memo_logs 테이블).
// reservations.memo 컬럼은 목록/CSV 호환을 위해 "최신 메모" 요약만 계속 미러링합니다.
export async function fetchMemoLogs(reservationId: string): Promise<ReservationMemoLog[]> {
  const { data, error } = await supabase
    .from('reservation_memo_logs')
    .select('*, author:profiles!reservation_memo_logs_created_by_fkey(display_name)')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReservationMemoLog[];
}

export async function addMemoLog(
  reservationId: string,
  content: string,
  userId?: string | null
): Promise<ReservationMemoLog> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('메모 내용을 입력해주세요');

  const { data, error } = await supabase
    .from('reservation_memo_logs')
    .insert({ reservation_id: reservationId, content: trimmed, created_by: userId || null })
    .select('*, author:profiles!reservation_memo_logs_created_by_fkey(display_name)')
    .single();
  if (error) throw error;

  // 목록/CSV 호환용 memo 컬럼에 최신 요약 미러링 (실패해도 로그 저장 자체는 이미 성공)
  try {
    const stamp = new Date().toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    await supabase
      .from('reservations')
      .update({ memo: `[${stamp}] ${trimmed}` })
      .eq('id', reservationId);
  } catch {
    /* noop */
  }

  return data as unknown as ReservationMemoLog;
}

// ── 통계 ───────────────────────────────────────────────────
export interface ReservationStats {
  total: number;
  byStatus: Record<string, number>;
  successRate: number;
  activationRate: number;
}

export async function fetchReservationStats(): Promise<ReservationStats> {
  const { data, error } = await supabase
    .from('reservations')
    .select('status');
  if (error) throw error;

  const rows = (data ?? []) as { status: string }[];
  const total = rows.length;
  const byStatus: Record<string, number> = {};
  rows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  });

  const successCount = (byStatus['상담성공'] ?? 0) + (byStatus['예약완료'] ?? 0) + (byStatus['개통완료'] ?? 0);
  const activationCount = byStatus['개통완료'] ?? 0;
  const progressCount = total - (byStatus['상담실패'] ?? 0);

  return {
    total,
    byStatus,
    successRate: progressCount > 0 ? Math.round((successCount / progressCount) * 100) : 0,
    activationRate: successCount > 0 ? Math.round((activationCount / successCount) * 100) : 0,
  };
}


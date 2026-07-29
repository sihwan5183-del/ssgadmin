// ============================================================
// 확정(서류작성) 건 ↔ LG본사 전산 크로스체크 — 서비스 레이어 (v2)
// ============================================================
// v1(엑셀 업로드 자동매칭)은 폐기. 본사 시스템에서 데이터를 뽑을 방법이
// 없어서 담당자가 화면을 직접 보고 눈으로 대조한 뒤 수동으로 남기는
// 3단계 토글 방식으로 전환.
//   미확인 → 일치 / 불일치(사유)
// reservations 테이블에 컬럼으로 바로 저장 (별도 매칭 테이블 없음).
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type { HqCheckStatus } from '@/types/reservation';

export async function setHqCheckStatus(
  reservationId: string,
  status: HqCheckStatus,
  note: string | null,
  userId: string | null,
): Promise<void> {
  const payload =
    status === '미확인'
      ? {
          hq_check_status: '미확인' as HqCheckStatus,
          hq_check_note: null,
          hq_checked_by: null,
          hq_checked_at: null,
        }
      : {
          hq_check_status: status,
          hq_check_note: status === '불일치' ? (note ?? null) : null,
          hq_checked_by: userId,
          hq_checked_at: new Date().toISOString(),
        };

  const { error } = await supabase
    .from('reservations')
    .update(payload)
    .eq('id', reservationId);
  if (error) throw error;
}

// ============================================================
// 사전예약 관리 — 상세 / 수정 모달
// 상담실패 선택 시 실패사유 필수 인터셉트
// ============================================================
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  fetchReservationById,
  updateReservation,
  fetchFailReasons,
  deleteReservation,
} from '@/services/reservationService';
import type { Reservation, ReservationStatus, FailStage } from '@/types/reservation';
import {
  RESERVATION_STATUS_LIST,
  CARRIER_OPTIONS,
  CHANNEL_OPTIONS,
} from '@/types/reservation';
import type { ReservationFailReason } from '@/types/reservation';
import { useRole } from '@/hooks/useRole';
import { saveStatusLog } from '@/services/responseTimeService';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { formatPhone } from '@/lib/phoneFormat';

interface Props {
  reservationId: string;
  onClose: () => void;
  onDone: () => void;
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const found = RESERVATION_STATUS_LIST.find((s) => s.value === status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${found?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {found?.label ?? status}
    </span>
  );
}

export function ReservationDetailModal({ reservationId, onClose, onDone }: Props) {
  const { isAdmin } = useRole();
  const { staff } = useDashboardStaff();

  const [row, setRow] = useState<Reservation | null>(null);
  const [failReasons, setFailReasons] = useState<ReservationFailReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 수정 필드
  const [status, setStatus] = useState<ReservationStatus>('신규');
  const [carrier, setCarrier] = useState('');
  const [channel, setChannel] = useState('');
  const [device, setDevice] = useState('');
  const [memo, setMemo] = useState('');

  // 실패 사유 모달 (상담실패 선택 시 인터셉트)
  const [failModalOpen, setFailModalOpen] = useState(false);
  const [selectedFailReason, setSelectedFailReason] = useState<string>('');
  const [failMemo, setFailMemo] = useState('');
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [r, fr] = await Promise.all([
          fetchReservationById(reservationId),
          fetchFailReasons(),
        ]);
        setRow(r);
        setFailReasons(fr);
        setStatus(r.status);
        setCarrier(r.carrier ?? '');
        setChannel(r.channel ?? '');
        setDevice(r.device_interest ?? '');
        setMemo(r.memo ?? '');
        if (r.fail_reason_id) setSelectedFailReason(r.fail_reason_id);
        if (r.fail_memo) setFailMemo(r.fail_memo);
      } catch (e: any) {
        toast.error('로드 실패: ' + e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reservationId]);

  // 상태 변경 시 실패 인터셉트
  const handleStatusChange = (val: ReservationStatus) => {
    if (val === '상담실패') {
      setPendingStatus(val);
      setFailModalOpen(true);
      return;
    }
    setStatus(val);
  };

  // 실패 사유 확정
  const handleFailConfirm = () => {
    if (!selectedFailReason) return toast.error('실패 사유를 선택해주세요');
    if (pendingStatus) setStatus(pendingStatus);
    setFailModalOpen(false);
  };

  const handleSave = async () => {
    if (!row) return;
    setSaving(true);
    try {
      // 상태 변경 시 로그 저장
      if (status !== row.status && user?.id) {
        try {
          await saveStatusLog({
            reservationId: row.id,
            fromStatus: row.status,
            toStatus: status,
            changedBy: user.id,
            contactDate: row.contact_date,
          });
        } catch (e) {
          console.warn('로그 저장 실패:', e);
        }
      }
      await updateReservation(row.id, {
        status,
        carrier: carrier || undefined,
        channel: channel || undefined,
        device_interest: device || undefined,
        memo: memo.trim() || undefined,
        fail_reason_id: status === '상담실패' ? selectedFailReason || null : null,
        fail_stage: status === '상담실패' ? '상담' as FailStage : null,
        fail_memo: status === '상담실패' ? failMemo.trim() || null : null,
      } as any);
      toast.success('저장되었습니다');
      onDone();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    setDeleting(true);
    try {
      await deleteReservation(row.id);
      toast.success('삭제되었습니다');
      onDone();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              사전예약 상세
              {row && <span className="ml-2"><StatusBadge status={row.status} /></span>}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">로딩 중...</div>
          ) : row ? (
            <div className="space-y-4 pt-1">
              {/* 기본 정보 (읽기 전용) */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-xs text-gray-400">고객명</span>
                    <div className="font-semibold">{row.name}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">연락처</span>
                    <div className="font-semibold">{formatPhone(row.phone)}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">접수일</span>
                    <div>{row.contact_date ? new Date(row.contact_date).toLocaleDateString('ko-KR') : '-'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">생년월일</span>
                    <div>{(row as any).birth_date ?? '-'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">담당자</span>
                    <div>{row.assigned_to ? (staff.find(s => s.user_id === row.assigned_to)?.display_name ?? '-') : '-'}</div>
                  </div>
                </div>
              </div>

              {/* 수정 가능 필드 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">상태</label>
                <Select value={status} onValueChange={(v) => handleStatusChange(v as ReservationStatus)}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESERVATION_STATUS_LIST.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 상담실패 상태일 때 실패사유 표시 */}
              {status === '상담실패' && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-100 space-y-2">
                  <div className="text-xs font-medium text-red-600">실패 사유</div>
                  <Select value={selectedFailReason} onValueChange={setSelectedFailReason}>
                    <SelectTrigger className="text-sm bg-white">
                      <SelectValue placeholder="실패 사유 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {failReasons.map((fr) => (
                        <SelectItem key={fr.id} value={fr.id}>{fr.reason}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={failMemo}
                    onChange={(e) => setFailMemo(e.target.value)}
                    placeholder="추가 메모 (선택)"
                    className="text-sm resize-none bg-white"
                    rows={2}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">통신사</label>
                  <Select value={carrier || '_none_'} onValueChange={(v) => setCarrier(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {CARRIER_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">채널</label>
                  <Select value={channel || '_none_'} onValueChange={(v) => setChannel(v === '_none_' ? '' : v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">선택 안함</SelectItem>
                      {CHANNEL_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">관심 기기</label>
                <Select value={device} onValueChange={setDevice}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">메모</label>
                <Textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="특이사항"
                  className="text-sm resize-none"
                  rows={3}
                />
              </div>

              {/* 타임라인 */}
              {(row.reservation_confirmed_at || row.activated_at) && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-xs space-y-1">
                  {row.reservation_confirmed_at && (
                    <div className="text-blue-600">
                      📅 예약완료: {new Date(row.reservation_confirmed_at).toLocaleString('ko-KR')}
                    </div>
                  )}
                  {row.activated_at && (
                    <div className="text-indigo-600">
                      ✅ 개통완료: {new Date(row.activated_at).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleting}
                  >
                    삭제
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                  취소
                </Button>
                <Button
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                  onClick={handleSave}
                  disabled={saving || (status === '상담실패' && !selectedFailReason)}
                >
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 실패 사유 인터셉트 모달 */}
      {failModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => { setFailModalOpen(false); setPendingStatus(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-sm mb-1 text-red-600">상담실패 처리</div>
            <div className="text-xs text-gray-500 mb-4">실패 사유를 선택해야 저장할 수 있습니다</div>
            <div className="space-y-3">
              <Select value={selectedFailReason} onValueChange={setSelectedFailReason}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="실패 사유 선택 *" />
                </SelectTrigger>
                <SelectContent>
                  {failReasons.map((fr) => (
                    <SelectItem key={fr.id} value={fr.id}>{fr.reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={failMemo}
                onChange={(e) => setFailMemo(e.target.value)}
                placeholder="추가 메모 (선택)"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setFailModalOpen(false); setPendingStatus(null); }}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                onClick={handleFailConfirm}
                disabled={!selectedFailReason}
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
          onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}>
            <div className="font-bold text-sm mb-2">정말 삭제하시겠어요?</div>
            <div className="text-xs text-gray-500 mb-4">삭제된 데이터는 복구할 수 없습니다.</div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}




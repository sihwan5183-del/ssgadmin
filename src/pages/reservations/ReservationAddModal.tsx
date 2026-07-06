// ============================================================
// 사전예약 관리 — 신규 등록 모달
// ============================================================
import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { insertReservation } from '@/services/reservationService';
import { CARRIER_OPTIONS, CHANNEL_OPTIONS } from '@/types/reservation';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function ReservationAddModal({ open, onClose, onDone }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [carrier, setCarrier] = useState('');
  const [channel, setChannel] = useState('');
  const device = '갤럭시 Z 폴더블8'; // 고정
  const [birthDate, setBirthDate] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('고객명을 입력해주세요');
    if (!phone.trim()) return toast.error('연락처를 입력해주세요');

    setLoading(true);
    try {
      await insertReservation({
        name: name.trim(),
        phone: phone.trim(),
        carrier: carrier || undefined,
        channel: channel || undefined,
        device_interest: device || undefined,
        memo: memo.trim() || undefined,
        birth_date: birthDate || undefined,
        assigned_to: user?.id,
        status: '신규',
      });
      toast.success('사전예약 고객이 등록되었습니다');
      onDone();
    } catch (e: any) {
      toast.error('등록 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">사전예약 신규 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">고객명 <span className="text-red-400">*</span></label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">연락처 <span className="text-red-400">*</span></label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">현재 통신사</label>
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
              <label className="text-xs text-gray-500 mb-1 block">인입 채널</label>
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
            <label className="text-xs text-gray-500 mb-1 block">생년월일</label>
            <Input
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              placeholder="예) 19900101"
              maxLength={8}
              className="text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">메모</label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="특이사항 입력"
              className="text-sm resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '등록 중...' : '등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}



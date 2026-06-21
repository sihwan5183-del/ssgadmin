// ============================================================
// 활동 로그 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState } from 'react';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import { mockActivityLogs } from '@/data/workReportMockData';

const STAFF_OPTIONS = ['전체', '최윤정', '김경환', '오미나'];
const ACTION_OPTIONS = ['전체', '통화시도', '문자발송', '상담성공', '실패처리', '재케어'];
const COUNTED_OPTIONS = ['전체', '인정', '미인정'];

const actionTypeLabel: Record<string, string> = {
  CALL_ATTEMPT: '통화시도',
  CALL_CONNECTED: '연결완료',
  NO_ANSWER: '부재',
  SMS_SENT: '문자발송',
  RECARE_REGISTERED: '재케어등록',
  RECARE_COMPLETED: '재케어완료',
  FAILED: '실패처리',
  CONSULT_SUCCESS: '상담성공',
  DELIVERY_PENDING: '택배대기',
  DELIVERY_SENT: '택배발송',
  OPENING_COMPLETE: '개통완료',
  SETTLEMENT_CONFIRMED: '정산확정',
};

export default function ActivityLogs() {
  const [staff, setStaff] = useState('전체');
  const [action, setAction] = useState('전체');
  const [counted, setCounted] = useState('전체');
  const [anomalyOnly, setAnomalyOnly] = useState(false);

  const filteredLogs = mockActivityLogs.filter((log) => {
    if (staff !== '전체' && log.user_name !== staff) return false;
    if (counted === '인정' && !log.is_counted) return false;
    if (counted === '미인정' && log.is_counted) return false;
    if (anomalyOnly && log.is_counted) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="활동 로그"
        description="업무량 뻥튀기 방지 및 직원 활동 검증을 위한 로그 테이블입니다."
        rightSlot={
          <>
            <input
              type="date"
              defaultValue="2026-06-21"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            />
            <select
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {STAFF_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {ACTION_OPTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {COUNTED_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={anomalyOnly}
                onChange={(e) => setAnomalyOnly(e.target.checked)}
                className="rounded accent-pink-500"
              />
              이상로그만
            </label>
          </>
        }
      />

      {/* 요약 통계 */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: '전체 로그', value: mockActivityLogs.length, color: 'text-gray-700' },
          { label: '인정', value: mockActivityLogs.filter((l) => l.is_counted).length, color: 'text-green-600' },
          { label: '미인정', value: mockActivityLogs.filter((l) => !l.is_counted).length, color: 'text-red-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-5 py-3 text-center shadow-sm">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                {['시간', '담당자', '고객명', '행동', '결과', '이전상태', '변경상태', '인정여부', '미인정 사유', '메모'].map((h) => (
                  <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.map((log) => {
                const timeStr = log.created_at.split(' ')[1] ?? log.created_at;
                return (
                  <tr
                    key={log.id}
                    className={`hover:bg-gray-50 transition-colors ${!log.is_counted ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="py-2.5 px-3 text-gray-500 text-xs whitespace-nowrap font-mono">{timeStr}</td>
                    <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{log.user_name}</td>
                    <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{log.customer_name ?? '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <WRBadge variant="info">{actionTypeLabel[log.action_type] ?? log.action_type}</WRBadge>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{log.result_type ?? '-'}</td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs whitespace-nowrap">{log.previous_status ?? '-'}</td>
                    <td className="py-2.5 px-3 text-gray-700 text-xs whitespace-nowrap">{log.next_status ?? '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <WRBadge variant={log.is_counted ? 'success' : 'danger'}>
                        {log.is_counted ? '인정' : '미인정'}
                      </WRBadge>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-red-500 whitespace-nowrap">
                      {log.uncounted_reason ?? '-'}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[160px] truncate">
                      {log.memo ?? '-'}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                    조건에 맞는 로그가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

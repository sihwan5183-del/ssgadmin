// ============================================================
// 진행/지연 관리 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { useState } from 'react';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import { mockProgressCards, mockProgressDelayRows } from '@/data/workReportMockData';

const STAFF_OPTIONS = ['전체', '최윤정', '김경환', '오미나'];
const STATUS_OPTIONS = ['전체', '상담성공', '택배대기', '택배발송', '개통대기', '개통완료', '정산대기'];

function DelayBadge({ days }: { days: number }) {
  if (days === 0) return <WRBadge variant="success">정상</WRBadge>;
  if (days <= 1) return <WRBadge variant="warning">{days}일 지연</WRBadge>;
  return <WRBadge variant="danger">{days}일 초과</WRBadge>;
}

export default function ProgressDelay() {
  const [staff, setStaff] = useState('전체');
  const [status, setStatus] = useState('전체');

  const filtered = mockProgressDelayRows.filter((r) => {
    if (staff !== '전체' && r.user_name !== staff) return false;
    if (status !== '전체' && r.current_status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="진행/지연 관리"
        description="상담성공 → 택배발송 → 개통완료 → 정산확정 단계별 지연 건을 추적합니다."
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
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </>
        }
      />

      {/* 상단 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {mockProgressCards.map((card) => {
          const colorMap: Record<string, string> = {
            yellow: 'bg-yellow-50 border-yellow-200',
            orange: 'bg-orange-50 border-orange-200',
            blue: 'bg-blue-50 border-blue-200',
            red: 'bg-red-50 border-red-200',
            gray: 'bg-gray-50 border-gray-200',
          };
          const countColor: Record<string, string> = {
            yellow: 'text-yellow-600', orange: 'text-orange-600',
            blue: 'text-blue-600', red: 'text-red-600', gray: 'text-gray-500',
          };
          return (
            <div
              key={card.label}
              className={`rounded-xl border p-4 text-center ${colorMap[card.color] ?? colorMap.gray}`}
            >
              <div className={`text-3xl font-bold ${countColor[card.color] ?? 'text-gray-600'}`}>
                {card.count}
              </div>
              <div className="text-[11px] text-gray-500 mt-1.5 leading-tight">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* 지연 기준 안내 */}
      <div className="flex gap-3 flex-wrap">
        {[
          '상담성공 후 2일 이상 택배 미발송',
          '택배발송 후 4일 이상 개통 미완료',
          '개통완료 후 3일 이상 정산 미확정',
        ].map((rule) => (
          <div key={rule} className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            ⚠ {rule}
          </div>
        ))}
      </div>

      {/* 지연 테이블 */}
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                {['고객명', '담당자', '현재상태', '채널', '상담성공일', '택배발송일', '예상개통일', '실제개통일', '지연', '조치'].map((h) => (
                  <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${row.delay_days > 0 ? 'bg-orange-50/30' : ''}`}>
                  <td className="py-3 px-3 font-medium text-gray-800">{row.customer_name}</td>
                  <td className="py-3 px-3 text-gray-700">{row.user_name}</td>
                  <td className="py-3 px-3">
                    <WRBadge variant={row.delay_days > 0 ? 'warning' : 'info'}>{row.current_status}</WRBadge>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">{row.channel}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 whitespace-nowrap">{row.consult_success_at ?? '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 whitespace-nowrap">{row.delivery_sent_at ?? '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 whitespace-nowrap">{row.expected_opening_at ?? '-'}</td>
                  <td className="py-3 px-3 text-xs text-gray-600 whitespace-nowrap">{row.actual_opening_at ?? '-'}</td>
                  <td className="py-3 px-3"><DelayBadge days={row.delay_days} /></td>
                  <td className="py-3 px-3">
                    <button className="text-xs text-pink-500 hover:text-pink-700 font-medium">확인</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                    지연 건이 없습니다.
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

// ============================================================
// 인센 예상 — mock data 기반 레이아웃 (1단계)
// ============================================================
import { WorkReportHeader, SectionCard } from './_shared';
import { mockIncentivePolicies, mockIncentiveResults } from '@/data/workReportMockData';

export default function IncentiveDashboard() {
  const totalEstimated = mockIncentiveResults.reduce((s, r) => s + r.estimated_amount, 0);

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="인센 예상"
        description="정산확정 건수 기준 직원별 예상 인센을 확인합니다. 단가는 리포트 설정에서 변경 가능합니다."
        rightSlot={
          <>
            <select
              defaultValue="2026-06"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              <option value="2026-06">2026년 06월</option>
              <option value="2026-05">2026년 05월</option>
            </select>
            <select
              defaultValue="전체"
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none"
            >
              <option>전체</option>
              <option>최윤정</option>
              <option>김경환</option>
              <option>오미나</option>
            </select>
          </>
        }
      />

      {/* 정책 카드 */}
      <SectionCard title={`인센 정책 — ${mockIncentivePolicies[0]?.apply_month}`}>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-1.5 font-medium">
            정산기준: 정산확정
          </span>
          <span className="text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-3 py-1.5 font-medium">
            계산방식: 최종구간 일괄 적용
          </span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {mockIncentivePolicies.map((pol) => {
            const tierLabel = pol.range_end
              ? `${pol.range_start}~${pol.range_end}건`
              : `${pol.range_start}건 이상`;
            return (
              <div
                key={pol.id}
                className="bg-gradient-to-br from-pink-50 to-white border border-pink-200 rounded-xl px-6 py-4 text-center min-w-[140px]"
              >
                <div className="text-xs text-pink-500 font-semibold mb-1">{tierLabel}</div>
                <div className="text-2xl font-bold text-pink-600">{pol.unit_price.toLocaleString()}원</div>
                <div className="text-[10px] text-gray-400 mt-0.5">건당</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* 팀 전체 예상 인센 요약 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">총 정산확정</div>
          <div className="text-2xl font-bold text-gray-900">
            {mockIncentiveResults.reduce((s, r) => s + r.confirmed_count, 0)}건
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">총 정산대기</div>
          <div className="text-2xl font-bold text-blue-600">
            {mockIncentiveResults.reduce((s, r) => s + r.pending_count, 0)}건
          </div>
        </div>
        <div className="bg-pink-50 rounded-xl border border-pink-200 shadow-sm p-4 text-center">
          <div className="text-xs text-pink-400 mb-1">팀 전체 예상 인센</div>
          <div className="text-2xl font-bold text-pink-600">{totalEstimated.toLocaleString()}원</div>
        </div>
      </div>

      {/* 직원별 테이블 */}
      <SectionCard title="직원별 인센 현황">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                {['담당자', '상담성공', '개통완료', '정산확정', '정산대기', '철회', '적용구간', '단가', '예상인센'].map((h) => (
                  <th key={h} className={`py-2.5 px-3 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mockIncentiveResults.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-800">{r.user_name}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{r.consult_success}</td>
                  <td className="py-3 px-3 text-right text-gray-600">{r.opening_complete}</td>
                  <td className="py-3 px-3 text-right font-bold text-green-600">{r.confirmed_count}</td>
                  <td className="py-3 px-3 text-right text-blue-500">{r.pending_count}</td>
                  <td className="py-3 px-3 text-right text-gray-400">{r.excluded_count}</td>
                  <td className="py-3 px-3 text-right text-xs text-gray-500">{r.applied_tier}</td>
                  <td className="py-3 px-3 text-right text-gray-700">{r.applied_unit_price.toLocaleString()}원</td>
                  <td className="py-3 px-3 text-right">
                    <span className="font-bold text-pink-600">{r.estimated_amount.toLocaleString()}원</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-3 px-3 font-bold text-gray-700" colSpan={8}>합계</td>
                <td className="py-3 px-3 text-right font-bold text-pink-600 text-base">
                  {totalEstimated.toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          ※ 예상 인센은 정산확정 건 기준이며, 정산대기 건은 확정 전 참고 금액입니다.
        </p>
      </SectionCard>
    </div>
  );
}

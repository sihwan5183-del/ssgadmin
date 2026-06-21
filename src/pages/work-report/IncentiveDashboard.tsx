// ============================================================
// 인센 예상 — 실제 데이터 연결 (권한별 조회)
// 관리자: 전체 / 팀장·직원: 본인만
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import {
  fetchIncentivePolicies,
  getIncentiveResults,
  type IncentivePolicy,
  type IncentiveResult,
} from '@/services/workReport/incentiveService';
import { resolveStaffDisplayNames } from '@/services/workReport/staffDisplayService';

export default function IncentiveDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [applyMonth, setApplyMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);
  const [results, setResults] = useState<IncentiveResult[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [pol, res] = await Promise.all([
        fetchIncentivePolicies(applyMonth),
        getIncentiveResults(applyMonth, user.id, isAdmin),
      ]);
      setPolicies(pol);

      // 표시명 보정
      const staffIds = res.map((r) => r.staff_id);
      const nameMap = staffIds.length > 0 ? await resolveStaffDisplayNames(staffIds) : new Map();
      setResults(res.map((r) => ({ ...r, display_name: nameMap.get(r.staff_id) ?? r.staff_name })));
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, isAdmin, applyMonth]);

  useEffect(() => {
    if (!roleLoading) load();
  }, [roleLoading, load]);

  const totalEstimated = results.reduce((s, r) => s + r.estimated_amount, 0);
  const totalConfirmed = results.reduce((s, r) => s + r.settlement_confirmed, 0);

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="인센 예상"
        description={isAdmin ? '전체 직원 예상 인센을 확인합니다.' : '본인 예상 인센을 확인합니다.'}
        rightSlot={
          <>
            <input
              type="month"
              value={applyMonth}
              onChange={(e) => setApplyMonth(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
            <button
              onClick={load}
              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {/* 정책 카드 */}
      <SectionCard title={`인센 정책 — ${applyMonth}`}>
        {policies.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            {applyMonth} 인센 정책이 없습니다. 리포트 설정에서 정책을 먼저 입력해주세요.
          </p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {policies.map((pol) => {
              const tierLabel = pol.range_end
                ? `${pol.range_start}~${pol.range_end}건`
                : `${pol.range_start}건 이상`;
              return (
                <div key={pol.id} className="bg-gradient-to-br from-pink-50 to-white border border-pink-200 rounded-xl px-6 py-4 text-center min-w-[140px]">
                  <div className="text-xs text-pink-500 font-semibold mb-1">{tierLabel}</div>
                  <div className="text-2xl font-bold text-pink-600">{pol.unit_price.toLocaleString()}원</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">건당 / {pol.product_type}</div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 전체 요약 (관리자만) */}
      {isAdmin && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">총 정산확정</div>
            <div className="text-2xl font-bold text-gray-900">{totalConfirmed}건</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <div className="text-xs text-gray-400 mb-1">집계 직원 수</div>
            <div className="text-2xl font-bold text-blue-600">{results.length}명</div>
          </div>
          <div className="bg-pink-50 rounded-xl border border-pink-200 shadow-sm p-4 text-center">
            <div className="text-xs text-pink-400 mb-1">팀 전체 예상 인센</div>
            <div className="text-2xl font-bold text-pink-600">{totalEstimated.toLocaleString()}원</div>
          </div>
        </div>
      )}

      {/* 직원별 테이블 */}
      <SectionCard title={isAdmin ? '직원별 인센 현황' : '내 인센 현황'}>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : results.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {applyMonth} 활동 데이터가 없습니다.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    {['담당자', '상담성공', '개통완료', '정산확정', '정산대기', '적용구간', '단가', '예상인센'].map((h) => (
                      <th key={h} className={`py-2.5 px-3 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map((r) => (
                    <tr key={r.staff_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-gray-800">{r.display_name}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{r.consult_success}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{r.activation_completed}</td>
                      <td className="py-3 px-3 text-right font-bold text-green-600">{r.settlement_confirmed}</td>
                      <td className="py-3 px-3 text-right text-blue-500">{r.pending_count}</td>
                      <td className="py-3 px-3 text-right text-xs text-gray-500">{r.applied_tier}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{r.applied_unit_price.toLocaleString()}원</td>
                      <td className="py-3 px-3 text-right font-bold text-pink-600">{r.estimated_amount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
                {isAdmin && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="py-3 px-3 font-bold text-gray-700" colSpan={7}>합계</td>
                      <td className="py-3 px-3 text-right font-bold text-pink-600 text-base">
                        {totalEstimated.toLocaleString()}원
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              ※ 예상 인센은 정산확정 건 기준이며, 정산대기 건은 확정 전 참고 금액입니다.
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ============================================================
// 인센 예상 — sales 테이블 기준 (activity_logs 미사용)
// 모바일 50건↑ × 20,000원 × 인터넷 설치 지급률
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard } from './_shared';
import {
  getStaffIncentiveSummary,
  getSalesChannelSummary,
  type StaffIncentiveSummary,
} from '@/services/workReport/salesReportService';

export default function IncentiveDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [applyMonth, setApplyMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [staffSummaries, setStaffSummaries] = useState<StaffIncentiveSummary[]>([]);
  const [channelSummaries, setChannelSummaries] = useState<{ channel: string; total: number; completed: number }[]>([]);

  const load = useCallback(async () => {
    if (!user || roleLoading) return;
    setLoading(true);
    try {
      const myName = user.user_metadata?.display_name ?? '';
      const [staff, channels] = await Promise.all([
        getStaffIncentiveSummary(applyMonth, isAdmin ? undefined : myName),
        getSalesChannelSummary(applyMonth),
      ]);
      setStaffSummaries(staff);
      setChannelSummaries(channels);
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, isAdmin, applyMonth]);

  useEffect(() => {
    if (!roleLoading) load();
  }, [roleLoading, load]);

  // 팀 전체 합산
  const totalMobile = staffSummaries.reduce((s, r) => s + r.mobile, 0);
  const totalInternet = staffSummaries.reduce((s, r) => s + r.internet, 0);
  const totalIncentive = staffSummaries.reduce((s, r) => s + r.final_incentive, 0);
  const mobileConditionMet = totalMobile >= 50;
  const payoutRate = totalInternet === 0 ? 0 : totalInternet === 1 ? 0.5 : 1;

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="인센 예상"
        description="판매실적장표(sales) 기준 개통완료/설치완료 건수로 계산합니다."
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

      {/* 인센 정책 안내 */}
      <SectionCard title="인센 정책 기준">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-pink-600 mb-2">📱 모바일 인센</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div>• 정산확정 50건 이상 → 건당 <span className="font-bold text-pink-600">20,000원</span></div>
              <div>• 정산확정 50건 미만 → <span className="font-bold text-gray-400">0원</span></div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-600 mb-2">🌐 인터넷 설치 지급률</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div>• 당월 설치 0개 → <span className="font-bold text-red-500">0%</span></div>
              <div>• 당월 설치 1개 → <span className="font-bold text-yellow-600">50%</span></div>
              <div>• 당월 설치 2개 이상 → <span className="font-bold text-green-600">100%</span></div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 팀 전체 요약 (관리자만) */}
      {isAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '모바일 개통완료', value: `${totalMobile}건`, color: 'text-pink-600', sub: mobileConditionMet ? '✅ 50건 충족' : `❌ ${50 - totalMobile}건 부족` },
            { label: '인터넷 설치완료', value: `${totalInternet}건`, color: 'text-blue-600', sub: `지급률 ${Math.round(payoutRate * 100)}%` },
            { label: '기본 인센 (모바일)', value: mobileConditionMet ? `${(totalMobile * 20000).toLocaleString()}원` : '0원', color: 'text-gray-700', sub: '인터넷 반영 전' },
            { label: '최종 예상 인센', value: `${totalIncentive.toLocaleString()}원`, color: 'text-pink-600', sub: `= 기본 × ${Math.round(payoutRate * 100)}%` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-gray-400 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* 직원별 실적 */}
      <SectionCard title={isAdmin ? '직원별 실적 현황' : '내 실적 현황'}>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : staffSummaries.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">{applyMonth} 실적 데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['담당자', '전체', '모바일', '인터넷', 'TV프리', '모요', '기본 인센', '지급률', '최종 예상'].map((h) => (
                    <th key={h} className={`py-2.5 px-3 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staffSummaries.map((r) => {
                  const { baseIncentive, payoutRate: pr, finalIncentive: fi, mobileConditionMet: met } = calcIncentiveFromSales(r.mobile_completed, r.internet_installed);
                  return (
                    <tr key={r.manager} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-gray-800">{r.manager}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-bold ${met ? 'text-green-600' : 'text-gray-600'}`}>{r.mobile_completed}</span>
                        {!met && <span className="text-[10px] text-red-400 ml-1">({50 - r.mobile_completed}↑)</span>}
                      </td>
                      <td className="py-3 px-3 text-right text-blue-600 font-semibold">{r.internet_installed}</td>
                      <td className="py-3 px-3 text-right text-gray-500">{r.moyo_count}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{baseIncentive > 0 ? baseIncentive.toLocaleString() + '원' : '-'}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-semibold ${pr === 1 ? 'text-green-600' : pr === 0.5 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {Math.round(pr * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-pink-600">
                        {fi > 0 ? fi.toLocaleString() + '원' : '0원'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">
          ※ 판매실적장표 기준 / 취소·반려 건 제외 / 개통완료·설치완료 건만 집계
        </p>
      </SectionCard>

      {/* 채널별 실적 (관리자만) */}
      {isAdmin && channelSummaries.length > 0 && (
        <SectionCard title="채널별 실적">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {channelSummaries.slice(0, 8).map((ch) => (
              <div key={ch.channel} className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
                <div className="text-xs text-gray-400 mb-1">{ch.channel}</div>
                <div className="text-xl font-bold text-gray-800">{ch.completed}</div>
                <div className="text-[10px] text-gray-400 mt-1">완료 / 전체 {ch.total}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

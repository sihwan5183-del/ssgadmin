// ============================================================
// 진행/지연 관리 — leads 테이블 실제 데이터 연결
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard, WRBadge } from './_shared';
import { LogDetailModal, type LogDetailFilter } from './LogDetailModal';
import { getProgressDelayData, type ProgressDelayItem, type ProgressDelaySummary } from '@/services/workReport/progressDelayService';

const CHANNEL_OPTIONS = ['전체', 'meta', 'dogmaru', 'udak'];
const CHANNEL_LABEL: Record<string, string> = { meta: '메타', dogmaru: '도그마루', udak: '유닥', 전체: '전체' };

const SUMMARY_CARDS = [
  { key: 'consult_waiting_delivery',   label: '상담성공 후 택배대기',      color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
  { key: 'delivery_waiting_opening',   label: '택배발송 후 개통대기',      color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'opening_waiting_settlement', label: '개통완료 후 정산대기',      color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'overdue_opening',            label: '지연 위험 건',              color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'need_confirm',               label: '택배대기 확인 필요',        color: 'bg-gray-50 border-gray-200 text-gray-500' },
] as const;

function DelayBadge({ level, days }: { level: ProgressDelayItem['delay_level']; days: number }) {
  if (level === 'danger') return <WRBadge variant="danger">{days}일 초과</WRBadge>;
  if (level === 'warning') return <WRBadge variant="warning">{days}일 지연</WRBadge>;
  return <WRBadge variant="success">정상</WRBadge>;
}

export default function ProgressDelay() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const canViewAll = isAdmin || isManager;

  const [channel, setChannel] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProgressDelayItem[]>([]);
  const [summary, setSummary] = useState<ProgressDelaySummary | null>(null);
  const [detailFilter, setDetailFilter] = useState<LogDetailFilter | null>(null);

  const load = useCallback(async () => {
    if (!user || roleLoading) return;
    setLoading(true);
    try {
      const result = await getProgressDelayData({
        userId: user.id,
        isAdmin: canViewAll,
        channel: channel === '전체' ? undefined : channel,
      });
      setItems(result.items);
      setSummary(result.summary);
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, roleLoading, canViewAll, channel]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      {detailFilter && (
        <LogDetailModal filter={detailFilter} onClose={() => setDetailFilter(null)} />
      )}

      <WorkReportHeader
        title="진행/지연 관리"
        description="상담성공 → 택배발송 → 개통완료 → 정산확정 단계별 지연 건을 추적합니다."
        rightSlot={
          <>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c} value={c}>{CHANNEL_LABEL[c] ?? c}</option>
              ))}
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {SUMMARY_CARDS.map(({ key, label, color }) => {
          const val = summary?.[key] ?? 0;
          const today = new Date().toISOString().split('T')[0];
          const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          const from = sixMonthsAgo.toISOString().split('T')[0];
          const statusMap: Record<string, string[]> = {
            consult_waiting_delivery: ['상담성공','상담중'],
            delivery_waiting_opening: ['택배발송'],
            opening_waiting_settlement: ['개통완료'],
            overdue_opening: ['택배발송','개통완료'],
            need_confirm: ['택배대기'],
          };
          return (
            <div
              key={key}
              onClick={() => val > 0 && setDetailFilter({
                title: label,
                dateFrom: from,
                dateTo: today,
                sourceType: 'leads',
                statusFilter: statusMap[key],
              })}
              className={`rounded-xl border p-4 text-center ${color} ${val > 0 ? 'cursor-pointer hover:shadow-md' : ''} transition-all`}
            >
              <div className="text-3xl font-bold">{val}</div>
              <div className="text-[11px] mt-1.5 leading-tight opacity-80">{label}</div>
            </div>
          );
        })}
      </div>

      {/* 지연 기준 안내 */}
      <div className="flex gap-2 flex-wrap">
        {[
          '상담성공 후 2일 이상 → 경고 / 3일 이상 → 위험',
          '택배발송 후 2일 이상 → 경고 / 4일 이상 → 위험',
          '개통완료 후 2일 이상 → 경고 / 3일 이상 → 위험',
        ].map((rule) => (
          <div key={rule} className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5">
            ⚠ {rule}
          </div>
        ))}
      </div>

      {/* 진행 건 테이블 */}
      <SectionCard>
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                  {['고객명', '담당자', '현재상태', '채널', '최근 변경일', '경과일', '지연', '메모'].map((h) => (
                    <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      item.delay_level === 'danger' ? 'bg-red-50/30' :
                      item.delay_level === 'warning' ? 'bg-orange-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-medium text-gray-800">{item.customer_name_masked}</td>
                    <td className="py-3 px-3 text-gray-700">{item.assigned_name}</td>
                    <td className="py-3 px-3">
                      <WRBadge variant={
                        item.status === '개통완료' ? 'success' :
                        item.status === '상담성공' || item.status === '상담중' ? 'info' : 'warning'
                      }>
                        {item.status}
                      </WRBadge>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        item.channel === 'dogmaru' ? 'bg-blue-100 text-blue-700' :
                        item.channel === 'udak' ? 'bg-purple-100 text-purple-700' :
                        'bg-pink-100 text-pink-700'
                      }`}>
                        {CHANNEL_LABEL[item.channel] ?? item.channel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">{item.consult_date ?? '-'}</td>
                    <td className="py-3 px-3 text-xs text-gray-600 font-medium">{item.delay_days}일</td>
                    <td className="py-3 px-3"><DelayBadge level={item.delay_level} days={item.delay_days} /></td>
                    <td className="py-3 px-3 text-xs text-gray-400 max-w-[160px] truncate">{item.memo ?? '-'}</td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-gray-400">
                      진행 중인 건이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
